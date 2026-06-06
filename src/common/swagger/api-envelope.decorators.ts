import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Response envelope'ları (response.interface.ts) generic olduğu için NestJS
 * Swagger otomatik schema üretemez. Bu helper'lar @ApiExtraModels + getSchemaPath
 * ile envelope + inner DTO'yu birleştirip openapi.json'a gerçek schema yazdırır.
 *
 * Kullanım:
 *   @ApiSingleResponse(PostResponseDto)        → { data: Post }
 *   @ApiListResponse(PostResponseDto)          → { items: Post[] }
 *   @ApiPagedResponse(PostResponseDto)         → { items, page, pageSize, ... }
 *   @ApiActionResponse()                       → { success, message }
 *   @ApiActionResponse(TransferResponseDto)    → { success, message, data }
 */

/** Tekil getter: `SingleResponse<T>` → `{ data: T }` */
export const ApiSingleResponse = <TModel extends Type>(
  model: TModel,
  status = 200,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: { data: { $ref: getSchemaPath(model) } },
        required: ['data'],
      },
    }),
  );

/** Sayfasız liste: `ListResponse<T>` → `{ items: T[] }` */
export const ApiListResponse = <TModel extends Type>(
  model: TModel,
  status = 200,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(model) } },
        },
        required: ['items'],
      },
    }),
  );

/** Sayfalı: `PagedResult<T>` → `{ items, page, pageSize, totalCount, totalPages }` */
export const ApiPagedResponse = <TModel extends Type>(
  model: TModel,
  status = 200,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(model) } },
          page: { type: 'number' },
          pageSize: { type: 'number' },
          totalCount: { type: 'number' },
          totalPages: { type: 'number' },
        },
        required: ['items', 'page', 'pageSize', 'totalCount', 'totalPages'],
      },
    }),
  );

/** Aksiyon/yazma: `ActionResponse<T>` → `{ success, message, data? }` */
export const ApiActionResponse = <TModel extends Type>(
  model?: TModel,
  status = 200,
) =>
  applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          ...(model ? { data: { $ref: getSchemaPath(model) } } : {}),
        },
        required: ['success', 'message'],
      },
    }),
  );
