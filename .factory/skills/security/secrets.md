---
name: security-secrets
keywords: "secret, env, vault, rotation, leak, credential, .env"
description: "Secret management — env, vault, rotation"
---

# Secrets Management

## Temel kural

Secret kategorileri:
- **Database credential** (MongoDB URL, Redis password)
- **API key** (Stripe, SendGrid, AWS)
- **JWT secret** (sign + verify)
- **Encryption key** (PII encryption, cookie signing)
- **OAuth client secret** (Google, GitHub)
- **3rd-party token** (webhook signing key)

**ASLA** kod'a, repo'ya, log'a, screenshot'a.

## Storage hiyerarşisi

### 1. Local dev: `.env`

```env
# .env (git'te değil)
DATABASE_URL=mongodb://localhost:27017/acme
JWT_SECRET=local-dev-secret-min-32-chars-required
```

`.gitignore`'da: `.env`, `.env.local`, `.env.production`.

### 2. Local dev shared: `.env.example`

Sadece **key'ler**, value yok:
```env
# .env.example
DATABASE_URL=
JWT_SECRET=               # min 32 chars
JWT_REFRESH_SECRET=
REDIS_URL=
AWS_S3_BUCKET=
```

Yeni dev clone alır, `cp .env.example .env`, kendi value'larını koyar.

### 3. CI/CD: GitHub/GitLab Secrets

```yaml
# .github/workflows/deploy.yml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

Secret'lar GitHub UI üzerinden eklenir, log'da `***` görünür.

### 4. Production: Secret Manager

#### AWS
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'eu-west-1' });
const { SecretString } = await client.send(
  new GetSecretValueCommand({ SecretId: 'acme/prod' }),
);
const secrets = JSON.parse(SecretString!);
process.env.JWT_SECRET = secrets.JWT_SECRET;
```

#### Google
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: `projects/acme/secrets/JWT_SECRET/versions/latest`,
});
const value = version.payload.data.toString();
```

#### HashiCorp Vault
```typescript
import vault from 'node-vault';
const client = vault({ endpoint: 'https://vault.acme.com', token: process.env.VAULT_TOKEN });
const result = await client.read('secret/data/acme/prod');
const secrets = result.data.data;
```

#### Doppler / 1Password / Infisical
Modern alternatifler. CLI ile env inject:
```bash
doppler run -- node dist/main.js
```

### 5. Kubernetes: Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
type: Opaque
data:
  jwt-secret: <base64>

# Pod
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: backend-secrets
        key: jwt-secret
```

External Secrets Operator (ESO) ile vault'tan otomatik sync.

## Generation

### Strong secret üretimi
```bash
# 32 byte random hex
openssl rand -hex 32

# 64 char base64
openssl rand -base64 48

# UUID v4
uuidgen
```

Kod'da:
```typescript
import { randomBytes } from 'crypto';
const secret = randomBytes(32).toString('hex');  // 64 char hex
```

## Rotation

Secret değişimi süreci:

### JWT secret rotation

1. **Yeni secret oluştur** — vault'a `JWT_SECRET_V2`
2. **Kod hem eski hem yeniyi destekler** — verify her ikisini dener
3. **Sign yeni secret'la** — yeni token'lar V2 ile imzalanır
4. **Eski token'lar expire olana kadar bekle** (15dk + 7gün refresh)
5. **Eski secret'ı sil**

```typescript
async verifyToken(token: string): Promise<Payload> {
  for (const secret of [process.env.JWT_SECRET_V2, process.env.JWT_SECRET]) {
    if (!secret) continue;
    try {
      return await this.jwt.verifyAsync(token, { secret });
    } catch { /* try next */ }
  }
  throw new UnauthorizedException();
}
```

### Database password rotation

1. **MongoDB user'ına ek password ekle** (multi-password support)
2. **App'i yeni password ile deploy et**
3. **Eski password'u sil**

Cloud DB'lerde (Atlas, RDS) automated rotation feature'ı var.

### API key rotation

3rd-party (Stripe, SendGrid):
1. Yeni key oluştur dashboard'dan
2. App'e yeni key deploy
3. Eski key revoke

Otomatize: cron + secret manager API.

## Detection (leak)

### Pre-commit hook
```bash
pnpm add -D husky lint-staged

# .husky/pre-commit
npx gitleaks detect --staged --no-git --redact
```

`gitleaks` config:
```toml
[allowlist]
paths = ['''\.env\.example''', '''\.test\.''']
```

### CI scan
```yaml
# .github/workflows/security.yml
- uses: gitleaks/gitleaks-action@v2
```

Her PR'da scan. Leak varsa merge bloklu.

### Repo history scan

Geçmişte commit edildi mi:
```bash
gitleaks detect --source . --verbose
```

Bulunduysa: rotate hemen + history rewrite (BFG, git-filter-branch). Ama varsay leak'lendi → secret rotate.

## Logging hijacking

### Yanlış
```typescript
logger.info(`Login attempt`, { body: req.body });
// → password log'a düşer
```

### Doğru
```typescript
logger.info(`Login attempt`, {
  email: req.body.email,
  // password YAZILMAZ
});
```

### Pino redact
```typescript
import pino from 'pino';

const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '***',
  },
});
```

Tüm log'larda otomatik redact.

## Secret in URLs

```
GET /api/data?api_key=secret123  ❌
```

URL log'lara, browser history'sine, referer header'ına gider. **Header'da gönder:**
```
Authorization: Bearer ...
X-API-Key: ...
```

## Anti-pattern'ler

### Hardcoded
```typescript
const JWT_SECRET = 'my-prod-secret';  // ❌ security-gate BLOCK
```

### Default fallback
```typescript
const secret = process.env.JWT_SECRET || 'dev-fallback';  // ❌
```

### .env commit
```bash
git add .env  # ❌
```

### Secret email/Slack ile paylaş
```
"JWT secret: abc123"  ❌
```
Vault link paylaş. Secret kendisi değil.

### Rotation yok
Yıllarca aynı secret = sızdığında felaket.

## Aksiyon

1. `.env` git'te değil, `.env.example` template
2. CI: GitHub Secrets
3. Prod: Secret Manager (AWS/Vault)
4. Strong generation: `openssl rand -hex 32`
5. Rotation policy: 90 gün, otomatik mümkünse
6. Log redact (pino, structured)
7. URL'de secret yok, header
8. Pre-commit gitleaks hook
