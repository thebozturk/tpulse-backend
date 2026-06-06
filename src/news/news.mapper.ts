import { NewsWithRel } from './news.repository';
import { NewsResponseDto } from './dto/news-response.dto';

export function toNewsResponse(news: NewsWithRel): NewsResponseDto {
  return {
    newsId: news.id, // kolon: news_id
    publishDate: news.publishDate,
    playerId: news.player?.id,
    playerName: news.player
      ? `${news.player.firstName} ${news.player.lastName}`
      : undefined,
    playerNationality: news.player?.nationality ?? undefined,
    playerPhoto: news.player?.photo ?? undefined,
    fromTeamId: news.fromTeam?.id,
    fromTeamName: news.fromTeam?.name,
    fromTeamLogo: news.fromTeam?.logo ?? undefined,
    toTeamId: news.toTeam?.id,
    toTeamName: news.toTeam?.name,
    toTeamLogo: news.toTeam?.logo ?? undefined,
    slug: news.slug,
    imageUrl: news.imageUrl ?? undefined,
    sourceName: news.sourceName ?? undefined,
    sourceUrl: news.sourceUrl ?? undefined,
    title: news.title,
    content: news.content ?? undefined,
  };
}
