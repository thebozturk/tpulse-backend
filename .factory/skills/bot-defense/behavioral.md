---
name: bot-defense-behavioral
keywords: "behavioral, velocity, honeypot, pattern, mouse, timing"
description: "Behavioral analysis — velocity, honeypot, pattern detection"
---

# Behavioral Analysis

## Velocity check

Saniyede kaç istek? Bot saniyede 100, human saniyede 1.

```typescript
@Injectable()
export class VelocityService {
  async check(key: string, windowSec: number = 1): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    // Sliding window in Redis
    await this.redis.zadd(`velocity:${key}`, now, now.toString());
    await this.redis.zremrangebyscore(`velocity:${key}`, 0, windowStart);

    const count = await this.redis.zcard(`velocity:${key}`);
    await this.redis.expire(`velocity:${key}`, windowSec * 2);

    return count;
  }
}
```

Kullanım:
```typescript
const reqCount = await this.velocity.check(`user:${userId}`, 1);  // last 1 sec
if (reqCount > 50) throw new ForbiddenException('Too fast');

const loginAttempts = await this.velocity.check(`login-fail:${ip}`, 60);  // last 60 sec
if (loginAttempts > 10) throw new ForbiddenException();
```

## Honeypot field

Bot'lar her form field'ını doldurur. İnsanın görmediği gizli field "honeypot":

### Frontend
```html
<form>
  <input name="email" type="email">
  <input name="password" type="password">

  <!-- Honeypot — CSS ile gizli -->
  <input name="website" type="text" style="position:absolute;left:-9999px"
         tabindex="-1" autocomplete="off">

  <button type="submit">Login</button>
</form>
```

User görmez → boş bırakır. Bot görür → doldurur.

### Backend
```typescript
export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;

  @IsOptional() @IsString() @IsEmpty()  // ZORUNLU boş
  website?: string;
}

@Post('login')
async login(@Body() dto: LoginDto) {
  if (dto.website) {
    // Bot tespit — sessizce başarılı dön ama hiçbir şey yapma
    this.logger.warn(`Honeypot triggered from IP ${ip}`);
    return { success: true };  // 200, ama login olmadı
  }
  // Normal login
}
```

**Şirketin değil her bot'a bilgi verme** — 403 verirsen bot anlar, fix eder. 200 dön ama login yapma.

## Time-on-page check

Form submission too fast → bot.

### Frontend
```html
<input name="formStartedAt" type="hidden" value="<timestamp>">
```

Sayfa yüklenince timestamp koy.

### Backend
```typescript
const elapsed = Date.now() - parseInt(dto.formStartedAt);
if (elapsed < 2000) {
  // 2 saniyeden hızlı = bot
  throw new BadRequestException();
}
```

Insan en az 2-3 sn form doldurur.

## Mouse movement / keystroke timing

Frontend track:
```typescript
let mouseEvents = 0;
let keyEvents = 0;
document.addEventListener('mousemove', () => mouseEvents++);
document.addEventListener('keydown', () => keyEvents++);

// Form submit'te send
fetch('/login', {
  body: JSON.stringify({ ...dto, mouseEvents, keyEvents }),
});
```

Backend:
```typescript
if (dto.mouseEvents === 0 && dto.keyEvents > 0) {
  // Sadece keyboard, hiç mouse → suspicious (otomasyon)
}
if (dto.keyEvents === 0) {
  // Klavye yok → bot
}
```

False positive: keyboard-only user (accessibility). Sadece signal, hard block değil.

## Pattern: keystroke dynamics

Keystroke arası süre insan için variable, bot sabit:
```typescript
// Frontend
const intervals: number[] = [];
let lastKey = 0;
input.addEventListener('keydown', () => {
  if (lastKey) intervals.push(Date.now() - lastKey);
  lastKey = Date.now();
});

// Backend
const variance = stdDev(intervals);
if (variance < 5) {
  // Sabit interval → bot
}
```

## Sequential pattern

Aynı kullanıcı/IP'den şu pattern → bot:
- 1000 register sıralı
- Aynı password farklı email'lerle
- Sequential email (`user1@`, `user2@`, ...)
- Random ad (gibberish)

```typescript
async detectSequentialAbuse(userId: string): Promise<boolean> {
  const recent = await this.actionLog
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Aynı action 50+ kez ardışık?
  const sequential = recent.every(a => a.action === recent[0].action);
  return sequential && recent.length === 100;
}
```

## Headless browser detection

Server-side response'a inject:
```typescript
// Sayfada gizli check
window.addEventListener('DOMContentLoaded', () => {
  const checks = {
    webdriver: navigator.webdriver === true,
    plugins: navigator.plugins.length === 0,
    languages: navigator.languages.length === 0,
    notifications: !window.Notification,
  };

  fetch('/api/client-check', { body: JSON.stringify(checks) });
});
```

Backend toplar. Ama: legit user da Notification block etmiş olabilir → soft signal.

## Action log

```typescript
@Schema({ timestamps: true })
export class UserAction {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ index: true })
  ip: string;

  @Prop()
  action: string;

  @Prop()
  metadata?: any;
}

UserActionSchema.index({ userId: 1, createdAt: -1 });
UserActionSchema.index({ ip: 1, createdAt: -1 });
UserActionSchema.index({ action: 1, createdAt: -1 });
// TTL — 30 gün sonra sil
UserActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
```

Behavioral analysis için bu data gerekli.

## Anomaly detection (advanced)

ML-based:
- Login geo-jump: İstanbul'dan login, 5 dk sonra Tokyo (impossible travel)
- Time anomaly: User normalde 09-18 arası aktif, 03:00'te login

```typescript
async detectAnomaly(userId: string, currentLogin: { ip, geo, time }): Promise<number> {
  const recent = await this.userActionModel.find({ userId }).limit(50).lean();

  let anomalyScore = 0;

  // Geo distance
  const lastGeo = recent[0]?.metadata?.geo;
  if (lastGeo && distance(lastGeo, currentLogin.geo) > 500) {
    const timeDiff = (currentLogin.time - recent[0].createdAt) / 1000 / 60;  // min
    if (timeDiff < 60) anomalyScore += 0.5;  // 1 saatte 500km — impossible
  }

  // Time anomaly
  const usualHours = recent.map(r => new Date(r.createdAt).getHours());
  const currentHour = currentLogin.time.getHours();
  if (!usualHours.includes(currentHour)) anomalyScore += 0.2;

  return anomalyScore;
}
```

## Anti-pattern'ler

### Honeypot UX'te visible
```html
<input name="trap" type="text">  <!-- ❌ user da görür, doldurur -->
```

### 403 honeypot'ta
Bot anlar, fix eder. 200 dön, sessizce no-op.

### Velocity sayacı per-instance
Multi-pod'da Redis kullan, in-memory tek pod'a sınırlı.

### Behavioral signal hard block
Single signal yanlış pozitif yüksek. Combine + threshold.

### Action log infinite tutma
30 gün sonra TTL — DB patlar.

## Aksiyon

1. Velocity check (Redis sliding window)
2. Honeypot field her sensitive form'da
3. Time-on-page check (>2 sn)
4. Mouse + keystroke event count
5. Sequential pattern detection
6. Action log (TTL 30 gün)
7. Anomaly score (geo, time, fingerprint combine)
8. Single signal hard block YOK — score'a feed et
