import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UserStatusCache } from './user-status.cache';

describe('UserStatusCache', () => {
  let cache: UserStatusCache;
  let redisClient: Record<string, jest.Mock>;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    redisClient = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    prisma = { user: { findUnique: jest.fn() } };
    cache = new UserStatusCache(
      prisma as unknown as PrismaService,
      { client: redisClient } as unknown as RedisService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('cache hit ise DB sorgulamaz', async () => {
    redisClient.get.mockResolvedValue(UserStatus.Active);

    const result = await cache.getStatus('u1');

    expect(result).toBe(UserStatus.Active);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('cache miss ise DB den okur ve cache ler', async () => {
    redisClient.get.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.Banned });

    const result = await cache.getStatus('u1');

    expect(result).toBe(UserStatus.Banned);
    expect(redisClient.set).toHaveBeenCalledWith(
      'auth:status:u1',
      UserStatus.Banned,
      'EX',
      60,
    );
  });

  it('Redis okuma hatasında DB ye düşer', async () => {
    redisClient.get.mockRejectedValue(new Error('redis down'));
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.Suspended });

    const result = await cache.getStatus('u1');

    expect(result).toBe(UserStatus.Suspended);
  });

  it('kullanıcı yoksa null döner', async () => {
    redisClient.get.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await cache.getStatus('missing');

    expect(result).toBeNull();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('invalidate cache anahtarını siler', async () => {
    await cache.invalidate('u1');
    expect(redisClient.del).toHaveBeenCalledWith('auth:status:u1');
  });
});
