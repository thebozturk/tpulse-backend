---
name: auth-password
keywords: "password, bcrypt, argon2, hash, complexity, reset, strength"
description: "Password hashing, complexity, reset flow"
---

# Password

## Hash algorithm seçimi

### argon2 (tercih — 2025+)

```bash
pnpm add argon2
```

```typescript
import * as argon2 from 'argon2';

async hash(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,     // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

async verify(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

**OWASP tavsiyesi.** GPU-resistant.

### bcrypt (uzun süredir standart)

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

```typescript
import * as bcrypt from 'bcryptjs';

const hash = await bcrypt.hash(password, 12);  // 12+ rounds
const match = await bcrypt.compare(password, hash);
```

**Rounds:**
- 10: ~100ms (minimum)
- 12: ~400ms (güvenli ama yavaş login)
- 14: ~1.5s (prod için güvenli)

Hash sürekli, verify sürekli. Trade-off: UX vs security.

### MD5, SHA1, SHA256 — ASLA

```typescript
// ❌ Fast → brute force 1 saniyede milyarlar
crypto.createHash('sha256').update(password).digest('hex');
```

Password hash algorithm'i **yavaş** olmalı, fast hash değil.

## Complexity kuralları

Modern yaklaşım (NIST 800-63B):
- Minimum 8 karakter
- 64+ karakter destekle
- Blocklist: common passwords (`123456`, `qwerty`, site name)
- **Karmaşıklık zorlaması KAÇIN** (harf + rakam + özel karakter)

Kullanıcı zorlanınca kolay tahmin edilen pattern kullanır (`Password1!`).

### Custom validator
```typescript
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import * as zxcvbn from 'zxcvbn';

@ValidatorConstraint({ name: 'strongPassword' })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value || value.length < 8) return false;
    const result = zxcvbn(value);
    return result.score >= 3;  // 0-4, 3+ = strong
  }

  defaultMessage() {
    return 'Password too weak. Use at least 8 chars, avoid common patterns.';
  }
}

export const IsStrongPassword = () =>
  // registerDecorator implementation
```

## zxcvbn — strength estimator

```bash
pnpm add zxcvbn
pnpm add -D @types/zxcvbn
```

Entropy-based scoring:
```typescript
import * as zxcvbn from 'zxcvbn';

const result = zxcvbn('password123');
result.score;          // 0 (weakest) - 4 (strongest)
result.feedback;       // { warning, suggestions }
result.crack_times_display.offline_fast_hashing_1e10_per_second;  // "3 seconds"
```

Blocklist (user email, name, company) için `user_inputs`:
```typescript
zxcvbn(pwd, [user.email, user.name, 'acme']);
```

## Password reset flow

### 1. Request
```typescript
@Post('reset-request')
@Public()
@Throttle(3, 300)  // 3 per 5min — abuse önlemi
async requestReset(@Body() dto: ResetRequestDto) {
  const user = await this.userService.findByEmail(dto.email);

  // USER YOKSA BİLE SUCCESS DÖN (email enumeration önlemi)
  if (user) {
    const token = randomUUID();
    const hash = await bcrypt.hash(token, 8);
    await this.redis.set(`reset:${hash}`, user._id.toString(), 'EX', 3600);
    await this.mailer.sendResetEmail(user.email, token);
  }

  return { message: 'If the email exists, a reset link has been sent' };
}
```

### 2. Confirm
```typescript
@Post('reset-confirm')
@Public()
@Throttle(5, 60)
async confirmReset(@Body() dto: ResetConfirmDto) {
  // Token'ı hash'le, redis'te ara
  const hash = await bcrypt.hash(dto.token, 8);
  const userId = await this.redis.get(`reset:${hash}`);
  if (!userId) throw new UnauthorizedException('Invalid or expired token');

  const user = await this.userService.findById(userId);
  const newHash = await this.hash(dto.newPassword);
  await this.userService.updatePassword(user._id, newHash);

  await this.redis.del(`reset:${hash}`);

  // ALL refresh token invalidate (security)
  await this.invalidateAllUserSessions(user._id);

  // Notification email (başka biri reset yaptıysa user görsün)
  await this.mailer.sendPasswordChangedNotification(user.email);
}
```

### Güvenlik kuralları

- Reset token tek kullanım (redis del)
- Expiry 1 saat
- Email'de **url güvenli token** (base64url veya UUID)
- **Reset sonrası tüm session invalidate**
- Notification email "başka biri değiştirmiş olabilir" uyarısı
- Rate limit: 3 reset request / 5dk

## Password change (logged-in user)

Mevcut password'u doğrula:
```typescript
@Post('change')
@UseGuards(JwtAuthGuard)
@Throttle(5, 60)
async change(@CurrentUser() user: User, @Body() dto: ChangeDto) {
  const currentUser = await this.userService.findById(user._id);
  const match = await this.verify(currentUser.password, dto.currentPassword);
  if (!match) throw new UnauthorizedException('Invalid current password');

  const newHash = await this.hash(dto.newPassword);
  await this.userService.updatePassword(user._id, newHash);

  // Invalidate other sessions (opsiyonel — user tercih)
  await this.invalidateOtherSessions(user._id, currentSessionId);
}
```

## Password history (repeat prevention)

```typescript
@Prop({ type: [String], select: false })
passwordHistory?: string[];  // last 5 hash

// Change
if (await this.isInHistory(user, newPassword)) {
  throw new BadRequestException('Password was used recently');
}
await userModel.updateOne({ _id }, {
  $set: { password: newHash },
  $push: { passwordHistory: { $each: [oldHash], $slice: -5 } },
});
```

Compliance için gerekli olabilir (PCI-DSS, HIPAA).

## Breached password check

`Have I Been Pwned` API:
```typescript
const hash = sha1(password).toUpperCase();
const prefix = hash.slice(0, 5);
const suffix = hash.slice(5);

const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
const lines = (await response.text()).split('\n');
const found = lines.find(line => line.startsWith(suffix));
if (found) {
  throw new BadRequestException('Password found in breach database');
}
```

## Anti-pattern'ler

### Plaintext save
```typescript
user.password = req.body.password;  // ❌
```

### Fast hash
```typescript
const hash = crypto.createHash('sha256').update(pw).digest('hex');  // ❌
```

### Reset token predictable
```typescript
const token = Date.now().toString();  // ❌ tahmin edilebilir
```

### Email enumeration
```typescript
if (!user) throw new NotFoundException('User not found');  // ❌ user var/yok leak
```

### Unused complexity
```typescript
// ❌ "Password1!" geçer ama zayıf
if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) throw ...;
```
zxcvbn tercih.

### Reset sonra session korunuyor
Password değişti ama eski token'lar hala geçerli = hacked user devam eder.

## Aksiyon

1. argon2 veya bcrypt(12+)
2. Min 8 karakter, zxcvbn score ≥3
3. Reset token: UUID, hash edilmiş, redis, 1 saat TTL
4. Reset/change sonrası session invalidate
5. HIBP kontrol opsiyonel ama önerilir
6. Rate limit: 3 reset/5min, 5 login/min
7. Notification email password değişiminde
