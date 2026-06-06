import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CurrencyConverter } from './currency-converter';
import { STATS_REPOSITORY } from './stats.repository';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      aggregate: jest.fn(),
      topByFee: jest.fn().mockResolvedValue(null),
      edge: jest.fn().mockResolvedValue(null),
      mostActiveTeam: jest.fn().mockResolvedValue(null),
      mostTransferredPlayer: jest.fn().mockResolvedValue(null),
      listInRange: jest.fn().mockResolvedValue([]),
      getPeriods: jest.fn().mockResolvedValue([]),
      getPeriodById: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: STATS_REPOSITORY, useValue: repo },
        {
          provide: CurrencyConverter,
          useValue: { rateMap: jest.fn(), convertWith: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(StatsService);
  });

  it('getStats maps aggregate result', async () => {
    repo.aggregate.mockResolvedValue({
      totalTransfers: 2,
      totalSpent: 100,
      averageFee: 50,
      maxFee: 80,
      minFee: 20,
    });
    const dto = await service.getStats({});
    expect(dto).toMatchObject({ totalTransfers: 2, maxFee: 80, minFee: 20 });
    expect(dto.mostExpensiveTransfer).toBeUndefined();
  });

  it('getPeriods rejects out-of-range year with 400', async () => {
    await expect(service.getPeriods({ year: 1800 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getPeriodSummary requires year or transferPeriodId (400)', async () => {
    await expect(
      service.getPeriodSummary({ baseCurrency: 'EUR' }),
    ).rejects.toThrow(BadRequestException);
  });
});
