/**
 * docs/03 + docs/02 response envelope sözleşmeleri. Mobil + bot bunları bekler;
 * birebir korunmalı.
 */

/** Yazma/aksiyon uçları: { success, message, data? } */
export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/** Tekil getter: { data } */
export interface SingleResponse<T> {
  data: T;
}

/** Liste (sayfasız): { items } */
export interface ListResponse<T> {
  items: T[];
}

/** Sayfalama: { items, page, pageSize, totalCount, totalPages } */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Global HttpExceptionFilter hata çıktısı */
export interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
  statusCode: number;
  path: string;
  timestamp: string;
}
