import { BadRequestException } from '@nestjs/common';
import { PostType } from '../common/enums';
import { resolvePostShape } from './post-shape.resolver';

describe('resolvePostShape', () => {
  it('hiç varlık yok → Transfer, tüm FK undefined', () => {
    expect(resolvePostShape({})).toEqual({ postType: PostType.Transfer });
  });

  it('yalnız teamId → Team(2)', () => {
    expect(resolvePostShape({ teamId: 't1' })).toEqual({
      postType: PostType.Team,
      teamId: 't1',
    });
  });

  it('yalnız playerId → Player(3)', () => {
    expect(resolvePostShape({ playerId: 'p1' })).toEqual({
      postType: PostType.Player,
      playerId: 'p1',
    });
  });

  it('player+from+to → Transfer(1)', () => {
    expect(
      resolvePostShape({ playerId: 'p1', fromTeamId: 'f1', toTeamId: 'to1' }),
    ).toEqual({
      postType: PostType.Transfer,
      playerId: 'p1',
      fromTeamId: 'f1',
      toTeamId: 'to1',
    });
  });

  it('geçersiz kısmi kombinasyon (yalnız fromTeamId) → 400', () => {
    expect(() => resolvePostShape({ fromTeamId: 'f1' })).toThrow(
      BadRequestException,
    );
  });

  it('player+teamId (çakışan) → 400', () => {
    expect(() => resolvePostShape({ playerId: 'p1', teamId: 't1' })).toThrow(
      BadRequestException,
    );
  });
});
