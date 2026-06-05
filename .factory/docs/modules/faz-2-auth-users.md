# faz-2-auth-users

> TransferPulse Faz 2. Kaynak: docs/02 (auth+users endpoint'leri), docs/03 (validation/DTO/servis sözleşmeleri), docs/04 §1-2 (JWT/bcrypt/refresh/reset/Google).

## Amaç

Tam kimlik akışı: register/login/refresh(rotation)/logout/revoke-all/forgot+reset-password/google + Admin UsersModule CRUD. Gerçek `JwtStrategy` + global `JwtAuthGuard` (Faz 0 iskeleti doldurulur). Email (nodemailer) + Google login.

## Alınan teknik kararlar

- **Parola hash:** `bcryptjs` (saf JS, work factor 12) — alpine'de native build derdi yok.
- **Refresh token at rest:** **SHA-256 hash'li** saklanır. Client opaque ham token tutar; sunucu geleni hashleyip `refresh_tokens.token` (hash) ile arar. `replacedByToken` da hash. DB sızıntısında token'lar kullanılamaz. Contract değişmez.
- **Email:** `@nestjs-modules/mailer` + `nodemailer`. SMTP_HOST doluysa gerçek gönderim; boşsa **stream/json transport + LOG** (docs/04 "Email:Enabled=false → log" davranışı). Test SMTP'siz çalışır.
- **Google:** `google-auth-library` `OAuth2Client.verifyIdToken`. `GOOGLE_AUTH_CLIENT_ID` boşsa endpoint `503 ServiceUnavailable` ("Google login disabled").
- **Global guard:** `JwtAuthGuard` artık **APP_GUARD** (default-secure). Public uçlar `@Public()` ile bypass (auth controller, health). Faz 3 katalog uçları `@Public` alacak.

## Endpoint'ler (docs/02 — birebir)

### AuthController — `api/auth` (@Public, @Throttle auth 30/dk)
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/register` | RegisterDto | 200 AuthResponseDto / 400 / 409 (email/username) |
| POST | `/login` | LoginDto | 200 AuthResponseDto / 401 |
| POST | `/forgot-password` | `{email}` | 200 `{success,message}` (HER ZAMAN 200) |
| POST | `/reset-password` | ResetPasswordDto | 200 / 400 |
| POST | `/refresh` | `{refreshToken}` | 200 `{accessToken,refreshToken,expiresAt}` / 401 (rotation) |
| POST | `/logout` | `{refreshToken}` | 200 (auth değil — token ile revoke) |
| POST | `/revoke-all` | — | 200 (auth gerekli — @CurrentUser) |
| POST | `/google` | `{idToken}` | 200 AuthResponseDto / 400 / 503 |

> NOT: docs/02'de register/login **200** döner (201 değil). Birebir koru. `revoke-all` auth'lu; `logout` body'deki refresh token'ı revoke eder (auth opsiyonel).

### UsersController — `api/users` (Admin: JwtAuthGuard+RolesGuard @Roles('Admin'), @Throttle write)
| Method | Route | Response |
|---|---|---|
| POST | `/users` | 201 UserDto / 409 |
| GET | `/users/:id` | 200 `{data:UserDto}` / 404 |
| GET | `/users?page&pageSize` | 200 paged UserDto |
| PUT | `/users/:id` | 200 / 400 (id mismatch) / 404 |
| DELETE | `/users/:id` | 204 / 404 |

## JWT (docs/04 §1)

- HS256, secret `JWT_SECRET`. issuer `TransferPulse`, audience `TransferPulseApp`, ClockSkew 0.
- Access ömrü 15dk (`JWT_ACCESS_EXPIRY`). Claim'ler: `sub`(userId), `email`, `unique_name`(username), `nickname`, `role`, `jti`.
- `JwtStrategy.validate(payload)` → `AuthUser { userId: sub, email, username: unique_name, role }` (request.user).

## Refresh token rotation (docs/04 §1)

- Üretim: 64 rastgele byte → hex (ham). SHA-256 hash DB'ye (`refresh_tokens`), ham client'a. Ömür 90 gün (`JWT_REFRESH_EXPIRY_DAYS`).
- `/refresh`: geleni hashle → aktif (revoked değil, expired değil) kaydı bul → revoke (revokedAt + replacedByToken=yeniHash) + yeni üret. Geçersizse 401.
- `/logout`: gelen refresh token'ı hashle → revoke (tek).
- `/revoke-all`: kullanıcının tüm aktif refresh token'larını revoke.

## Şifre sıfırlama (docs/04 §1)

- `forgot-password`: email'e bağlı user bul; varsa 32-byte token üret → **SHA-256 hash** `password_reset_token`'a, ham token email/log ile. TTL 60dk (`PASSWORD_RESET_TOKEN_MINUTES`). **Her zaman 200** (enumeration-safe).
- `reset-password`: token'ı hashle → kullanıcının aktif (usedAt null, expiresAt>now) kaydını bul → parola politikası (min8 + [A-Z][a-z][0-9]) → passwordHash güncelle, usedAt set, **tüm refresh token revoke**.
- Email link: `{PASSWORD_RESET_URL_BASE}?email={enc}&token={raw}`.

## Validation (docs/03 §3)

- **RegisterDto:** username 3-50 · email · password min8 + `@Matches([A-Z])([a-z])([0-9])` · nickname max50 · favouriteTeam? 
- **LoginDto:** email · password (required)
- **ResetPasswordDto:** email · token · newPassword (politika)
- **CreateUserDto:** username, email, password, nickname, profilePic?, favouriteTeam?
- **UpdateUserDto:** id, nickname?, profilePic?, favouriteTeam?
- Tüm DTO'lar `@ApiProperty` + class-validator (.claude/rules/dto.md). Password `@MaxLength(72)`.

## DTO'lar (docs/03 §5)

- **UserDto (response):** id, username, email, nickname, profilePic?, isMailConfirm, status, favouriteTeam?, reputationScore, role, createdAt. (passwordHash YOK)
- **AuthResponseDto:** accessToken, refreshToken, expiresAt, user:UserDto

## Dosya yapısı

```
src/auth/
├─ auth.module.ts              # PassportModule + JwtModule.registerAsync + providers
├─ auth.controller.ts
├─ auth.service.ts             # register/login/google/logout/revokeAll orkestrasyon
├─ token.service.ts           # access JWT + refresh üret/rotate/revoke (hash'li)
├─ password.service.ts        # bcryptjs hash/verify + forgot/reset flow
├─ strategies/jwt.strategy.ts # passport-jwt → AuthUser
└─ dto/ (register, login, refresh-token, google-auth, forgot-password,
          reset-password, auth-response, user-response)
src/users/
├─ users.module.ts
├─ users.controller.ts
├─ users.service.ts
└─ dto/ (create-user, update-user, user-response)  # user-response auth ile paylaşılır
src/email/
├─ email.module.ts            # MailerModule.forRootAsync (SMTP veya stream transport)
└─ email.service.ts           # sendPasswordReset(email, rawToken)
src/common/guards/jwt-auth.guard.ts   # mevcut; APP_GUARD olarak app.module'a eklenir
```
app.module.ts: `AuthModule`, `UsersModule`, `EmailModule` import; `APP_GUARD` JwtAuthGuard; ThrottlerModule named policy'ler (auth 30/dk, write 120/dk).

## Paketler

`bcryptjs google-auth-library @nestjs-modules/mailer nodemailer` + dev `@types/bcryptjs @types/nodemailer`. (@nestjs/jwt, passport-jwt zaten var.)

## Env (yeni — .env.example + zod + configuration)

```
JWT_ACCESS_EXPIRY=15m
JWT_ISSUER=TransferPulse
JWT_AUDIENCE=TransferPulseApp
JWT_REFRESH_EXPIRY_DAYS=90
PASSWORD_RESET_TOKEN_MINUTES=60
PASSWORD_RESET_URL_BASE=http://localhost:3000/reset-password
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=no-reply@transferpulse.app
# GOOGLE_AUTH_CLIENT_ID, SMTP_HOST/USERNAME/PASSWORD zaten placeholder
```

## Throttler (docs/04 §7.5)

`ThrottlerModule.forRoot([{name:'default',ttl:60000,limit:300},{name:'auth',ttl:60000,limit:30},{name:'write',ttl:60000,limit:120}])`. Auth controller `@Throttle({auth:{...}})`, mutating uçlar `@Throttle({write:{...}})`. 
> NOT: 'write' Faz 2'de IP-bazlı (per-user tracker Faz 8 hardening).

## Test

- **Unit:** `password.service.spec` (hash/verify, reset token doğrulama, enumeration-safe forgot) · `token.service.spec` (access claim'leri, refresh hash + rotation, expired/revoked reddi) · `auth.service.spec` (register 409, login 401) · `users.service.spec` (create 409, findById 404, update id-mismatch 400) · `jwt.strategy.spec` (payload→AuthUser).
- **E2E (test/, infra'lı):** register→login→refresh→logout→revoke-all akışı; Admin guard 403; parola politikası 400; forgot-password her zaman 200.

## Doğrulama (docs/06 Faz 2)

- [ ] register→login→refresh→logout→revoke-all çalışır; JWT claim'leri docs/04 ile aynı.
- [ ] Admin olmayan `/users` → 403; geçersiz parola → 400.
- [ ] forgot-password her zaman 200 (var/yok sızdırmaz); reset → parola değişir + refresh'ler revoke.
- [ ] refresh rotation: eski token tekrar kullanılırsa 401.
- [ ] Google: GOOGLE_AUTH_CLIENT_ID boşsa 503.
- [ ] `tsc --noEmit` + `lint` + unit test temiz; e2e (infra ile) yeşil.

## Build sırası

1. Paketler + env (zod/configuration/.env.example).
2. DTO'lar (auth + users).
3. EmailModule/Service.
4. PasswordService (bcryptjs + reset) + TokenService (JWT + refresh hash/rotation).
5. JwtStrategy + JwtAuthGuard'ı APP_GUARD yap.
6. AuthService + AuthController.
7. UsersService + UsersController.
8. app.module wiring (modüller + named throttler + global guard) + @Public health'e zaten var.
9. Unit + e2e + tsc + lint + commit.

## Sonraki faz

Faz 3 — Katalog (okuma) + Search: leagues/teams/players/transfers/rumours/news okuma uçları, pg_trgm search, OptionalJwtGuard. Çoğu uç `@Public`.
