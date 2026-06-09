import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient?: OAuth2Client;
  private readonly googleClientId?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly verification: EmailVerificationService,
  ) {
    this.googleClientId = this.config.get<string>('google.authClientId');
    if (this.googleClientId) {
      this.googleClient = new OAuth2Client(this.googleClientId);
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException(
        'E-posta veya kullanıcı adı zaten kullanımda',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        nickname: dto.nickname,
        favouriteTeam: dto.favouriteTeam,
      },
    });
    this.logger.log(`Kullanıcı kaydı: ${user.id}`);

    // E-posta doğrulama linki — best-effort, kayıt akışını bloklamaz.
    // (Hoş geldin e-postası doğrulama tamamlanınca gönderilir.)
    try {
      await this.verification.send(user);
    } catch (err) {
      this.logger.warn(
        `Doğrulama e-postası gönderilemedi (${user.id}): ${err}`,
      );
    }

    return this.buildAuthResponse(user);
  }

  /** E-posta doğrulama (verify-email ucu). */
  async verifyEmail(email: string, token: string): Promise<void> {
    await this.verification.verify(email, token);
  }

  /** Doğrulama e-postasını yeniden gönder (enumeration-safe, her zaman 200). */
  async resendVerification(email: string): Promise<void> {
    await this.verification.resend(email);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user ||
      !(await this.passwords.verify(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('E-posta veya parola hatalı');
    }
    return this.buildAuthResponse(user);
  }

  async refresh(
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const { rawToken: newRefresh, userId } =
      await this.tokens.rotateRefreshToken(rawToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }
    const { accessToken, expiresAt } = this.tokens.generateAccessToken(user);
    return { accessToken, refreshToken: newRefresh, expiresAt };
  }

  async logout(rawToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(rawToken);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    await this.passwords.requestReset(email);
  }

  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<void> {
    await this.passwords.reset(email, token, newPassword);
  }

  async google(idToken: string): Promise<AuthResponseDto> {
    if (!this.googleClient || !this.googleClientId) {
      throw new ServiceUnavailableException('Google login etkin değil');
    }

    let email: string | undefined;
    let googleId: string | undefined;
    let name: string | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      email = payload?.email;
      googleId = payload?.sub;
      name = payload?.name ?? payload?.given_name;
    } catch {
      throw new UnauthorizedException('Geçersiz Google token');
    }
    if (!email || !googleId) {
      throw new UnauthorizedException('Google token e-posta içermiyor');
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId, isMailConfirm: true },
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          username: await this.uniqueUsernameFromEmail(email),
          nickname: name ?? email.split('@')[0],
          passwordHash: await this.passwords.hash(
            crypto.randomBytes(32).toString('hex'),
          ),
          isMailConfirm: true,
        },
      });
    }
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const { accessToken, expiresAt } = this.tokens.generateAccessToken(user);
    const refreshToken = await this.tokens.issueRefreshToken(user.id);
    return {
      accessToken,
      refreshToken,
      expiresAt,
      user: this.toUserResponse(user),
    };
  }

  private async uniqueUsernameFromEmail(email: string): Promise<string> {
    const base = email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 40)
      .padEnd(3, '0');
    let candidate = base;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      candidate = `${base}_${crypto.randomBytes(2).toString('hex')}`.slice(
        0,
        50,
      );
    }
    return candidate;
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      profilePic: user.profilePic ?? undefined,
      isMailConfirm: user.isMailConfirm,
      status: user.status,
      favouriteTeam: user.favouriteTeam ?? undefined,
      reputationScore: user.reputationScore,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
