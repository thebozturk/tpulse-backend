import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps JWT payload to AuthUser (docs/04 claim eşlemesi)', () => {
    const config = {
      getOrThrow: jest.fn((k: string) =>
        k === 'jwt.secret' ? 'x'.repeat(32) : k,
      ),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const result = strategy.validate({
      sub: 'u1',
      email: 'a@b.c',
      unique_name: 'alice',
      nickname: 'Al',
      role: 'Admin',
      jti: 'j1',
    });

    expect(result).toEqual({
      userId: 'u1',
      email: 'a@b.c',
      username: 'alice',
      role: 'Admin',
    });
  });
});
