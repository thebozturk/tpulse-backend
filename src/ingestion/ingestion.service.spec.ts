import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CacheService } from '../common/redis/cache.service';
import { CacheTag } from '../common/redis/cache-tags';
import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { IngestProjectionService } from './ingest-projection.service';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let tx: { post: { create: jest.Mock } };
  let prisma: {
    post: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let projection: { project: jest.Mock };
  let cache: { invalidateTags: jest.Mock };

  beforeEach(() => {
    tx = { post: { create: jest.fn().mockResolvedValue({ id: 'post1' }) } };
    prisma = {
      post: { findUnique: jest.fn() },
      user: { upsert: jest.fn().mockResolvedValue({ id: 'sys1' }) },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    projection = {
      project: jest
        .fn()
        .mockResolvedValue({ projectedAs: 'rumour', transferId: 't1' }),
    };
    cache = { invalidateTags: jest.fn().mockResolvedValue(undefined) };
    service = new IngestionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      projection as unknown as IngestProjectionService,
      cache as unknown as CacheService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  const base = { category: 'Rumour' as const, text: 'metin', sourceId: 'tw1' };

  it('aynı sourceId varsa duplicate döner, create/projection çağırmaz', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'existing' });
    const res = await service.ingestPost(base);
    expect(res).toEqual({ id: 'existing', status: 'duplicate' });
    expect(tx.post.create).not.toHaveBeenCalled();
    expect(projection.project).not.toHaveBeenCalled();
  });

  it('yeni içerik → Post + projection + audit + created', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await service.ingestPost({
      ...base,
      imageUrl: 'http://x/y.jpg',
    });
    expect(res).toEqual({
      id: 'post1',
      status: 'created',
      projectedAs: 'rumour',
      transferId: 't1',
      newsId: undefined,
    });
    expect(tx.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'sys1',
          content: 'metin',
          category: BotContentCategory.Rumour,
          sourceId: 'tw1',
          imageUrl: 'http://x/y.jpg',
        }),
      }),
    );
    expect(projection.project).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ postId: 'post1', ownerId: 'sys1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.ingest', targetId: 'post1' }),
    );
  });

  it('rumour/transfer yansımasında transfer cache düşürülür', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await service.ingestPost(base);
    expect(cache.invalidateTags).toHaveBeenCalledWith(CacheTag.Transfers);
  });

  it('news yansımasında transfer cache düşürülmez', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    projection.project.mockResolvedValue({ projectedAs: 'news', newsId: 'n1' });
    await service.ingestPost({ ...base, playerId: 'p1' });
    expect(cache.invalidateTags).not.toHaveBeenCalled();
  });

  it('opsiyonel playerId → postType Player(3) ile yazılır', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await service.ingestPost({ ...base, playerId: 'p1' });
    expect(tx.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ postType: 3, playerId: 'p1' }),
      }),
    );
  });
});
