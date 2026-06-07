import { BadRequestException } from '@nestjs/common';
import { PostType } from '../common/enums';

export interface EntityRefs {
  playerId?: string;
  teamId?: string;
  fromTeamId?: string;
  toTeamId?: string;
}

export interface ResolvedShape extends EntityRefs {
  postType: number;
}

const has = (v?: string): boolean => !!v;

/**
 * Bot içeriğinin varlık referanslarını, DB `post_type_shape_chk` constraint'ine
 * UYUMLU bir (postType + FK) shape'ine çevirir:
 *  - hiç varlık yok            → postType=Transfer, tüm FK null  (constraint "hepsi null" kolu)
 *  - yalnız teamId             → postType=Team(2)
 *  - yalnız playerId           → postType=Player(3)
 *  - playerId+fromTeamId+toTeamId (teamId yok) → postType=Transfer(1)
 *  - diğer kısmi kombinasyon   → 400 (constraint'i ihlal ederdi)
 */
export function resolvePostShape(refs: EntityRefs): ResolvedShape {
  const { playerId, teamId, fromTeamId, toTeamId } = refs;

  if (!has(playerId) && !has(teamId) && !has(fromTeamId) && !has(toTeamId)) {
    return { postType: PostType.Transfer };
  }
  if (has(teamId) && !has(playerId) && !has(fromTeamId) && !has(toTeamId)) {
    return { postType: PostType.Team, teamId };
  }
  if (has(playerId) && !has(teamId) && !has(fromTeamId) && !has(toTeamId)) {
    return { postType: PostType.Player, playerId };
  }
  if (has(playerId) && has(fromTeamId) && has(toTeamId) && !has(teamId)) {
    return { postType: PostType.Transfer, playerId, fromTeamId, toTeamId };
  }
  throw new BadRequestException(
    'Geçersiz varlık kombinasyonu: hiç / yalnız teamId / yalnız playerId / playerId+fromTeamId+toTeamId',
  );
}
