---
name: bot-defense-progressive-trust
keywords: "trust, level, progressive, score, tier, stairs"
description: "4-level trust system — yeni user'dan trusted user'a"
---

# Progressive Trust

## Kavram

User trust score'u yavaş yavaş kazanır. Yeni hesap kısıtlı, eski + iyi davranışlı hesap rahat.

## 4 seviye

```
Level 0 — UNTRUSTED (yeni hesap, ilk 24 saat)
Level 1 — BASIC (email verified, 1+ gün)
Level 2 — VERIFIED (telefon verified, 7+ gün, 0 abuse)
Level 3 — TRUSTED (30+ gün aktif, 0 abuse, kullanım pattern'i sağlıklı)
```

## Schema

```typescript
@Schema({ timestamps: true })
export class User {
  @Prop({ default: 0, min: 0, max: 3 })
  trustLevel: number;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ default: 0 })
  trustScore: number;  // continuous 0-100, bonus için

  @Prop({ default: 0 })
  abuseFlagCount: number;

  @Prop()
  lastTrustReviewAt?: Date;
}
```

## Trust seviye karar logic

```typescript
@Injectable()
export class TrustService {
  async calculateLevel(user: User): Promise<number> {
    const accountAgeDays = (Date.now() - user.createdAt.getTime()) / 1000 / 3600 / 24;

    // Disqualifiers — abuse history
    if (user.abuseFlagCount >= 3) return 0;

    // Level 3
    if (
      user.emailVerified &&
      user.phoneVerified &&
      accountAgeDays >= 30 &&
      user.abuseFlagCount === 0 &&
      user.trustScore >= 70
    ) return 3;

    // Level 2
    if (
      user.emailVerified &&
      user.phoneVerified &&
      accountAgeDays >= 7
    ) return 2;

    // Level 1
    if (user.emailVerified && accountAgeDays >= 1) return 1;

    // Level 0 — yeni
    return 0;
  }

  async recalculate(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    const newLevel = await this.calculateLevel(user);
    if (user.trustLevel !== newLevel) {
      await this.userModel.updateOne(
        { _id: userId },
        { trustLevel: newLevel, lastTrustReviewAt: new Date() },
      );
    }
  }
}
```

Cron job: günlük her active user için recalculate.

## Per-level kısıtlamalar

```typescript
const trustPolicy = {
  0: {
    canPostComment: false,
    canSendMessage: false,
    dailyApiLimit: 100,
    requireCaptchaOnLogin: true,
    requireMfaOnLogin: false,
    canCreateApiKey: false,
    fileUploadMaxMb: 1,
    canBuyPaid: false,  // payment requires verification
    canExport: false,
  },
  1: {
    canPostComment: true,
    canSendMessage: true,
    dailyApiLimit: 1000,
    requireCaptchaOnLogin: false,  // ama suspicion'da yine zorla
    fileUploadMaxMb: 5,
    canBuyPaid: false,  // hala payment için verified gerek
    canExport: false,
  },
  2: {
    canPostComment: true,
    canSendMessage: true,
    dailyApiLimit: 10000,
    requireCaptchaOnLogin: false,
    fileUploadMaxMb: 50,
    canBuyPaid: true,
    canExport: true,
    canCreateApiKey: true,  // 1 max
    apiKeyLimit: 1,
  },
  3: {
    canPostComment: true,
    canSendMessage: true,
    dailyApiLimit: 100000,
    requireCaptchaOnLogin: false,
    fileUploadMaxMb: 500,
    canBuyPaid: true,
    canExport: true,
    apiKeyLimit: 10,
    bulkOperations: true,  // batch import vs.
  },
};
```

## Decorator + guard

```typescript
export const RequireTrust = (minLevel: number) => SetMetadata('minTrust', minLevel);

@Injectable()
export class TrustGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<number>('minTrust', ctx.getHandler());
    if (!required) return true;

    const user = ctx.switchToHttp().getRequest().user;
    if (user.trustLevel < required) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_TRUST',
        message: `This action requires trust level ${required}, you have ${user.trustLevel}`,
        action: this.suggestUpgrade(user),
      });
    }
    return true;
  }

  private suggestUpgrade(user: User): string {
    if (!user.emailVerified) return 'verify_email';
    if (!user.phoneVerified) return 'verify_phone';
    return 'wait_for_account_aging';
  }
}
```

Kullanım:
```typescript
@Post('export-data')
@RequireTrust(2)
@UseGuards(JwtAuthGuard, TrustGuard)
async exportData() { ... }
```

## Trust score (continuous 0-100)

Discrete level dışında daha granular:

### Pozitif sinyaller (artırır)
- Account age: +1/gün (max 30)
- Email verified: +5
- Phone verified: +10
- Successful purchase: +5/each
- 0 fail authentication this month: +5

### Negatif sinyaller (azaltır)
- Failed login: -2
- Reported by another user: -10
- IP reputation low: -5
- Velocity violation: -3
- Honeypot tetikledi: -20 (anında 0)

```typescript
async updateScore(userId: string, delta: number): Promise<void> {
  await this.userModel.updateOne(
    { _id: userId },
    [
      {
        $set: {
          trustScore: {
            $max: [0, { $min: [100, { $add: ['$trustScore', delta] }] }],
          },
        },
      },
    ],
  );
}
```

## Adaptive throttle

Trust level → rate limit:
```typescript
const limit = trustPolicy[user.trustLevel].dailyApiLimit;
```

Throttler guard'da dynamic limit (custom override).

## Trust loss

Bir kez kaybedilen trust'ı kazanmak zor:
- Honeypot tetikleyen → Level 0'a düşer, 30 gün geri kazanmaz
- 3 abuse flag → permanent suspect
- Manuel admin review trust restore

## UX

Frontend trust level'ı göster:
```
Hesap durumu: ✓ Verified (Level 2)
Daha fazla özellik için: telefon doğrula, 30 gün kullanım sonrası Trusted olur
```

Şeffaflık: kullanıcı niye kısıtlı olduğunu bilsin.

## Anti-pattern'ler

### Trust seviyesi cache yok
Her request'te DB query → yavaş. JWT payload'ında trustLevel taşı, recalculate nadiren (login'de + cron).

### Hard cutoff
Trust 0 = hiçbir şey yapamaz → user umutsuz, leave eder.
Level 0 yine login + read OK, sadece sensitive op kısıtlı.

### Trust restore tek tıkla
```typescript
// ❌ Admin "trust" tıklar, level 3 olur
```
Audit + multi-step approval.

### Trust score frontend'den manipüle edilebilir
Asla. Sadece backend hesaplar.

## Aksiyon

1. 4 level: 0/1/2/3 (untrusted → trusted)
2. JWT payload'da trustLevel taşı
3. Cron job: günlük recalculate
4. Per-level policy table
5. RequireTrust decorator + TrustGuard
6. Trust score (continuous) bonus için
7. Loss kuralları sıkı
8. UX'te şeffaf — kullanıcı seviyesini görsün
