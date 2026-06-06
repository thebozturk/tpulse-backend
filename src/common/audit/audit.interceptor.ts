import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuthUser } from '../decorators/current-user.decorator';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { AuditService } from './audit.service';

/**
 * @Audit ile işaretli handler'lar için, başarılı yanıttan sonra audit kaydı atar.
 * actor request.user'dan, targetId route :id parametresinden alınır. Kayıt
 * non-blocking (AuditService.log kendi hatasını yutar).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    return next.handle().pipe(
      tap(() => {
        const actorUserId = request.user?.userId;
        if (!actorUserId) {
          return;
        }
        void this.audit.log({
          actorUserId,
          action: meta.action,
          targetType: meta.targetType,
          targetId: request.params?.id,
          metadata: { method: request.method, path: request.url },
        });
      }),
    );
  }
}
