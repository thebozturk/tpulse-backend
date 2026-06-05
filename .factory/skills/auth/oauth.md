---
name: auth-oauth
keywords: "oauth, google, github, facebook, passport, social login"
description: "OAuth 2.0 ile 3rd-party login"
---

# OAuth (Social Login)

## Flow (Authorization Code)

```
1. User clicks "Login with Google"
   → Backend redirect: accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=...&scope=...

2. User authorize
   → Google redirect: <backend>/auth/google/callback?code=XXXX

3. Backend exchanges code for tokens
   → POST accounts.google.com/o/oauth2/token
   → { access_token, id_token, refresh_token }

4. Backend verifies id_token (JWT from Google)
   → { sub, email, name, ... }

5. Backend finds or creates user
   → Own JWT issue

6. Redirect to frontend with own JWT
```

## @nestjs/passport setup

```bash
pnpm add @nestjs/passport passport passport-google-oauth20
pnpm add -D @types/passport-google-oauth20
```

```typescript
// auth/strategies/google.strategy.ts
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { PassportStrategy } from '@nestjs/passport';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${config.get('APP_URL')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, emails, displayName, photos } = profile;
    const user = {
      googleId: id,
      email: emails[0].value,
      name: displayName,
      avatar: photos?.[0]?.value,
    };
    done(null, user);
  }
}
```

## Controller

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    // req.user has Google profile
    const { accessToken, refreshToken } = await this.authService.loginOrCreate(req.user);

    // Redirect to frontend with tokens (via cookie)
    res.cookie('refresh-token', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });
    res.redirect(`${config.get('FRONTEND_URL')}/auth/success#token=${accessToken}`);
  }
}
```

## Account linking

Same email → link account'ları:
```typescript
async loginOrCreate(profile: GoogleProfile): Promise<TokenPair> {
  // Google ID ile user var mı
  let user = await this.userModel.findOne({ 'oauth.google': profile.googleId });
  if (user) return this.issueTokens(user);

  // Email ile user var mı (account linking)
  user = await this.userModel.findOne({ email: profile.email });
  if (user) {
    // Google ID ekle, mevcut account
    user.oauth = { ...user.oauth, google: profile.googleId };
    await user.save();
    return this.issueTokens(user);
  }

  // Yeni user oluştur
  user = await this.userModel.create({
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar,
    oauth: { google: profile.googleId },
    emailVerified: true,  // Google zaten doğruladı
  });
  return this.issueTokens(user);
}
```

## Schema

```typescript
@Schema()
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ select: false })
  password?: string;  // OAuth user için null

  @Prop({
    type: Object,
    default: {},
  })
  oauth: {
    google?: string;
    github?: string;
    facebook?: string;
  };
}

UserSchema.index({ 'oauth.google': 1 });
UserSchema.index({ 'oauth.github': 1 });
```

## GitHub OAuth

```bash
pnpm add passport-github2
```

Benzer pattern. Scope: `['user:email']`. Profile format farklı — verify callback'te handle et.

## State parameter (CSRF önlemi)

```typescript
// authorize URL'e state ekle
const state = randomUUID();
session.oauthState = state;
// ...&state=${state}

// Callback'te doğrula
if (req.query.state !== req.session.oauthState) {
  throw new ForbiddenException('Invalid state — possible CSRF');
}
```

Passport built-in `state: true` option.

## Refresh token (provider-side)

Google access token 1 saatlik. Refresh için Google refresh token sakla:
```typescript
@Prop({ select: false })
googleRefreshToken?: string;

// Kullanım — Google API'ye çağrı gerekirse
async getValidGoogleAccessToken(userId: string): Promise<string> {
  const user = await userModel.findById(userId).select('+googleRefreshToken');
  const { access_token } = await googleOAuth2Client.refreshAccessToken(user.googleRefreshToken);
  return access_token;
}
```

## OAuth scope minimization

Sadece ihtiyacın olan scope:
- `profile email` — ad, email yeter
- `profile email openid` — id token dahil
- **ASLA** `https://www.googleapis.com/auth/drive` (user drive'a erişim) login için

## Email unverified

Google/GitHub email'ini verified kabul et. Ama başka provider (Facebook'ta custom email) için kontrol:
```typescript
if (!profile.emails[0].verified) {
  throw new UnauthorizedException('Unverified email');
}
```

## Logout

OAuth backend logout = own JWT invalidate. Google'da logout ayrı (Google hesabından çıkmaz).

Opsiyonel: provider-side logout için `https://accounts.google.com/logout` redirect.

## Anti-pattern'ler

### Client-side only OAuth
```typescript
// ❌ Frontend Google token'ı alır, backend'e gönderir
// Backend verify etmezse → herkes login
```

Backend token'ı Google'a query'leyerek doğrula.

### `id_token` verify etmeme
```typescript
// ❌ id_token'ın imzasını kontrol etmeme
const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64'));  // decode yeter sanma
```

`google-auth-library`'de `OAuth2Client.verifyIdToken()` kullan.

### Scope inflation
```typescript
scope: ['profile', 'email', 'gmail.read', 'drive.file']  // ❌ overreach
```

Kullanıcı korkar, consent yapmaz.

### State param yok
CSRF açığı. Her zaman state.

## Aksiyon

1. Provider için ayrı strategy (GoogleStrategy, GithubStrategy)
2. Account linking (email match)
3. `state` param ZORUNLU
4. `id_token` imzasını doğrula
5. Minimum scope
6. Schema'da `oauth: { google, github, ... }` object
7. Callback sonrası own JWT issue, cookie ile frontend'e
