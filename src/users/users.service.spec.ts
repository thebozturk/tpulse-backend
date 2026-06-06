import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { UserStatusCache } from '../common/auth/user-status.cache';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock> };

  const baseUser = {
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
    passwordHash: 'secret-hash',
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const passwords = { hash: jest.fn().mockResolvedValue('hashed') };
    const tokens = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    const statusCache = { setStatus: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: UserStatusCache, useValue: statusCache },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create throws Conflict on duplicate', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.create({
        username: 'a',
        email: 'a@b.c',
        password: 'Secret123',
        nickname: 'A',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('create returns response without passwordHash', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(baseUser);
    const res = await service.create({
      username: 'a',
      email: 'a@b.c',
      password: 'Secret123',
      nickname: 'A',
    });
    expect(res.id).toBe('u1');
    expect(Object.keys(res)).not.toContain('passwordHash');
  });

  it('findById throws NotFound', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findById('u1')).rejects.toThrow(NotFoundException);
  });

  it('update throws 400 on id mismatch', async () => {
    await expect(service.update('u1', { id: 'u2' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('update throws 404 when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.update('u1', { id: 'u1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove throws 404 when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.remove('u1')).rejects.toThrow(NotFoundException);
  });
});
