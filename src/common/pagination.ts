import { PagedResult } from './interfaces/response.interface';

/**
 * docs/03 PagedResult<T> helper'ı. Envelope birebir korunur:
 * { items, page, pageSize, totalCount, totalPages }.
 */
export function buildPaged<T>(
  items: T[],
  totalCount: number,
  page: number,
  pageSize: number,
): PagedResult<T> {
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
  };
}

/** Prisma skip/take hesabı için yardımcı. */
export function toSkipTake(
  page: number,
  pageSize: number,
): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
