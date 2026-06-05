import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('PasswordService', () => {
  let service: PasswordService;
  let prisma: {
    user: Record<string, jest.Mock>;
    passwordResetToken: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let email: { sendPasswordReset: jest.Mock };
  let tokens: { revokeAllForUser: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    email = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
    tokens = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    const config = { getOrThrow: jest.fn(() => 60) };

    const module = await Test.createTestingModule({
      providers: [
        PasswordService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: EmailService, useValue: email },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(PasswordService);
  });

  afterEach(() => jest.clearAllMocks());

  it('hash + verify roundtrip', async () => {
    const hash = await service.hash('Secret123');
    expect(hash).not.toBe('Secret123');
    expect(await service.verify('Secret123', hash)).toBe(true);
    expect(await service.verify('wrong', hash)).toBe(false);
  });

  it('requestReset is enumeration-safe: no token/email when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await service.requestReset('ghost@acme.com');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('requestReset creates hashed token and sends email when user exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await service.requestReset('a@acme.com');
    const stored =
      prisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash;
    expect(stored).toHaveLength(64); // sha256
    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      'a@acme.com',
      expect.any(String),
    );
    // gönderilen ham token, saklanan hash'ten farklı
    expect(email.sendPasswordReset.mock.calls[0][1]).not.toBe(stored);
  });

  it('reset throws on invalid/expired token', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);
    await expect(
      service.reset('a@acme.com', 'bad', 'NewSecret123'),
    ).rejects.toThrow(BadRequestException);
  });

  it('reset updates password and revokes all refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.passwordResetToken.findFirst.mockResolvedValue({ id: 'rt1' });
    await service.reset('a@acme.com', 'good', 'NewSecret123');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
