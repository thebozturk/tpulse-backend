---
name: mongodb-security
keywords: "nosql injection, select false, sanitize, escape, connection string"
description: "MongoDB-spesifik security pattern'ları"
---

# MongoDB Security

## NoSQL injection

### $where yasak
```typescript
// ❌ ÇOK KÖTÜ — arbitrary JS execution
userModel.find({ $where: req.query.filter });
```
Kullanıcı `'function() { while(true) {} }'` göndersin → DB DoS.

### Operator injection
```typescript
// User gönderir: { "email": { "$ne": null } }
userModel.findOne(req.body);
// → tüm user'lar dönebilir (auth bypass)
```

**Çözüm:** DTO + whitelist. Operator'ları kabul etme:
```typescript
export class LoginDto {
  @IsEmail()
  email: string;  // artık sadece string, object değil

  @IsString()
  password: string;
}
```

`forbidNonWhitelisted: true` ile extra field reddedilir.

### Regex injection
```typescript
// ❌
userModel.find({ name: { $regex: req.query.search } });
```

User `.*` gönderirse → tüm user'ları match. Daha beteri `(.*)+(.*)+(.*)+$` → ReDoS (CPU harcar).

**Çözüm:**
```typescript
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const safeSearch = escapeRegex(req.query.search);
userModel.find({ name: { $regex: safeSearch, $options: 'i' } });

// Hala ReDoS riski — length sınırla
if (safeSearch.length > 50) throw new BadRequestException();
```

## select: false (password leak)

Schema:
```typescript
@Prop({ required: true, select: false })
password: string;
```

Default query'lerde password dönmez:
```typescript
await userModel.findOne({ email });
// { _id, email, name, ... }  — password YOK
```

Login için explicit include:
```typescript
await userModel.findOne({ email }).select('+password');
// Şimdi password dahil
```

**ZORUNLU** her hassas field'da (security-gate BLOCK eder yoksa):
- `password`
- `refreshTokenHash`
- `mfaSecret`
- `totpSecret`
- `apiKeyHash`

## Connection string güvenliği

```typescript
// ❌ Hardcoded
const uri = 'mongodb://admin:password@prod-db:27017/acme';

// ✓ Env
const uri = process.env.DATABASE_URL;
```

Connection string **log'a atma**:
```typescript
// ❌ Credentials visible
logger.log(`Connecting to ${DATABASE_URL}`);

// ✓ Sanitize
logger.log(`Connecting to DB (host hidden)`);
```

## TLS / SSL

Production'da:
```
mongodb://user:pass@host/db?tls=true&replicaSet=rs0
```

Certificate validation:
```typescript
MongooseModule.forRootAsync({
  useFactory: () => ({
    uri: process.env.DATABASE_URL,
    tls: true,
    tlsCAFile: '/etc/ssl/mongo-ca.pem',
    tlsAllowInvalidCertificates: false,  // prod'da false
  }),
});
```

## Auth

Production MongoDB auth mutlaka aktif:
```yaml
# docker-compose (dev)
mongo:
  environment:
    - MONGO_INITDB_ROOT_USERNAME=admin
    - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ADMIN_PASSWORD}
```

Atlas managed MongoDB default authenticated.

### Per-app user
Root user'la bağlanma. Uygulama için user oluştur:
```javascript
// mongosh
use acme
db.createUser({
  user: 'acme_app',
  pwd: 'strong-pw',
  roles: [{ role: 'readWrite', db: 'acme' }],
});
```

App connection string: `mongodb://acme_app:pw@host/acme`.

## Role-based access

- `readWrite` — read + write
- `readOnly` — read
- `dbAdmin` — admin ops
- `clusterAdmin` — cluster ops

Uygulama user'ı sadece `readWrite`. DB admin ayrı user.

## Field-level encryption (CSFLE)

PII için:
- Email → hashed index (deterministic encryption)
- SSN → random encryption
- PHI data → client-side encrypt

Basit yaklaşım:
```typescript
import * as crypto from 'crypto';

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
```

Schema:
```typescript
@Prop({ type: String, required: true })
encryptedSSN: string;

@Prop({ type: String, index: true })  // hash for search
ssnHash: string;
```

## Backup encryption

Dump dosyaları encrypt:
```bash
mongodump --uri=$DATABASE_URL --archive | \
  openssl enc -aes-256-cbc -pass file:./backup-key > backup.enc
```

Restore için decrypt.

## Audit log

Her sensitive op için audit:
```typescript
@Injectable()
export class AuditService {
  async log(actor: string, action: string, target: string, diff?: any) {
    await this.auditModel.create({
      actor,
      action,  // 'user.delete', 'payment.refund'
      target,
      diff,
      at: new Date(),
      ip: this.requestContext.ip,
    });
  }
}
```

Audit collection TTL'siz (forever).

## Anti-pattern'ler

### Direct req.body to query
```typescript
// ❌
userModel.find(req.body);
```

### Regex without escape
```typescript
// ❌
model.find({ field: { $regex: req.query.q } });
```

### Root user in production
```typescript
// ❌ DATABASE_URL=mongodb://root:pw@...
```

### Password logging
```typescript
// ❌
logger.debug(`Login attempt`, { body: req.body });  // password içerir
```

### Audit collection'a yazmama
"Sensitive op log'lanmıyor" → forensic impossible.

## Aksiyon

1. DTO + whitelist ile query'e operator geçmesin
2. Hassas field'larda `select: false`
3. Regex user input escape
4. Connection string env'den, log'a atma
5. Production TLS + auth
6. App user `readWrite` only (root değil)
7. PII field encrypt (opsiyonel, compliance)
8. Audit log her sensitive op için
