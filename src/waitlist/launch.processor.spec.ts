import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { LaunchProcessor } from './launch.processor';
import { LaunchJobData } from './waitlist.constants';

// EmailService gerçek modülü React-email (.tsx) template'lerini yükler ve
// jest'in default resolver'ı bunları çözemez (pre-existing). Sadece processor'ı
// test ettiğimiz için modülü stub'lıyoruz; gerçek bağımlılık mock obje ile gelir.
jest.mock('../email/email.service', () => ({ EmailService: class {} }));

describe('LaunchProcessor', () => {
  let processor: LaunchProcessor;
  let prisma: {
    launchCampaign: Record<string, jest.Mock>;
    waitlistSubscriber: Record<string, jest.Mock>;
  };
  let email: { sendLaunch: jest.Mock };

  const campaign = {
    id: 'c1',
    subject: 'S',
    body: 'B',
    ctaLabel: null,
    ctaUrl: null,
    status: 'Queued',
  };

  const job = { data: { campaignId: 'c1' } } as Job<LaunchJobData>;

  beforeEach(() => {
    // SEND_DELAY_MS beklemesini anında çöz (testi yavaşlatma).
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);

    prisma = {
      launchCampaign: {
        findUnique: jest.fn().mockResolvedValue({ ...campaign }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      waitlistSubscriber: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    email = { sendLaunch: jest.fn().mockResolvedValue(undefined) };

    processor = new LaunchProcessor(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('aboneleri batch halinde gezer ve her birine gönderir', async () => {
    prisma.waitlistSubscriber.findMany
      .mockResolvedValueOnce([
        { id: 's1', email: 'a@b.com' },
        { id: 's2', email: 'c@d.com' },
      ])
      .mockResolvedValueOnce([]);

    await processor.process(job);

    expect(email.sendLaunch).toHaveBeenCalledTimes(2);
    // İçerik sabit (backend template) — yalnızca alıcı geçilir.
    expect(email.sendLaunch).toHaveBeenCalledWith('a@b.com');
    expect(email.sendLaunch).toHaveBeenCalledWith('c@d.com');
    // Her gönderim sonrası launchEmailSentAt işaretlenir (idempotency).
    expect(prisma.waitlistSubscriber.update).toHaveBeenCalledTimes(2);
    // Sending → Done geçişi.
    expect(prisma.launchCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'Sending' } }),
    );
    expect(prisma.launchCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'Done' } }),
    );
  });

  it('zaten Done olan kampanyada hiçbir şey göndermez (idempotent)', async () => {
    prisma.launchCampaign.findUnique.mockResolvedValue({
      ...campaign,
      status: 'Done',
    });

    await processor.process(job);

    expect(email.sendLaunch).not.toHaveBeenCalled();
    expect(prisma.launchCampaign.update).not.toHaveBeenCalled();
  });

  it('tek alıcı hatası toplu gönderimi durdurmaz, işaretlemez', async () => {
    prisma.waitlistSubscriber.findMany
      .mockResolvedValueOnce([
        { id: 's1', email: 'fail@b.com' },
        { id: 's2', email: 'ok@d.com' },
      ])
      .mockResolvedValueOnce([]);
    email.sendLaunch
      .mockRejectedValueOnce(new Error('resend down'))
      .mockResolvedValueOnce(undefined);

    await processor.process(job);

    expect(email.sendLaunch).toHaveBeenCalledTimes(2);
    // Sadece başarılı olan işaretlenir.
    expect(prisma.waitlistSubscriber.update).toHaveBeenCalledTimes(1);
    expect(prisma.waitlistSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's2' } }),
    );
    expect(prisma.launchCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'Done' } }),
    );
  });

  it('beklenmedik hatada kampanyayı Failed yapar ve rethrow eder', async () => {
    prisma.waitlistSubscriber.findMany.mockRejectedValue(new Error('db down'));

    await expect(processor.process(job)).rejects.toThrow('db down');
    expect(prisma.launchCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'Failed' } }),
    );
  });
});
