import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, of } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let set: jest.Mock;
  let handle: jest.Mock;
  let next: CallHandler;

  const ctxFor = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  const req = (over: Record<string, unknown> = {}) => ({
    method: 'POST',
    path: '/api/posts',
    headers: {},
    user: { sub: 'u1' },
    ...over,
  });

  beforeEach(() => {
    set = jest.fn().mockResolvedValue('OK');
    handle = jest.fn().mockReturnValue(of('result'));
    next = { handle } as unknown as CallHandler;
    const redis = { client: { set } } as unknown as RedisService;
    const config = {
      get: jest.fn().mockReturnValue(600),
    } as unknown as ConfigService;
    interceptor = new IdempotencyInterceptor(redis, config);
  });

  afterEach(() => jest.clearAllMocks());

  it('header yoksa no-op (set çağrılmaz, handle çağrılır)', async () => {
    const obs = await interceptor.intercept(ctxFor(req()), next);
    await firstValueFrom(obs);
    expect(set).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('GET ise no-op (mutating değil)', async () => {
    const obs = await interceptor.intercept(
      ctxFor(req({ method: 'GET', headers: { 'idempotency-key': 'abc' } })),
      next,
    );
    await firstValueFrom(obs);
    expect(set).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('ilk key → SET NX OK → handle çağrılır', async () => {
    set.mockResolvedValue('OK');
    const obs = await interceptor.intercept(
      ctxFor(req({ headers: { 'idempotency-key': 'k1' } })),
      next,
    );
    await firstValueFrom(obs);
    expect(set).toHaveBeenCalledWith(
      'idem:u1:POST:/api/posts:k1',
      '1',
      'EX',
      600,
      'NX',
    );
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('tekrar key → SET NX null → 409 ConflictException', async () => {
    set.mockResolvedValue(null);
    await expect(
      interceptor.intercept(
        ctxFor(req({ headers: { 'idempotency-key': 'k1' } })),
        next,
      ),
    ).rejects.toThrow(ConflictException);
    expect(handle).not.toHaveBeenCalled();
  });

  it('Redis hatası → fail-open (handle çağrılır)', async () => {
    set.mockRejectedValue(new Error('redis down'));
    const obs = await interceptor.intercept(
      ctxFor(req({ headers: { 'idempotency-key': 'k1' } })),
      next,
    );
    await firstValueFrom(obs);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('255 karakterden uzun key → 400 BadRequestException', async () => {
    await expect(
      interceptor.intercept(
        ctxFor(req({ headers: { 'idempotency-key': 'x'.repeat(256) } })),
        next,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });

  it('anon kullanıcı (user yok) → key anon ile kurulur', async () => {
    const obs = await interceptor.intercept(
      ctxFor(req({ user: undefined, headers: { 'idempotency-key': 'k9' } })),
      next,
    );
    await firstValueFrom(obs);
    expect(set).toHaveBeenCalledWith(
      'idem:anon:POST:/api/posts:k9',
      '1',
      'EX',
      600,
      'NX',
    );
  });
});
