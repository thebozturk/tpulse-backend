import { BadRequestException } from '@nestjs/common';
import { PostType } from '../common/enums';

interface PostShape {
  postType: number;
  playerId?: string;
  teamId?: string;
  fromTeamId?: string;
  toTeamId?: string;
}

/**
 * docs/01 Post check-constraint: PostType'a göre hangi FK'lerin dolu olacağı.
 * DTO validation (DB constraint ile birlikte) → 400.
 */
export function assertPostShape(p: PostShape): void {
  const { postType, playerId, teamId, fromTeamId, toTeamId } = p;
  const valid =
    (postType === PostType.Transfer &&
      !!playerId &&
      !!fromTeamId &&
      !!toTeamId &&
      !teamId) ||
    (postType === PostType.Team &&
      !!teamId &&
      !playerId &&
      !fromTeamId &&
      !toTeamId) ||
    (postType === PostType.Player &&
      !!playerId &&
      !teamId &&
      !fromTeamId &&
      !toTeamId);
  if (!valid) {
    throw new BadRequestException(
      'PostType ile FK alanları uyumsuz (1:player+from+to, 2:team, 3:player)',
    );
  }
}
