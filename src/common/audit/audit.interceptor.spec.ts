import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditAction } from './audit-actions';
import { AuditMeta } from './audit.decorator';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: { getAllAndOverride: jest.Mock };
  let audit: { log: jest.Mock };

  const ctxFor = (user?: { userId: string }): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { id: 't1' },
          method: 'PATCH',
          url: '/api/admin/users/t1/status',
        }),
      }),
    }) as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of('ok') };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(
      reflector as unknown as Reflector,
      audit as unknown as AuditService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('@Audit yoksa log atmaz', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await lastValueFrom(interceptor.intercept(ctxFor({ userId: 'a1' }), next));
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('@Audit + user varsa başarı sonrası log atar', async () => {
    const meta: AuditMeta = {
      action: AuditAction.UserStatus,
      targetType: 'User',
    };
    reflector.getAllAndOverride.mockReturnValue(meta);
    await lastValueFrom(interceptor.intercept(ctxFor({ userId: 'a1' }), next));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'a1',
        action: 'user.status',
        targetType: 'User',
        targetId: 't1',
      }),
    );
  });

  it('user yoksa log atmaz', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      action: AuditAction.UserStatus,
    });
    await lastValueFrom(interceptor.intercept(ctxFor(undefined), next));
    expect(audit.log).not.toHaveBeenCalled();
  });
});
