import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BROADCAST_QUEUE } from './broadcast.constants';
import { BroadcastService } from './broadcast.service';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: { broadcastMessage: Record<string, jest.Mock> };
  let queue: { add: jest.Mock };

  const msg = {
    id: 'b1',
    title: 'T',
    body: 'B',
    target: 'all',
    status: 'Queued',
    sentCount: 0,
    createdBy: 'admin1',
    createdAt: new Date(0),
  };

  beforeEach(async () => {
    prisma = {
      broadcastMessage: {
        create: jest.fn().mockResolvedValue(msg),
        findMany: jest.fn().mockResolvedValue([msg]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(BROADCAST_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(BroadcastService);
  });

  afterEach(() => jest.clearAllMocks());

  it('enqueue: BroadcastMessage oluşturur ve kuyruğa ekler', async () => {
    const res = await service.enqueue('admin1', { title: 'T', body: 'B' });
    expect(prisma.broadcastMessage.create).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'broadcast',
      { broadcastId: 'b1' },
      expect.objectContaining({ attempts: 3 }),
    );
    expect(res.status).toBe('Queued');
  });

  it('history: sayfalı geçmiş döner', async () => {
    const res = await service.history(1, 20);
    expect(res.items).toHaveLength(1);
    expect(res.totalCount).toBe(1);
  });
});
