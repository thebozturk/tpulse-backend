import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwt: { sign: jest.Mock; decode: jest.Mock };
  let prisma: { refreshToken: Record<string, jest.Mock> };

  const user = {
    id: 'u1',
    email: 'a@b.c',
    username: 'alice',
    nickname: 'Al',
    role: 'User',
  } as User;

  beforeEach(async () => {
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt'),
      decode: jest.fn().mockReturnValue({ exp: 1000 }),
    };
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config = {
      getOrThrow: jest.fn((k: string) =>
        k === 'jwt.refreshExpiryDays' ? 90 : 'x',
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(TokenService);
  });

  afterEach(() => jest.clearAllMocks());

  it('generateAccessToken sets docs/04 claims and computes expiry from exp', () => {
    const res = service.generateAccessToken(user);
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        email: 'a@b.c',
        unique_name: 'alice',
        nickname: 'Al',
        role: 'User',
      }),
    );
    expect(jwt.sign.mock.calls[0][0].jti).toEqual(expect.any(String));
    expect(res.expiresAt).toEqual(new Date(1000 * 1000));
  });

  it('issueRefreshToken stores SHA-256 hash (not raw) and returns raw', async () => {
    const raw = await service.issueRefreshToken('u1');
    expect(raw).toHaveLength(128); // 64 byte hex
    const stored = prisma.refreshToken.create.mock.calls[0][0].data.token;
    expect(stored).toHaveLength(64); // sha256 hex
    expect(stored).not.toBe(raw);
  });

  it('rotateRefreshToken throws on revoked token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    await expect(service.rotateRefreshToken('raw')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotateRefreshToken issues new and revokes old when valid', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    const res = await service.rotateRefreshToken('raw');
    expect(res.userId).toBe('u1');
    expect(res.rawToken).toHaveLength(128);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ replacedByToken: expect.any(String) }),
      }),
    );
  });
});
