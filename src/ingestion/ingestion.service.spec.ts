import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let prisma: {
    post: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      post: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'post1' }),
      },
      user: { upsert: jest.fn().mockResolvedValue({ id: 'sys1' }) },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new IngestionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  const base = { category: 'Rumour' as const, text: 'metin', sourceId: 'tw1' };

  it('aynı sourceId varsa duplicate döner, create çağırmaz', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'existing' });
    const res = await service.ingestPost(base);
    expect(res).toEqual({ id: 'existing', status: 'duplicate' });
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('yeni içerik → sistem user adına Post + audit + created', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await service.ingestPost({
      ...base,
      imageUrl: 'http://x/y.jpg',
    });
    expect(res).toEqual({ id: 'post1', status: 'created' });
    expect(prisma.post.create).toHaveBeenCalledWith(
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
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.ingest', targetId: 'post1' }),
    );
  });

  it('opsiyonel playerId → postType Player(3) ile yazılır', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await service.ingestPost({ ...base, playerId: 'p1' });
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ postType: 3, playerId: 'p1' }),
      }),
    );
  });
});
