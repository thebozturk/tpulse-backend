import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { UserStatusCache } from '../auth/user-status.cache';
import { AuthUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let statusCache: { getStatus: jest.Mock };
  let superSpy: jest.SpyInstance;

  const ctxFor = (user?: Partial<AuthUser>): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    statusCache = { getStatus: jest.fn() };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      statusCache as unknown as UserStatusCache,
    );
    // @nestjs/passport AuthGuard('jwt') tip başına memoize eder → aynı prototype.
    superSpy = jest
      .spyOn(
        AuthGuard('jwt').prototype as { canActivate: () => Promise<boolean> },
        'canActivate',
      )
      .mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('@Public ise super çağrılmadan geçer', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(ctxFor())).resolves.toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
    expect(statusCache.getStatus).not.toHaveBeenCalled();
  });

  it('aktif kullanıcı geçer', async () => {
    statusCache.getStatus.mockResolvedValue(UserStatus.Active);
    await expect(guard.canActivate(ctxFor({ userId: 'u1' }))).resolves.toBe(
      true,
    );
  });

  it('banlı kullanıcı 403 alır', async () => {
    statusCache.getStatus.mockResolvedValue(UserStatus.Banned);
    await expect(guard.canActivate(ctxFor({ userId: 'u1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('suspend kullanıcı 403 alır', async () => {
    statusCache.getStatus.mockResolvedValue(UserStatus.Suspended);
    await expect(guard.canActivate(ctxFor({ userId: 'u1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('super false dönerse status kontrol edilmez', async () => {
    superSpy.mockResolvedValue(false);
    await expect(guard.canActivate(ctxFor({ userId: 'u1' }))).resolves.toBe(
      false,
    );
    expect(statusCache.getStatus).not.toHaveBeenCalled();
  });
});
