import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';

import { LoadAwareThrottlerGuard } from './load-aware-throttler.guard';

describe('LoadAwareThrottlerGuard', () => {
  const context = {} as ExecutionContext;

  function createGuard(loadTestEnabled: boolean): LoadAwareThrottlerGuard {
    const config = {
      get: jest.fn((key: string) =>
        key === 'loadTest.enabled' ? loadTestEnabled : undefined,
      ),
    } as unknown as ConfigService;

    return new LoadAwareThrottlerGuard(
      [{ limit: 300, ttl: 60_000 }],
      {} as ThrottlerStorage,
      new Reflector(),
      config,
    );
  }

  afterEach(() => jest.restoreAllMocks());

  it('LOAD_TEST_MODE açıkken rate limit bypass eder (shouldSkip=true)', async () => {
    const superSpy = jest
      .spyOn(ThrottlerGuard.prototype, 'shouldSkip' as never)
      .mockResolvedValue(false as never);
    const guard = createGuard(true);

    const skip = await (
      guard as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }
    ).shouldSkip(context);

    expect(skip).toBe(true);
    expect(superSpy).not.toHaveBeenCalled(); // bypass — super'a hiç gitmez
  });

  it('LOAD_TEST_MODE kapalıyken standart ThrottlerGuard davranışına delege eder', async () => {
    const superSpy = jest
      .spyOn(ThrottlerGuard.prototype, 'shouldSkip' as never)
      .mockResolvedValue(false as never);
    const guard = createGuard(false);

    const skip = await (
      guard as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }
    ).shouldSkip(context);

    expect(skip).toBe(false);
    expect(superSpy).toHaveBeenCalledWith(context); // super.shouldSkip çağrılır
  });
});
