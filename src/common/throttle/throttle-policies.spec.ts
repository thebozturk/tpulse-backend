import { GLOBAL_THROTTLE, ThrottlePolicies } from './throttle-policies';

describe('ThrottlePolicies', () => {
  it('auth en sıkı kimlik politikası', () => {
    expect(ThrottlePolicies.auth.default).toEqual({ limit: 30, ttl: 60_000 });
  });

  it('write mutating uçlar için', () => {
    expect(ThrottlePolicies.write.default).toEqual({ limit: 120, ttl: 60_000 });
  });

  it('adminBulk pahalı toplu işler için en kısıtlı', () => {
    expect(ThrottlePolicies.adminBulk.default).toEqual({
      limit: 10,
      ttl: 60_000,
    });
    // adminBulk < write < global (sıkılık sırası korunur)
    expect(ThrottlePolicies.adminBulk.default.limit).toBeLessThan(
      ThrottlePolicies.write.default.limit,
    );
  });

  it('global limit IP başına 300/dk', () => {
    expect(GLOBAL_THROTTLE).toEqual({ ttl: 60_000, limit: 300 });
  });
});
