import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// docs/04 §7.5: auth policy 30/dk/IP (default throttler override).
@ApiTags('auth')
@Controller('api/auth')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kayıt ol' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'E-posta/kullanıcı adı çakışması' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Giriş yap' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Hatalı kimlik' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şifre sıfırlama isteği (her zaman 200)' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.auth.forgotPassword(dto.email);
    return {
      success: true,
      message: 'E-posta kayıtlıysa sıfırlama bağlantısı gönderildi',
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şifreyi sıfırla' })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz/expired token veya zayıf parola',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.auth.resetPassword(dto.email, dto.token, dto.newPassword);
    return { success: true, message: 'Parola güncellendi' };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access token yenile (refresh rotation)' })
  @ApiResponse({ status: 401, description: 'Geçersiz refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Çıkış (refresh token revoke)' })
  async logout(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.auth.logout(dto.refreshToken);
    return { success: true, message: 'Çıkış yapıldı' };
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tüm cihazlardan çıkış' })
  async revokeAll(
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.auth.revokeAll(user.userId);
    return { success: true, message: 'Tüm oturumlar kapatıldı' };
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google ile giriş' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 503, description: 'Google login etkin değil' })
  google(@Body() dto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.auth.google(dto.idToken);
  }
}
