import { TransferSource } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { PostType } from '../common/enums';
import { OutboxEventType } from '../messaging/events';
import { OutboxService } from '../messaging/outbox.service';
import { INewsRepository } from '../news/news.repository';
import { ITransferRepository } from '../transfers/transfer.repository';
import { IngestProjectionService } from './ingest-projection.service';
import { IngestPostDto } from './dto/ingest-post.dto';
import { ResolvedShape } from './post-shape.resolver';

const tx = {} as Prisma.TransactionClient;

const transferShape: ResolvedShape = {
  postType: PostType.Transfer,
  playerId: 'p1',
  fromTeamId: 'f1',
  toTeamId: 't1',
};

function makeDto(over: Partial<IngestPostDto> = {}): IngestPostDto {
  return {
    category: 'Rumour',
    text: 'SÖYLENTI Jhon Solis → Birmingham City',
    sourceId: 'tweet-123456789',
    ...over,
  } as IngestPostDto;
}

describe('IngestProjectionService', () => {
  let service: IngestProjectionService;
  let transferRepo: jest.Mocked<
    Pick<
      ITransferRepository,
      'createRumour' | 'createTransfer' | 'confirmRumour' | 'findOpenRumour'
    >
  >;
  let newsRepo: jest.Mocked<Pick<INewsRepository, 'create'>>;
  let outbox: jest.Mocked<Pick<OutboxService, 'enqueue'>>;

  beforeEach(() => {
    transferRepo = {
      createRumour: jest.fn().mockResolvedValue({ id: 'r1' }),
      createTransfer: jest.fn().mockResolvedValue({ id: 'tr1' }),
      confirmRumour: jest.fn().mockResolvedValue(true),
      findOpenRumour: jest.fn().mockResolvedValue(null),
    };
    newsRepo = { create: jest.fn().mockResolvedValue({ id: 'n1' }) };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new IngestProjectionService(
      transferRepo as unknown as ITransferRepository,
      newsRepo as unknown as INewsRepository,
      outbox as unknown as OutboxService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  const baseInput = (
    over: Partial<IngestPostDto>,
    category: BotContentCategory,
  ) => ({
    postId: 'post1',
    shape: transferShape,
    category,
    dto: makeDto(over),
    ownerId: 'sys1',
  });

  it('Rumour → createRumour (source=Bot, sourceId) + bildirim', async () => {
    const res = await service.project(
      tx,
      baseInput({ category: 'Rumour' }, BotContentCategory.Rumour),
    );
    expect(transferRepo.createRumour).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'p1',
        fromTeamId: 'f1',
        toTeamId: 't1',
        source: TransferSource.Bot,
        sourceId: 'tweet-123456789',
        createdByUserId: 'sys1',
      }),
      tx,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      OutboxEventType.NotificationGenerate,
      { transferId: 'r1' },
      tx,
    );
    expect(res).toEqual({ projectedAs: 'rumour', transferId: 'r1' });
  });

  it('Official + açık duyum yok → createTransfer + bildirim', async () => {
    transferRepo.findOpenRumour.mockResolvedValue(null);
    const res = await service.project(
      tx,
      baseInput(
        { category: 'Official', feeAmount: 7000000, feeCurrency: 'EUR' },
        BotContentCategory.Official,
      ),
    );
    expect(transferRepo.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        feeAmount: 7000000,
        source: TransferSource.Bot,
        sourceId: 'tweet-123456789',
      }),
      tx,
    );
    expect(transferRepo.confirmRumour).not.toHaveBeenCalled();
    expect(res).toEqual({ projectedAs: 'transfer', transferId: 'tr1' });
  });

  it('Official + açık duyum var → confirmRumour (dedup), yeni transfer açmaz', async () => {
    transferRepo.findOpenRumour.mockResolvedValue({ id: 'open-rumour' });
    const res = await service.project(
      tx,
      baseInput({ category: 'Official' }, BotContentCategory.Official),
    );
    expect(transferRepo.confirmRumour).toHaveBeenCalledWith(
      'open-rumour',
      expect.objectContaining({ feeCurrency: 'EUR' }),
      tx,
    );
    expect(transferRepo.createTransfer).not.toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      OutboxEventType.NotificationGenerate,
      { transferId: 'open-rumour' },
      tx,
    );
    expect(res).toEqual({ projectedAs: 'transfer', transferId: 'open-rumour' });
  });

  it('Breaking (transfer şekli) → no-op', async () => {
    const res = await service.project(
      tx,
      baseInput({ category: 'Breaking' }, BotContentCategory.Breaking),
    );
    expect(transferRepo.createRumour).not.toHaveBeenCalled();
    expect(transferRepo.createTransfer).not.toHaveBeenCalled();
    expect(newsRepo.create).not.toHaveBeenCalled();
    expect(res).toEqual({ projectedAs: 'none' });
  });

  it('Team/Player şekli → News (title + slug + sourceId türetilir)', async () => {
    const res = await service.project(tx, {
      postId: 'post1',
      shape: { postType: PostType.Player, playerId: 'p1' },
      category: BotContentCategory.Breaking,
      dto: makeDto({
        text: 'Hamza Abdelkarim Barcelona ile sözleşme imzaladı',
      }),
      ownerId: 'sys1',
    });
    expect(newsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hamza Abdelkarim Barcelona ile sözleşme imzaladı',
        slug: expect.stringContaining('hamza-abdelkarim'),
        sourceId: 'tweet-123456789',
        playerId: 'p1',
      }),
      tx,
    );
    expect(res).toEqual({ projectedAs: 'news', newsId: 'n1' });
  });
});
