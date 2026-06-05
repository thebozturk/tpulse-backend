---
name: bot-defense-captcha
keywords: "captcha, hcaptcha, turnstile, recaptcha, bot, challenge"
description: "CAPTCHA — hCaptcha, Cloudflare Turnstile, reCAPTCHA"
---

# CAPTCHA

## Provider seçimi

| Provider | Ücretsiz tier | Privacy | UX |
|----------|--------------|---------|-----|
| **Cloudflare Turnstile** | Sınırsız | İyi (privacy-first) | Çoğunlukla invisible |
| hCaptcha | 1M/ay free | İyi | Visible challenge |
| reCAPTCHA v3 | 1M/ay free | Google tracking | Score-based, invisible |
| reCAPTCHA v2 | 1M/ay free | Google tracking | "I'm not a robot" |

**Tercih: Cloudflare Turnstile** — privacy-friendly, çoğu zaman invisible, ücretsiz. Atlas için iyi seçim.

## Hangi endpoint'lerde

CAPTCHA = friction. Sadece bot saldırısına açık endpoint'lerde:

- **Register** — fake account
- **Login** — credential stuffing
- **Password reset** — email flood
- **Contact form** — spam
- **Comment/review** — spam

Her API endpoint'inde değil — UX bozar.

## Adaptive: sadece şüpheli ise

Default: CAPTCHA yok. Suspicion threshold geçilince zorla:
- 3 başarısız login ardından CAPTCHA
- Yeni IP'den register
- VPN/proxy detected

Bkz. `progressive-trust.md`, `adaptive-challenge.md`.

## Cloudflare Turnstile setup

### Frontend
```html
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
```

Form submit'te otomatik token oluşur, `cf-turnstile-response` field'ında.

### Backend verify

```typescript
@Injectable()
export class TurnstileService {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    const secret = this.config.getOrThrow('TURNSTILE_SECRET');

    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: formData },
    );

    const result = await response.json();
    return result.success === true;
  }
}
```

### Endpoint'te kullan

```typescript
@Post('register')
@Public()
@Throttle(5, 3600)
async register(@Body() dto: RegisterDto, @Ip() ip: string) {
  const valid = await this.turnstile.verify(dto.captchaToken, ip);
  if (!valid) {
    throw new BadRequestException({ code: 'CAPTCHA_FAILED', message: 'CAPTCHA failed' });
  }
  return this.userService.register(dto);
}
```

DTO:
```typescript
export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;

  @IsString()
  captchaToken: string;
}
```

## hCaptcha setup

```typescript
async verifyHcaptcha(token: string, ip?: string): Promise<boolean> {
  const params = new URLSearchParams({
    secret: process.env.HCAPTCHA_SECRET!,
    response: token,
  });
  if (ip) params.append('remoteip', ip);

  const response = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const result = await response.json();
  return result.success === true && result.score < 0.7; // hCaptcha enterprise score
}
```

## reCAPTCHA v3 (score-based)

Visible challenge yok. Her action için score (0-1, 1 = human):
```typescript
async verifyRecaptcha(token: string, action: string): Promise<{ valid: boolean; score: number }> {
  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET!,
    response: token,
  });

  const res = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
    method: 'POST',
    body: params.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = await res.json();

  return {
    valid: data.success && data.action === action && data.score >= 0.5,
    score: data.score,
  };
}
```

Score adaptive:
- `>0.7` → human, izin
- `0.3-0.7` → şüpheli, ek challenge (email verify)
- `<0.3` → reject veya MFA zorla

## Bypass token (test ortamı)

E2E test'te CAPTCHA bypass:
```typescript
async verify(token: string, ip?: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && token === 'test-bypass-token') {
    return true;
  }
  // ...real verification
}
```

CI test'leri için. Production'da `NODE_ENV=test` olmaz.

## Server-side validation ZORUNLU

```typescript
// ❌ Frontend'in "captcha geçti" demesi yetmez
if (req.body.captchaPassed === true) { ... }

// ✓ Backend Cloudflare/Google'a query atar
if (await this.turnstile.verify(req.body.captchaToken)) { ... }
```

CAPTCHA token tek kullanım, expire olur. Replay önler.

## Token kullanımı

- Form submit'te oluşur
- 5 dakika valid
- Tek kullanım (verify sonrası invalid)
- IP-bound (verify'da remoteip param)

## Anti-pattern'ler

### Frontend-only check
```typescript
// ❌ Bot frontend'i bypass eder
window.captchaPassed = true;
fetch('/api/register', { body: { captchaPassed: true } });
```

### Token expiry yok
Aynı token sonsuz kullanımı → spammer cache'ler.

### Provider yok
"CAPTCHA homemade'im" → bot 1 saatte solver yazar.

### Her endpoint'te CAPTCHA
GET/PATCH için CAPTCHA = UX katastrof.

### Bypass-able key
```typescript
const captchaSecret = 'test-secret';  // ❌ prod'da fallback
```

## Aksiyon

1. Cloudflare Turnstile (privacy + free + UX)
2. Backend verify ZORUNLU
3. Sensitive endpoint'lere uygula (register, login retry, reset)
4. Adaptive: ilk denemede yok, fail'de aktive
5. reCAPTCHA v3 score-based fine-tuning
6. Test bypass token (sadece NODE_ENV=test)
7. Token tek kullanım + 5dk expiry
