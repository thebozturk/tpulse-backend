---
name: auth-jwt
keywords: "JWT, token, access, refresh, rotation, bearer, authentication"
description: "JWT access + refresh token flow with rotation"
---

# JWT Authentication

## Tasarım: access + refresh

```
Login:
  user + password → access token (15dk) + refresh token (7gün)

Request:
  Authorization: Bearer <access_token>

Access expired (401):
  client POST /auth/refresh { refreshToken }
  → new access + new refresh

Logout:
  refresh token blacklist (Redis)
```

## Setup

```bash
pnpm add @nestjs/jwt bcryptjs
pnpm add -D @types/bcryptjs
```

JwtModule:
```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: config.get<string>('JWT_EXPIRY', '15m'),
      algorithm: 'HS256',  // veya RS256 prod için
    },
  }),
}),
```

## Access token

```typescript
interface AccessTokenPayload {
  sub: string;       // user id
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

async createAccessToken(user: User): Promise<string> {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: user._id.toString(),
    email: user.email,
    roles: user.roles,
  };
  return this.jwtService.signAsync(payload);
}
```

**Short-lived (15dk).** Çalınırsa hasar az.

## Refresh token

### Strategy: rotation

Her refresh'te yeni refresh token. Eski kullanılamaz hale gelir.

```typescript
interface RefreshTokenPayload {
  sub: string;
  jti: string;  // unique token id (Redis key)
  iat: number;
  exp: number;
}

async createRefreshToken(user: User): Promise<string> {
  const jti = randomUUID();
  const payload = { sub: user._id.toString(), jti };
  const token = await this.jwtService.signAsync(payload, {
    secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
    expiresIn: '7d',
  });

  // Redis'e "valid" olarak kaydet
  await this.redis.set(`refresh:${jti}`, user._id.toString(), 'EX', 7 * 24 * 3600);

  return token;
}
```

### Refresh endpoint

```typescript
@Post('refresh')
@Public()
@Throttle(10, 60)
async refresh(@Body() dto: RefreshDto) {
  let payload: RefreshTokenPayload;
  try {
    payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
      dto.refreshToken,
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') },
    );
  } catch {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // Redis'te valid mi
  const userId = await this.redis.get(`refresh:${payload.jti}`);
  if (!userId || userId !== payload.sub) {
    // Token revoked veya reuse edildi — tüm session'ları temizle (paranoia)
    await this.invalidateAllUserSessions(payload.sub);
    throw new UnauthorizedException('Refresh token invalid');
  }

  // ESKI REFRESH TOKEN'I İPTAL ET (rotation)
  await this.redis.del(`refresh:${payload.jti}`);

  // Yeni pair üret
  const user = await this.userService.findById(payload.sub);
  const accessToken = await this.createAccessToken(user);
  const refreshToken = await this.createRefreshToken(user);

  return { accessToken, refreshToken };
}
```

### Token reuse detection

Rotation yapılmış refresh token yeniden kullanılırsa = çalınmış. Tüm session'ları invalidate et:

```typescript
async invalidateAllUserSessions(userId: string): Promise<void> {
  const keys = await this.redis.keys(`refresh:*`);
  for (const key of keys) {
    const val = await this.redis.get(key);
    if (val === userId) await this.redis.del(key);
  }
}
```

Kullanıcı re-login zorunda kalır — güvenlik için kabul edilir.

## Algorithm seçimi

### HS256 (symmetric)
- Tek secret
- Basit
- Aynı secret sign + verify
- **Risk:** Secret leak → token forge

### RS256 (asymmetric)
- Private key sign, public key verify
- Microservice için ideal (verify-only service'ler public key'le)
- **Overhead:** Key management

Production: RS256 tercih. Dev'de HS256 OK.

### None algorithm — ASLA

```typescript
// ❌
jwt.verify(token, secret, { algorithms: ['none'] });
```
Bazı libraryler default `none` kabul eder — signature-less token. Her zaman explicit algorithm locked:

```typescript
jwt.verify(token, secret, { algorithms: ['HS256'] });  // ✓
```

## Token storage (client-side)

### httpOnly cookie (tercih)
```typescript
response.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 3600 * 1000,
});
```

JS'ten okunamaz, XSS'e dayanıklı.

### localStorage
XSS ile çalınır — **KAÇIN**.

### memory (access token için)
Kısa-ömürlü access token memory'de OK. Refresh httpOnly cookie.

## Session binding

Token'ı device'a bağla:
```typescript
const payload = {
  sub: user._id,
  deviceId: crypto.createHash('sha256').update(request.headers['user-agent']).digest('hex'),
  ip: request.ip,
};
```

Token farklı device'tan gelirse reject. (User-friendly değil — mobile kullanımda sorun. Opsiyonel.)

## Logout

```typescript
@Post('logout')
async logout(@CurrentUser() user: User, @Body() dto: LogoutDto) {
  const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
    secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
  });
  await this.redis.del(`refresh:${payload.jti}`);
}

@Post('logout-all')
async logoutAll(@CurrentUser() user: User) {
  await this.invalidateAllUserSessions(user._id);
}
```

## Anti-pattern'ler

### Refresh token DB'de plaintext
```typescript
// ❌
await userModel.updateOne({ _id }, { $set: { refreshToken: token } });
```
DB leak = herkes login. Hash'le:
```typescript
const hash = await bcrypt.hash(token, 8);
await userModel.updateOne({ _id }, { $set: { refreshTokenHash: hash } });
```

### Access token uzun-ömürlü
```typescript
signOptions: { expiresIn: '30d' }  // ❌ 30 gün — riski büyük
```
15dk-1saat. Daha uzun → refresh token ile.

### Algorithm unspecified
```typescript
jwt.verify(token, secret);  // ❌ algorithm tahmin
```

### Rotation yok
Refresh token hep aynı → çalınırsa sonsuza kadar erişim.

### Blacklist yerine statik TTL
Logout sonrası token'ı bir süre daha geçerli. Redis ile blacklist zorunlu.

## Aksiyon

1. Access (15dk) + refresh (7gün) ikili
2. Refresh rotation (her kullanımda yeni)
3. Redis'te refresh JTI track
4. Reuse detection → all sessions invalidate
5. httpOnly cookie client storage
6. RS256 prod'da
7. Algorithm locked (`algorithms: ['HS256']`)
8. Logout = Redis delete
