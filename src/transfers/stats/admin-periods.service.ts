import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransferPeriod } from '@prisma/client';
import { PeriodWriteDto } from './dto/period-write.dto';
import { TransferPeriodDto } from './dto/transfer-period.dto';
import { IStatsRepository, STATS_REPOSITORY } from './stats.repository';

@Injectable()
export class AdminPeriodsService {
  constructor(
    @Inject(STATS_REPOSITORY) private readonly repo: IStatsRepository,
  ) {}

  async list(year?: number): Promise<TransferPeriodDto[]> {
    return (await this.repo.getPeriods(year)).map(toDto);
  }

  async getById(id: string): Promise<TransferPeriodDto> {
    const period = await this.repo.getPeriodById(id);
    if (!period) {
      throw new NotFoundException('Dönem bulunamadı');
    }
    return toDto(period);
  }

  async create(dto: PeriodWriteDto): Promise<{ id: string }> {
    this.assertDates(dto);
    const created = await this.repo.createPeriod(dto);
    return { id: created.id };
  }

  async update(id: string, dto: PeriodWriteDto): Promise<void> {
    this.assertDates(dto);
    if (!(await this.repo.updatePeriod(id, dto))) {
      throw new NotFoundException('Dönem bulunamadı');
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.deletePeriod(id))) {
      throw new NotFoundException('Dönem bulunamadı');
    }
  }

  private assertDates(dto: PeriodWriteDto): void {
    if (dto.endDate.getTime() < dto.startDate.getTime()) {
      throw new BadRequestException('endDate, startDate’ten önce olamaz');
    }
  }
}

function toDto(p: TransferPeriod): TransferPeriodDto {
  return {
    id: p.id,
    name: p.name,
    periodType: p.periodType ?? undefined,
    startDate: p.startDate,
    endDate: p.endDate,
  };
}
