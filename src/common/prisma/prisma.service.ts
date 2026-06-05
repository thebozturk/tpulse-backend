import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Tüm Prisma erişiminin tek noktası (docs/03 IApplicationDbContext karşılığı).
 * Bağlantı string'i schema.prisma'daki datasource url=env(DATABASE_URL)'den okunur.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma bağlantısı kuruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma bağlantısı kapatıldı');
  }
}
