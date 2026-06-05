import { Global, Module } from '@nestjs/common';
import { createExtendedPrisma, EXTENDED_PRISMA } from './extended-prisma';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: EXTENDED_PRISMA,
      useFactory: (prisma: PrismaService) => createExtendedPrisma(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [PrismaService, EXTENDED_PRISMA],
})
export class PrismaModule {}
