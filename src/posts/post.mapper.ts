import { PostResponseDto } from './dto/post-response.dto';
import { PostWithRel } from './post.repository';
import { agreePercentage, disagreePercentage, totalVotes } from './vote-math';

export function toPostResponse(
  p: PostWithRel,
  isLiked: boolean,
  userVote?: number,
): PostResponseDto {
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: p.owner.username,
    ownerPhoto: p.owner.profilePic ?? undefined,
    isMailConfirm: p.owner.isMailConfirm,
    userRole: p.owner.role,
    content: p.content,
    postType: p.postType,
    playerId: p.playerId ?? undefined,
    playerName: p.player
      ? `${p.player.firstName} ${p.player.lastName}`
      : undefined,
    playerPhoto: p.player?.photo ?? undefined,
    teamId: p.teamId ?? undefined,
    teamName: p.team?.name,
    teamLogo: p.team?.logo ?? undefined,
    fromTeamId: p.fromTeamId ?? undefined,
    fromTeamName: p.fromTeam?.name,
    fromTeamLogo: p.fromTeam?.logo ?? undefined,
    toTeamId: p.toTeamId ?? undefined,
    toTeamName: p.toTeam?.name,
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
