import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrencyConverter } from './currency-converter';

describe('CurrencyConverter', () => {
  let converter: CurrencyConverter;
  let prisma: { currencyRate: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { currencyRate: { findFirst: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        CurrencyConverter,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    converter = module.get(CurrencyConverter);
  });

  it('returns 1:1 for same currency without querying', async () => {
    const map = await converter.rateMap(['EUR'], 'EUR');
    expect(map.get('EUR')).toBe(1);
    expect(prisma.currencyRate.findFirst).not.toHaveBeenCalled();
  });

  it('uses latest rate when available', async () => {
    prisma.currencyRate.findFirst.mockResolvedValue({ rate: 1.1 });
    const map = await converter.rateMap(['USD'], 'EUR');
    expect(map.get('USD')).toBe(1.1);
    expect(converter.convertWith(100, 'USD', map)).toBeCloseTo(110);
  });

  it('falls back to 1:1 when no rate (CurrencyRate boş)', async () => {
    prisma.currencyRate.findFirst.mockResolvedValue(null);
    const map = await converter.rateMap(['GBP'], 'EUR');
    expect(map.get('GBP')).toBe(1);
    expect(converter.convertWith(200, 'GBP', map)).toBe(200);
  });
});
