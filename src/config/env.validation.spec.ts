import { validateEnv } from './env.validation';

describe('validateEnv — LOAD_TEST_MODE prod guard', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
    REDIS_CONNECTION_STRING: 'redis://localhost:6379',
  };

  it('production + LOAD_TEST_MODE=true → boot fail', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', LOAD_TEST_MODE: 'true' }),
    ).toThrow(/LOAD_TEST_MODE/);
  });

  it('development + LOAD_TEST_MODE=true → izinli (bypass açık)', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'development',
      LOAD_TEST_MODE: 'true',
    });
    expect(env.LOAD_TEST_MODE).toBe(true);
  });

  it('LOAD_TEST_MODE varsayılan false', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'development' });
    expect(env.LOAD_TEST_MODE).toBe(false);
  });
});
