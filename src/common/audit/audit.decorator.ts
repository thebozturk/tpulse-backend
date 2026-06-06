import { SetMetadata } from '@nestjs/common';
import { AuditActionType } from './audit-actions';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: AuditActionType;
  targetType?: string;
}

/**
 * Controller method'unu audit'e bağlar. AuditInterceptor başarılı yanıttan sonra
 * actor (request.user) + targetId (route :id) ile kayıt atar.
 */
export const Audit = (action: AuditActionType, targetType?: string) =>
  SetMetadata(AUDIT_KEY, { action, targetType } satisfies AuditMeta);
