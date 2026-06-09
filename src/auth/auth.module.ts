import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          issuer: config.getOrThrow<string>('jwt.issuer'),
          audience: config.getOrThrow<string>('jwt.audience'),
          expiresIn: config.getOrThrow<string>(
            'jwt.accessExpiry',
          ) as JwtSignOptions['expiresIn'],
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    EmailVerificationService,
    JwtStrategy,
  ],
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
