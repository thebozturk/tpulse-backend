import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CurrencyRate } from '@prisma/client';
import { PagedResult } from '../../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../../common/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { CurrencyRateResponseDto } from './dto/currency-rate.response.dto';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';

@Injectable()
export class CurrencyRatesService {
  private readonly logger = new Logger(CurrencyRatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<CurrencyRateResponseDto>> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, totalCount] = await Promise.all([
      this.prisma.currencyRate.findMany({
        skip,
        take,
        orderBy: { rateDate: 'desc' },
      }),
      this.prisma.currencyRate.count(),
    ]);
    return buildPaged(items.map(toCurrencyRate), totalCount, page, pageSize);
  }

  async create(dto: CreateCurrencyRateDto): Promise<CurrencyRateResponseDto> {
    const existing = await this.prisma.currencyRate.findUnique({
      where: {
        currencyCode_baseCurrencyCode_rateDate: {
          currencyCode: dto.currencyCode,
          baseCurrencyCode: dto.baseCurrencyCode,
          rateDate: dto.rateDate,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Bu tarih için kur zaten tanımlı');
    }
    const rate = await this.prisma.currencyRate.create({
      data: {
        currencyCode: dto.currencyCode,
        baseCurrencyCode: dto.baseCurrencyCode,
        rate: dto.rate,
        rateDate: dto.rateDate,
      },
    });
    this.logger.log(`Kur eklendi: ${rate.id}`);
    return toCurrencyRate(rate);
  }

  async update(
    id: string,
    dto: UpdateCurrencyRateDto,
  ): Promise<CurrencyRateResponseDto> {
    await this.assertExists(id);
    const rate = await this.prisma.currencyRate.update({
      where: { id },
      data: { rate: dto.rate },
    });
    return toCurrencyRate(rate);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.currencyRate.delete({ where: { id } });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.currencyRate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Kur bulunamadı');
    }
  }
}

function toCurrencyRate(r: CurrencyRate): CurrencyRateResponseDto {
  return {
    id: r.id,
    currencyCode: r.currencyCode,
    baseCurrencyCode: r.baseCurrencyCode,
    rate: Number(r.rate),
    rateDate: r.rateDate,
    createdAt: r.createdAt,
  };
}
