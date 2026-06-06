import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let redisClient: Record<string, jest.Mock>;
  let prisma: {
    user: { count: jest.Mock };
    transfer: { count: jest.Mock };
    news: { count: jest.Mock };
    post: { count: jest.Mock; findMany: jest.Mock };
    comment: { count: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    redisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    prisma = {
      user: { count: jest.fn().mockResolvedValue(0) },
      transfer: { count: jest.fn().mockResolvedValue(0) },
      news: { count: jest.fn().mockResolvedValue(0) },
      post: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      comment: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new DashboardService(
      prisma as unknown as PrismaService,
      { client: redisClient } as unknown as RedisService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('cache hit ise DB sorgulamadan döner', async () => {
    const cached = {
      users: { total: 5, activeToday: 2, newThisWeek: 1 },
      content: { transfers: 3, rumours: 1, news: 0, posts: 0, comments: 0 },
      moderation: { pendingReports: 0 },
      recent: [],
    };
    redisClient.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getOverview();

    expect(result).toEqual(cached);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('cache miss ise hesaplar, transfer/rumour ayrımı yapar ve cache ler', async () => {
    prisma.user.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(7); // newThisWeek
    prisma.transfer.count
      .mockResolvedValueOnce(40) // transfers (isRumour:false)
      .mockResolvedValueOnce(12); // rumours (isRumour:true)
    prisma.news.count.mockResolvedValue(9);
    prisma.post.count.mockResolvedValue(500);
    prisma.comment.count.mockResolvedValue(2000);
    prisma.post.findMany
      .mockResolvedValueOnce([
        { id: 'p1', content: 'merhaba', createdAtUtc: new Date() },
      ]) // recent
      .mockResolvedValueOnce([{ ownerId: 'u1' }, { ownerId: 'u2' }]); // bugünkü post yazarları
    prisma.comment.findMany.mockResolvedValue([{ ownerId: 'u2' }]); // bugünkü yorum yazarları

    const result = await service.getOverview();

    expect(result.users.total).toBe(100);
    expect(result.users.newThisWeek).toBe(7);
    expect(result.content.transfers).toBe(40);
    expect(result.content.rumours).toBe(12);
    expect(result.users.activeToday).toBe(2); // u1, u2 birleşik
    expect(result.recent).toHaveLength(1);
    expect(redisClient.set).toHaveBeenCalled();
  });
});
