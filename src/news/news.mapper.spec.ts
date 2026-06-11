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
      firstNameTr: 'Kilyan',
      lastName: 'Mbappe',
      lastNameTr: 'Mbappe',
      nationality: 'France',
      photo: 'm.png',
    },
    fromTeam: { id: 't1', name: 'PSG', nameTr: 'PSG', logo: 'psg.png' },
    toTeam: {
      id: 't2',
      name: 'Real Madrid',
      nameTr: 'Real Madrid',
      logo: 'rm.png',
    },
  } as unknown as NewsWithRel;

  it('maps id to newsId and flattens English player/team names', () => {
    const dto = toNewsResponse(base, 'en');
    expect(dto.newsId).toBe('n1');
    expect(dto.playerName).toBe('Kylian Mbappe');
    expect(dto.fromTeamName).toBe('PSG');
    expect(dto.toTeamName).toBe('Real Madrid');
  });

  it('prefers Turkish names when lang is tr', () => {
    const dto = toNewsResponse(base, 'tr');
    expect(dto.playerName).toBe('Kilyan Mbappe');
  });

  it('falls back to English when Turkish name is missing', () => {
    const dto = toNewsResponse(
      {
        ...base,
        player: {
          id: 'p1',
          firstName: 'Erling',
          firstNameTr: null,
          lastName: 'Haaland',
          lastNameTr: null,
          nationality: 'Norway',
          photo: 'h.png',
        },
        fromTeam: { id: 't1', name: 'Dortmund', nameTr: null, logo: null },
      } as unknown as NewsWithRel,
      'tr',
    );
    expect(dto.playerName).toBe('Erling Haaland');
    expect(dto.fromTeamName).toBe('Dortmund');
  });

  it('handles null player/team relations', () => {
    const dto = toNewsResponse(
      {
        ...base,
        player: null,
        fromTeam: null,
        toTeam: null,
      } as unknown as NewsWithRel,
      'tr',
    );
    expect(dto.playerName).toBeUndefined();
    expect(dto.fromTeamName).toBeUndefined();
    expect(dto.toTeamId).toBeUndefined();
  });
});
