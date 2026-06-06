import { BadRequestException } from '@nestjs/common';
import { PostType } from '../common/enums';
import { assertPostShape } from './post-shape';

describe('assertPostShape', () => {
  it('accepts Transfer (1): player + from + to, no team', () => {
    expect(() =>
      assertPostShape({
        postType: PostType.Transfer,
        playerId: 'p',
        fromTeamId: 'f',
        toTeamId: 't',
      }),
    ).not.toThrow();
  });

  it('accepts Team (2): team only', () => {
    expect(() =>
      assertPostShape({ postType: PostType.Team, teamId: 't' }),
    ).not.toThrow();
  });

  it('accepts Player (3): player only', () => {
    expect(() =>
      assertPostShape({ postType: PostType.Player, playerId: 'p' }),
    ).not.toThrow();
  });

  it('rejects Transfer missing toTeam', () => {
    expect(() =>
      assertPostShape({
        postType: PostType.Transfer,
        playerId: 'p',
        fromTeamId: 'f',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects Player with extra team', () => {
    expect(() =>
      assertPostShape({
        postType: PostType.Player,
        playerId: 'p',
        teamId: 't',
      }),
    ).toThrow(BadRequestException);
  });
});
