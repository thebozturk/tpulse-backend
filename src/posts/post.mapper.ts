import { Lang, pickName } from '../common/i18n/lang';
import { PostResponseDto } from './dto/post-response.dto';
import { PostWithRel } from './post.repository';
import { agreePercentage, disagreePercentage, totalVotes } from './vote-math';

export function toPostResponse(
  p: PostWithRel,
  isLiked: boolean,
  lang: Lang,
  userVote?: number,
): PostResponseDto {
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: p.owner.username,
    ownerPhoto: p.owner.profilePic ?? undefined,
    isMailConfirm: p.owner.isMailConfirm,
    userRole: p.owner.role,
    verificationType: p.owner.verificationType,
    content: p.content,
    postType: p.postType,
    playerId: p.playerId ?? undefined,
    playerName: p.player
      ? `${pickName(lang, p.player.firstName, p.player.firstNameTr)} ${pickName(lang, p.player.lastName, p.player.lastNameTr)}`
      : undefined,
    playerNationality: p.player?.nationality ?? undefined,
    playerPhoto: p.player?.photo ?? undefined,
    teamId: p.teamId ?? undefined,
    teamName: p.team ? pickName(lang, p.team.name, p.team.nameTr) : undefined,
    teamLogo: p.team?.logo ?? undefined,
    fromTeamId: p.fromTeamId ?? undefined,
    fromTeamName: p.fromTeam
      ? pickName(lang, p.fromTeam.name, p.fromTeam.nameTr)
      : undefined,
    fromTeamLogo: p.fromTeam?.logo ?? undefined,
    toTeamId: p.toTeamId ?? undefined,
    toTeamName: p.toTeam
      ? pickName(lang, p.toTeam.name, p.toTeam.nameTr)
      : undefined,
    toTeamLogo: p.toTeam?.logo ?? undefined,
    likeCount: p.likeCount,
    isLiked,
    isVotingEnabled: p.isVotingEnabled,
    agreeCount: p.agreeCount,
    disagreeCount: p.disagreeCount,
    totalVotes: totalVotes(p.agreeCount, p.disagreeCount),
    agreePercentage: agreePercentage(p.agreeCount, p.disagreeCount),
    disagreePercentage: disagreePercentage(p.agreeCount, p.disagreeCount),
    userVote,
    createdAtUtc: p.createdAtUtc,
    commentCount: p.commentCount,
    category: p.category ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    sourceUrl: p.sourceUrl ?? undefined,
  };
}
