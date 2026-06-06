import { NewsWithRel } from './news.repository';
import { toNewsResponse } from './news.mapper';

describe('toNewsResponse', () => {
  const base = {
    id: 'n1',
    publishDate: new Date('2026-01-01'),
    playerId: 'p1',
    fromTeamId: 't1',
    toTeamId: 't2',
    slug: 'big-move',
    imageUrl: null,
    sourceName: 'BBC',
    sourceUrl: null,
    title: 'Big move',
    content: null,
    player: {
      id: 'p1',
      firstName: 'Kylian',
      lastName: 'Mbappe',
      nationality: 'France',
      photo: 'm.png',
    },
    fromTeam: { id: 't1', name: 'PSG', logo: 'psg.png' },
    toTeam: { id: 't2', name: 'Real Madrid', logo: 'rm.png' },
  } as unknown as NewsWithRel;

  it('maps id to newsId and flattens player/team names', () => {
    const dto = toNewsResponse(base);
    expect(dto.newsId).toBe('n1');
    expect(dto.playerName).toBe('Kylian Mbappe');
    expect(dto.fromTeamName).toBe('PSG');
    expect(dto.toTeamName).toBe('Real Madrid');
  });

  it('handles null player/team relations', () => {
    const dto = toNewsResponse({
      ...base,
      player: null,
      fromTeam: null,
      toTeam: null,
    } as unknown as NewsWithRel);
    expect(dto.playerName).toBeUndefined();
    expect(dto.fromTeamName).toBeUndefined();
    expect(dto.toTeamId).toBeUndefined();
  });
});
