import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrencyRatesService } from './currency-rates.service';

describe('CurrencyRatesService', () => {
  let service: CurrencyRatesService;
  let prisma: { currencyRate: Record<string, jest.Mock> };

  const rate = {
    id: 'c1',
    currencyCode: 'EUR',
    baseCurrencyCode: 'TRY',
    rate: 35.42,
    rateDate: new Date('2026-06-01'),
    createdAt: new Date(0),
  };

  beforeEach(() => {
    prisma = {
      currencyRate: {
        findMany: jest.fn().mockResolvedValue([rate]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(rate),
        update: jest.fn().mockResolvedValue({ ...rate, rate: 36 }),
        delete: jest.fn().mockResolvedValue(rate),
      },
    };
    service = new CurrencyRatesService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create: aynı tarihte mevcutsa 409', async () => {
    prisma.currencyRate.findUnique.mockResolvedValue(rate);
    await expect(
      service.create({
        currencyCode: 'EUR',
        baseCurrencyCode: 'TRY',
        rate: 35,
        rateDate: new Date('2026-06-01'),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('create: yeni kur ekler', async () => {
    prisma.currencyRate.findUnique.mockResolvedValue(null);
    const res = await service.create({
      currencyCode: 'EUR',
      baseCurrencyCode: 'TRY',
      rate: 35.42,
      rateDate: new Date('2026-06-01'),
    });
    expect(res.rate).toBe(35.42);
    expect(prisma.currencyRate.create).toHaveBeenCalled();
  });

  it('update: yoksa 404', async () => {
    prisma.currencyRate.findUnique.mockResolvedValue(null);
    await expect(service.update('x', { rate: 36 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove: yoksa 404', async () => {
    prisma.currencyRate.findUnique.mockResolvedValue(null);
    await expect(service.remove('x')).rejects.toThrow(NotFoundException);
  });

  it('findAll: sayfalı liste', async () => {
    const res = await service.findAll(1, 20);
    expect(res.items[0].currencyCode).toBe('EUR');
  });
});
