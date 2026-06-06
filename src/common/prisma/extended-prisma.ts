import { PrismaService } from './prisma.service';
import { softDeleteExtension } from './soft-delete.extension';

/**
 * Soft-delete extension'ı uygulanmış Prisma client'ı. Base PrismaService'i
 * `$extends` eder → AYNI bağlantı havuzu (yeni connection açmaz). Servisler bunu
 * enjekte eder: @Inject(EXTENDED_PRISMA) private prisma: ExtendedPrismaClient.
 * Lifecycle ($connect/$disconnect) base PrismaService'te yönetilir.
 */
export const EXTENDED_PRISMA = Symbol('EXTENDED_PRISMA');

export function createExtendedPrisma(prisma: PrismaService) {
  return prisma.$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrisma>;
