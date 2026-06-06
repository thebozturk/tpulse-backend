import { Prisma } from '@prisma/client';

/**
 * Transfer.isDeleted soft-delete'i merkezi uygular (docs/01 §Migration Notları 1):
 * - Okuma sorgularına otomatik `isDeleted: false` enjekte edilir (unutma riski yok).
 *   Çağıran açıkça `isDeleted` verirse (örn. admin) o değer geçerli olur.
 * - `delete`/`deleteMany` → hard delete YERİNE `isDeleted: true` update'i.
 * NOT: `findUnique` Prisma'da ek where kabul etmez; soft-delete-aware tekil okuma
 * için servis `findFirst` kullanır.
 */

/** Pure helper — test edilebilir: default isDeleted:false, çağıranın değeri ezer. */
export function notDeletedWhere<T extends object | undefined>(
  where: T,
): T & { isDeleted: boolean } {
  return { isDeleted: false, ...(where ?? {}) } as T & { isDeleted: boolean };
}

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'soft-delete-transfer',
    query: {
      transfer: {
        findMany({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        findFirstOrThrow({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        count({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        aggregate({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        groupBy({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = notDeletedWhere(args.where);
          return query(args);
        },
        delete({ args }) {
          return client.transfer.update({
            where: args.where,
            data: { isDeleted: true },
          });
        },
        deleteMany({ args }) {
          return client.transfer.updateMany({
            where: args.where,
            data: { isDeleted: true },
          });
        },
      },
    },
  }),
);
