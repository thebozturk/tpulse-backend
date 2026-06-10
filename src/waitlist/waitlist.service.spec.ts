import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { LAUNCH_QUEUE } from './waitlist.constants';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let prisma: {
    waitlistSubscriber: Record<string, jest.Mock>;
    launchCampaign: Record<string, jest.Mock>;
  };
  let queue: { add: jest.Mock };

  const campaign = {
    id: 'c1',
    subject: 'S',
    body: 'B',
    ctaLabel: null,
    ctaUrl: null,
    status: 'Queued',
    total: 3,
    sentCount: 0,
    createdBy: 'admin1',
    createdAt: new Date(0),
  };

  beforeEach(async () => {
    prisma = {
      waitlistSubscriber: {
        upsert: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(3),
      },
      launchCampaign: {
        create: jest.fn().mockResolvedValue(campaign),
        findMany: jest.fn().mockResolvedValue([campaign]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(LAUNCH_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(WaitlistService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('subscribe', () => {
    it('yeni e-postayı upsert ile kaydeder', async () => {
      await service.subscribe({ email: 'a@b.com', source: 'landing' });
      expect(prisma.waitlistSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'a@b.com' },
          create: { email: 'a@b.com', source: 'landing' },
          update: {},
        }),
      );
    });

    it('duplicate e-postada update boş — yeni kayıt yaratmaz', async () => {
      await service.subscribe({ email: 'a@b.com' });
      const arg = prisma.waitlistSubscriber.upsert.mock.calls[0][0];
      expect(arg.update).toEqual({});
      expect(arg.create.source).toBeNull();
    });
  });

  describe('enqueueLaunch', () => {
    it('kampanya kaydı oluşturur ve kuyruğa ekler', async () => {
      const res = await service.enqueueLaunch('admin1', {
        subject: 'S',
        body: 'B',
      });
      expect(prisma.waitlistSubscriber.count).toHaveBeenCalledWith({
        where: { status: 'subscribed', launchEmailSentAt: null },
      });
      expect(prisma.launchCampaign.create).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'launch',
        { campaignId: 'c1' },
        expect.objectContaining({ attempts: 3 }),
      );
      expect(res.status).toBe('Queued');
      expect(res.total).toBe(3);
    });
  });

  describe('history', () => {
    it('sayfalı kampanya geçmişi döner', async () => {
      const res = await service.history(1, 20);
      expect(res.items).toHaveLength(1);
      expect(res.totalCount).toBe(1);
    });
  });

  describe('stats', () => {
    it('özet sayıları döner', async () => {
      prisma.waitlistSubscriber.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // subscribed
        .mockResolvedValueOnce(2) // unsubscribed
        .mockResolvedValueOnce(5); // launchSent
      const res = await service.stats();
      expect(res).toEqual({
        total: 10,
        subscribed: 8,
        unsubscribed: 2,
        launchSent: 5,
      });
    });
  });
});
