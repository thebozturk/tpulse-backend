import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * ThrottlerGuard + yük testi farkındalığı.
 *
 * `LOAD_TEST_MODE=true` (sadece non-prod; production'da env validation throw eder)
 * olduğunda rate limit tamamen bypass edilir — yük testleri global 300/dk veya
 * route policy'lerine (auth 30/dk, write 120/dk) takılmaz. Diğer her durumda
 * standart ThrottlerGuard davranışı korunur.
 *
 * Bypass framework'ün resmi `shouldSkip()` hook'u üzerinden yapılır; auth /
 * validation / idempotency zinciri etkilenmez.
 */
@Injectable()
export class LoadAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<boolean>('loadTest.enabled')) {
      return true;
    }
    return super.shouldSkip(context);
  }
}
