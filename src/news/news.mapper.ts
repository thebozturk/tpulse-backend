import { NewsWithRel } from './news.repository';
import { NewsResponseDto } from './dto/news-response.dto';
import { Lang, pickName } from '../common/i18n/lang';

export function toNewsResponse(news: NewsWithRel, lang: Lang): NewsResponseDto {
  return {
    newsId: news.id, // kolon: news_id
    publishDate: news.publishDate,
    playerId: news.player?.id,
    playerName: news.player
      ? `${pickName(lang, news.player.firstName, news.player.firstNameTr)} ${pickName(lang, news.player.lastName, news.player.lastNameTr)}`
      : undefined,
    playerNationality: news.player?.nationality ?? undefined,
    playerPhoto: news.player?.photo ?? undefined,
    fromTeamId: news.fromTeam?.id,
    fromTeamName: news.fromTeam
      ? pickName(lang, news.fromTeam.name, news.fromTeam.nameTr)
      : undefined,
    fromTeamLogo: news.fromTeam?.logo ?? undefined,
    toTeamId: news.toTeam?.id,
    toTeamName: news.toTeam
      ? pickName(lang, news.toTeam.name, news.toTeam.nameTr)
      : undefined,
    toTeamLogo: news.toTeam?.logo ?? undefined,
    slug: news.slug,
    imageUrl: news.imageUrl ?? undefined,
    sourceName: news.sourceName ?? undefined,
    sourceUrl: news.sourceUrl ?? undefined,
    title: news.title,
    content: news.content ?? undefined,
  };
}
