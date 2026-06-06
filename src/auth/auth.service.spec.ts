import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: Record<string, jest.Mock> };
  let passwords: { hash: jest.Mock; verify: jest.Mock };
  let tokens: {
    generateAccessToken: jest.Mock;
    issueRefreshToken: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('hashed'),
      verify: jest.fn(),
    };
    tokens = {
      generateAccessToken: jest
        .fn()
        .mockReturnValue({ accessToken: 'acc', expiresAt: new Date(0) }),
      issueRefreshToken: jest.fn().mockResolvedValue('refresh-raw'),
    };
    // google.authClientId undefined → googleClient yok (503 testi)
    const config = { get: jest.fn().mockReturnValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws Conflict when email/username taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'x' });
      await expect(
        service.register({
          username: 'a',
          email: 'a@b.c',
          password: 'Secret123',
          nickname: 'A',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns tokens + user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        username: 'a',
        email: 'a@b.c',
        nickname: 'A',
        status: 'Active',
        reputationScore: 0,
        role: 'User',
        isMailConfirm: false,
        createdAt: new Date(0),
        profilePic: null,
        favouriteTeam: null,
      });
      const res = await service.register({
        username: 'a',
        email: 'a@b.c',
        password: 'Secret123',
        nickname: 'A',
      });
      expect(res.accessToken).toBe('acc');
      expect(res.refreshToken).toBe('refresh-raw');
      expect(res.user.id).toBe('u1');
      expect(Object.keys(res.user)).not.toContain('passwordHash');
    });
  });

  describe('login', () => {
    it('throws Unauthorized when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.c', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when password invalid', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: 'h' });
      passwords.verify.mockResolvedValue(false);
      await expect(
        service.login({ email: 'a@b.c', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('google', () => {
    it('throws ServiceUnavailable when GOOGLE_AUTH_CLIENT_ID unset', async () => {
      await expect(service.google('idtoken')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
