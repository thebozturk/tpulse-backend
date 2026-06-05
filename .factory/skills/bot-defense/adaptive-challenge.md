---
name: bot-defense-adaptive-challenge
keywords: "adaptive, challenge, suspicion, dynamic, mfa, captcha, escalation"
description: "Suspicion → progressive challenge escalation"
---

# Adaptive Challenge

## Kavram

Sabit kural yok. Suspicion score'u hesapla → ona göre challenge'ı arttır.

```
Score 0.0 - 0.3 → Allow (no challenge)
Score 0.3 - 0.5 → Email OTP (one-time)
Score 0.5 - 0.7 → CAPTCHA + Email OTP
Score 0.7 - 0.9 → CAPTCHA + SMS OTP + new device challenge
Score 0.9 - 1.0 → Block + manual review queue
```

## Suspicion score collection

Tüm signal'leri topla, weighted sum:

```typescript
@Injectable()
export class SuspicionService {
  async calculate(context: {
    userId?: string;
    ip: string;
    fingerprint?: string;
    action: string;
    request: Request;
  }): Promise<number> {
    let score = 0;

    // 1. IP reputation (0-0.4)
    const ipScore = await this.ipReputation.getRiskScore(context.ip);
    score += ipScore * 0.4;

    // 2. Velocity (0-0.3)
    const recentRequests = await this.velocity.check(`ip:${context.ip}`, 60);
    if (recentRequests > 100) score += 0.3;
    else if (recentRequests > 30) score += 0.15;

    // 3. Failed auth recent (0-0.3)
    if (context.userId || context.action === 'login') {
      const failKey = context.userId ? `user:${context.userId}` : `ip:${context.ip}`;
      const fails = await this.velocity.check(`fail:${failKey}`, 3600);  // 1h
      if (fails > 5) score += 0.3;
      else if (fails > 2) score += 0.15;
    }

    // 4. New device (0-0.2)
    if (context.userId && context.fingerprint) {
      const isKnown = await this.userDeviceModel.exists({
        userId: context.userId,
        fingerprint: context.fingerprint,
      });
      if (!isKnown) score += 0.2;
    }

    // 5. Geo anomaly (0-0.3)
    if (context.userId) {
      const anomaly = await this.detectGeoAnomaly(context.userId, context.ip);
      score += anomaly;
    }

    // 6. Trust level discount (negative)
    if (context.userId) {
      const user = await this.userModel.findById(context.userId).lean();
      score -= user.trustLevel * 0.1;  // Level 3 user → -0.3
    }

    return Math.max(0, Math.min(1, score));
  }
}
```

## Challenge escalation

```typescript
@Injectable()
export class ChallengeService {
  async getRequiredChallenges(score: number): Promise<Challenge[]> {
    if (score < 0.3) return [];
    if (score < 0.5) return ['email_otp'];
    if (score < 0.7) return ['captcha', 'email_otp'];
    if (score < 0.9) return ['captcha', 'sms_otp', 'device_confirm'];
    return ['block'];  // hard
  }
}

type Challenge = 'captcha' | 'email_otp' | 'sms_otp' | 'device_confirm' | 'block';
```

## Login flow with adaptive challenge

```typescript
@Post('login')
@Public()
@Throttle(10, 60)
async login(@Body() dto: LoginDto, @Req() req: Request) {
  // 1. Credential check
  const user = await this.authService.validateCredentials(dto);
  if (!user) {
    await this.recordFailedLogin(dto.email, req.ip);
    throw new UnauthorizedException();
  }

  // 2. Calculate suspicion
  const score = await this.suspicion.calculate({
    userId: user._id.toString(),
    ip: req.ip,
    fingerprint: dto.fingerprint,
    action: 'login',
    request: req,
  });

  // 3. Challenges?
  const challenges = await this.challenge.getRequiredChallenges(score);

  if (challenges.includes('block')) {
    throw new ForbiddenException({
      code: 'BLOCKED',
      message: 'Login blocked due to security concerns',
    });
  }

  if (challenges.length > 0) {
    // Pending challenge state — login değil yet
    const challengeId = await this.challenge.create(user._id, challenges, dto);
    return {
      requiresChallenge: true,
      challengeId,
      challenges,  // ['captcha', 'email_otp']
    };
  }

  // No challenge → proceed
  return this.issueTokens(user);
}

@Post('challenge/:id/verify')
@Public()
async verifyChallenge(@Param('id') id: string, @Body() dto: ChallengeVerifyDto) {
  const challenge = await this.challenge.get(id);
  if (!challenge) throw new NotFoundException();

  await this.challenge.verify(id, dto);  // throws if invalid

  if (challenge.isComplete()) {
    return this.issueTokens(challenge.userId);
  } else {
    return { remainingChallenges: challenge.remaining };
  }
}
```

## Frontend flow

```typescript
async function login(email, password) {
  const fp = await getFingerprint();

  let response = await api.post('/auth/login', {
    email, password, fingerprint: fp,
  });

  if (response.requiresChallenge) {
    for (const challenge of response.challenges) {
      switch (challenge) {
        case 'captcha':
          await showCaptcha();
          break;
        case 'email_otp':
          await promptForEmailCode();
          break;
        case 'sms_otp':
          await promptForSmsCode();
          break;
        case 'device_confirm':
          await waitForDeviceConfirm();  // user phone'una notification
          break;
      }

      response = await api.post(`/auth/challenge/${response.challengeId}/verify`, {
        type: challenge,
        code: ...,
      });
    }
  }

  // Tokens
  return response;
}
```

## Challenge state

Redis'te 5 dakika TTL:
```typescript
@Injectable()
export class ChallengeStorage {
  async create(userId: string, challenges: Challenge[], context: any): Promise<string> {
    const id = randomUUID();
    await this.redis.set(
      `challenge:${id}`,
      JSON.stringify({ userId, challenges, completed: [], context }),
      'EX',
      300,  // 5 min
    );
    return id;
  }

  async markComplete(id: string, type: Challenge): Promise<void> {
    const data = JSON.parse(await this.redis.get(`challenge:${id}`));
    data.completed.push(type);
    await this.redis.set(`challenge:${id}`, JSON.stringify(data), 'EX', 300);
  }
}
```

## Geo anomaly detection

```typescript
async detectGeoAnomaly(userId: string, currentIp: string): Promise<number> {
  const last = await this.userActionModel
    .findOne({ userId })
    .sort({ createdAt: -1 })
    .lean();

  if (!last?.metadata?.geo) return 0;

  const currentGeo = await this.geoLookup.lookup(currentIp);
  const distance = haversine(last.metadata.geo, currentGeo);  // km
  const minutes = (Date.now() - last.createdAt.getTime()) / 1000 / 60;

  // Impossible travel: 1000 km / 60 dk → uçaktan hızlı
  const speed = distance / (minutes / 60);  // km/h

  if (speed > 900) return 0.5;  // ses hızı üstü
  if (speed > 500) return 0.3;
  if (distance > 1000 && minutes < 60) return 0.4;
  return 0;
}
```

## Action-spesifik suspicion

Her action için farklı baseline:
```typescript
const baselineSuspicion = {
  login: 0.2,                  // her zaman bir miktar şüphe
  password_reset: 0.4,         // hassas
  email_change: 0.5,
  payment: 0.5,
  withdraw: 0.7,               // çok hassas
  delete_account: 0.6,
  api_key_create: 0.5,
};

const totalScore = baselineSuspicion[action] + dynamicScore;
```

## Audit logging

Her challenge tetikleme + verify audit'e:
```typescript
await this.audit.log({
  actor: userId,
  action: 'auth.challenge.required',
  target: userId,
  metadata: { score, challenges, ip, fingerprint },
});
```

Daha sonra ML model train edilebilir (true positive / false positive).

## Anti-pattern'ler

### Tek bir signal'a karar verme
IP düşük score → block. False positive yüksek. Combine.

### Score recalculate her request'te ML
ML model her request'te çalıştırma → yavaş. Cache (per-session veya per-action).

### Kullanıcıya neden challenge zorunlu olduğunu söyleme (over-share)
"IP reputation düşük, datacenter'dan, son 5 dk'da 50 fail" → attacker'a feedback. Generic mesaj: "Additional verification needed."

### Trust user'lara da challenge zorla
Level 3 trusted user her login'de OTP → user vazgeçer. Trust seviyesi indirim ver.

## Aksiyon

1. SuspicionService — multiple signal weighted sum
2. ChallengeService — score → challenge list
3. Challenge state Redis (5 dk TTL)
4. Geo anomaly detection (impossible travel)
5. Action-specific baseline
6. Trust level discount
7. Audit her challenge tetikleme
8. Generic user message (over-share yok)
