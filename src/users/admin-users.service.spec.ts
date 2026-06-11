import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserStatus, VerificationType } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { UserStatusCache } from '../common/auth/user-status.cache';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UsersService } from './users.service';

describe('UsersService (BO-2 admin)', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock> };
  let tokens: { revokeAllForUser: jest.Mock };
  let statusCache: { setStatus: jest.Mock };
  let email: {
    sendAccountBanned: jest.Mock;
    sendAccountSuspended: jest.Mock;
  };

  const adminActive = {
    id: 'admin1',
    role: 'Admin',
    status: UserStatus.Active,
    reputationScore: 10,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ ...adminActive, ...data })),
        count: jest.fn(),
      },
    };
    tokens = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    statusCache = { setStatus: jest.fn().mockResolvedValue(undefined) };
    email = {
      sendAccountBanned: jest.fn().mockResolvedValue(undefined),
      sendAccountSuspended: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: {} },
        { provide: TokenService, useValue: tokens },
        { provide: UserStatusCache, useValue: statusCache },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('updateStatus', () => {
    it('ban: token iptal eder + cache i tazeler + bannedAt yazar', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...adminActive,
        role: 'User',
      });

      const res = await service.updateStatus('u1', {
        status: UserStatus.Banned,
        reason: 'spam',
      });

      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(statusCache.setStatus).toHaveBeenCalledWith(
        'u1',
        UserStatus.Banned,
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: UserStatus.Banned,
            banReason: 'spam',
            bannedAt: expect.any(Date),
          }),
        }),
      );
      expect(res.status).toBe(UserStatus.Banned);
    });

    it('Active e dönüşte token iptal etmez, bannedAt temizler', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...adminActive,
        role: 'User',
        status: UserStatus.Banned,
      });

      await service.updateStatus('u1', { status: UserStatus.Active });

      expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(statusCache.setStatus).toHaveBeenCalledWith(
        'u1',
        UserStatus.Active,
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bannedAt: null, banReason: null }),
        }),
      );
    });

    it('son aktif admin i banlamayı engeller (409)', async () => {
      prisma.user.findUnique.mockResolvedValue(adminActive);
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateStatus('admin1', { status: UserStatus.Banned }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('son aktif admin i düşürmeyi engeller (409)', async () => {
      prisma.user.findUnique.mockResolvedValue(adminActive);
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateRole('admin1', { role: 'User' }),
      ).rejects.toThrow(ConflictException);
    });

    it('başka admin varsa düşürmeye izin verir', async () => {
      prisma.user.findUnique.mockResolvedValue(adminActive);
      prisma.user.count.mockResolvedValue(2);

      const res = await service.updateRole('admin1', { role: 'User' });
      expect(res.role).toBe('User');
    });
  });

  describe('setVerified', () => {
    it('Blue tik atar + verifiedAt yazar', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...adminActive,
        role: 'User',
      });

      const res = await service.setVerified('u1', {
        verificationType: VerificationType.Blue,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationType: VerificationType.Blue,
            verifiedAt: expect.any(Date),
          }),
        }),
      );
      expect(res.verificationType).toBe(VerificationType.Blue);
    });

    it('Gold tik atar (onaylı marka)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...adminActive,
        role: 'User',
      });

      const res = await service.setVerified('u1', {
        verificationType: VerificationType.Gold,
      });

      expect(res.verificationType).toBe(VerificationType.Gold);
    });

    it('null: tiki kaldırır + verifiedAt null', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...adminActive,
        role: 'User',
        verificationType: VerificationType.Blue,
      });

      await service.setVerified('u1', { verificationType: null });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationType: null,
            verifiedAt: null,
          }),
        }),
      );
    });

    it('kullanıcı yoksa 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.setVerified('yok', { verificationType: VerificationType.Blue }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReputation', () => {
    it('hem delta hem value verilirse 400', async () => {
      await expect(
        service.updateReputation('u1', { delta: 5, value: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ikisi de verilmezse 400', async () => {
      await expect(service.updateReputation('u1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('delta ile increment uygular', async () => {
      prisma.user.findUnique.mockResolvedValue(adminActive);
      await service.updateReputation('u1', { delta: 5 });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reputationScore: { increment: 5 },
          }),
        }),
      );
    });
  });

  describe('adminFindAll', () => {
    it('status/role/q filtresini where e çevirir', async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.adminFindAll({
        page: 1,
        pageSize: 20,
        status: UserStatus.Banned,
        role: 'User',
        q: 'ali',
      });

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(UserStatus.Banned);
      expect(where.role).toBe('User');
      expect(where.OR).toHaveLength(3);
    });
  });
});
