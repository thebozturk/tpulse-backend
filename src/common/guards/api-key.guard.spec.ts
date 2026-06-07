import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const KEY = 'super-secret-bot-key';
  const HASH = crypto.createHash('sha256').update(KEY).digest('hex');

  const guardWith = (hash?: string) =>
    new ApiKeyGuard({ get: () => hash } as unknown as ConfigService);

  const ctxFor = (apiKey?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }),
      }),
    }) as never;

  it('doğru key → true', () => {
    expect(guardWith(HASH).canActivate(ctxFor(KEY))).toBe(true);
  });

  it('yanlış key → 401', () => {
    expect(() => guardWith(HASH).canActivate(ctxFor('wrong'))).toThrow(
      UnauthorizedException,
    );
  });

  it('key eksik → 401', () => {
    expect(() => guardWith(HASH).canActivate(ctxFor())).toThrow(
      UnauthorizedException,
    );
  });

  it('hash yapılandırılmamış → 401 (fail-closed)', () => {
    expect(() => guardWith(undefined).canActivate(ctxFor(KEY))).toThrow(
      UnauthorizedException,
    );
  });
});
