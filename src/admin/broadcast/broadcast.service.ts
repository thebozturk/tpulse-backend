import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { BroadcastMessage } from '@prisma/client';
import { Queue } from 'bullmq';
import { PagedResult } from '../../common/interfaces/response.interface';
import { buildPaged, toSkipTake } from '../../common/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BROADCAST_QUEUE, BroadcastJobData } from './broadcast.constants';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { BroadcastResponseDto } from './dto/broadcast.response.dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BROADCAST_QUEUE) private readonly queue: Queue,
  ) {}

  /** Broadcast kaydı oluşturur ve işlenmek üzere kuyruğa atar (senkron üretim yok). */
  async enqueue(
    createdBy: string,
    dto: CreateBroadcastDto,
  ): Promise<BroadcastResponseDto> {
    const message = await this.prisma.broadcastMessage.create({
      data: {
        title: dto.title,
        body: dto.body,
        target: dto.target ?? 'all',
        createdBy,
      },
    });
    await this.queue.add(
      'broadcast',
      { broadcastId: message.id } satisfies BroadcastJobData,
      { attempts: 3, removeOnComplete: true },
    );
    this.logger.log(`Broadcast kuyruğa alındı: ${message.id}`);
    return toBroadcastResponse(message);
  }

  /** Gönderim geçmişi (paged). */
  async history(
    page: number,
    pageSize: number,
  ): Promise<PagedResult<BroadcastResponseDto>> {
    const { skip, take } = toSkipTake(page, pageSize);
    const [items, totalCount] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.broadcastMessage.count(),
    ]);
    return buildPaged(
      items.map(toBroadcastResponse),
      totalCount,
      page,
      pageSize,
    );
  }
}

export function toBroadcastResponse(m: BroadcastMessage): BroadcastResponseDto {
  return {
    id: m.id,
    title: m.title,
    body: m.body,
    target: m.target,
    status: m.status,
    sentCount: m.sentCount,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
  };
}
