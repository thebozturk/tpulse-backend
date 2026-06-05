---
name: bot-defense-fingerprinting
keywords: "fingerprint, browser, device, identification, FingerprintJS"
description: "Browser/device fingerprinting — bot tespit ve session binding"
---

# Fingerprinting

## Ne için

Cookie'siz unique device tanıma. Kullanım:
- Account takeover detection (login farklı device'tan?)
- Multi-account abuse (aynı fingerprint, farklı user)
- Bot tespit (headless browser farklı fingerprint)
- Trust scoring

## FingerprintJS

```bash
# Frontend
pnpm add @fingerprintjs/fingerprintjs
```

```typescript
// Frontend
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const fp = await FingerprintJS.load();
const result = await fp.get();
const visitorId = result.visitorId;  // stable across sessions

// Login request'e ekle
fetch('/auth/login', {
  body: JSON.stringify({ ...credentials, fingerprint: visitorId }),
});
```

Free version: client-side, ~80% accuracy. Pro version (paid): server-side, ~99.5%, stable across browsers.

## Backend tarafı

### Login'de kaydet
```typescript
async login(dto: LoginDto, request: Request) {
  const user = await this.validateCredentials(dto);

  await this.userDeviceModel.updateOne(
    { userId: user._id, fingerprint: dto.fingerprint },
    {
      $set: {
        lastSeenAt: new Date(),
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
      $setOnInsert: { firstSeenAt: new Date() },
    },
    { upsert: true },
  );

  // First time device?
  const isNewDevice = !await this.userDeviceModel.exists({
    userId: user._id,
    fingerprint: dto.fingerprint,
    firstSeenAt: { $lt: new Date(Date.now() - 5000) },
  });

  if (isNewDevice) {
    await this.notificationService.sendNewDeviceLoginEmail(user.email, request);
  }

  return this.issueTokens(user);
}
```

User yeni device'tan login ederse email bildirimi.

## Schema

```typescript
@Schema({ timestamps: true })
export class UserDevice {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  fingerprint: string;

  @Prop()
  userAgent?: string;

  @Prop()
  ip?: string;

  @Prop()
  firstSeenAt: Date;

  @Prop()
  lastSeenAt: Date;

  @Prop({ default: false })
  trusted: boolean;  // user "trust this device" tıkladıysa
}

UserDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
```

## Bot tespiti

Bot'lar tipik özellikler:
- Headless browser (puppeteer, playwright)
- Webdriver flag (`navigator.webdriver === true`)
- Plugin yok (`navigator.plugins.length === 0`)
- WebGL rendering anomali
- Canvas fingerprint farklı (each render slightly different = headless)
- Screen size 0x0 veya unusual
- Timezone UTC (datacenter)

FingerprintJS bu signal'leri toplar, `result.confidence.score`:
- `>0.9` → human çok büyük olasılıkla
- `0.5-0.9` → şüpheli
- `<0.5` → bot olabilir

## Multi-account abuse tespit

Aynı fingerprint farklı user → şüpheli:
```typescript
async checkFingerprintAbuse(fingerprint: string): Promise<number> {
  const distinctUsers = await this.userDeviceModel.distinct('userId', { fingerprint });
  return distinctUsers.length;
  // 1: normal
  // 2-3: aile paylaşımı olabilir
  // 5+: muhtemelen abuse
}
```

Threshold geçilince:
- Yeni register reddet (aynı fingerprint, çok hesap)
- Existing hesapları audit
- Manuel review queue

## Session fingerprint binding

JWT payload'a fingerprint hash:
```typescript
const payload = {
  sub: user._id,
  fpHash: sha256(fingerprint),
};
```

Her request'te frontend fingerprint gönderir, backend karşılaştırır:
```typescript
@Injectable()
export class FingerprintGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const tokenFp = req.user.fpHash;
    const requestFp = sha256(req.headers['x-fingerprint'] as string);

    if (tokenFp !== requestFp) {
      throw new UnauthorizedException('Device mismatch');
    }
    return true;
  }
}
```

Token çalınsa bile attacker'ın device'ından fingerprint farklı → reject.

**Trade-off:** User browser update sonrası fingerprint değişebilir → re-login gerekir.

## Privacy compliance

GDPR: fingerprinting kişisel veri. User'a bildir:
- Privacy policy'de açıkla
- Gerekirse consent al (özellikle EU)
- Sadece güvenlik amacıyla kullan, marketing değil

## Anti-pattern'ler

### Sadece fingerprint güvenlik
Fingerprint **bypass'lanabilir** (FP spoofing tools, multi-browser). Ek katmanlar:
- Email verification
- 2FA
- Behavioral analysis

### Kullanıcı engelleme tek başına fingerprint ile
Yanlış pozitif: aile bilgisayarı paylaşımı, lab/internet cafe.

### Fingerprint plain log
```typescript
logger.info({ fingerprint });  // ❌ tracking risk
```
Hash veya truncate.

### Marketing kullanımı
Fingerprint'i ad targeting'te kullanma → privacy ihlali, GDPR fine.

## Aksiyon

1. FingerprintJS frontend
2. Login/register'da fingerprint kaydet (UserDevice schema)
3. Yeni device → email notification
4. Multi-account abuse threshold (5+ user/fp)
5. JWT payload'a fingerprint hash (session binding)
6. Confidence score adaptive challenge'a feed et
7. Privacy policy update
