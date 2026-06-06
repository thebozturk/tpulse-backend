import { PlayerWithRel } from './player.repository';
import { toPlayerResponse } from './player.mapper';

describe('toPlayerResponse', () => {
  const base = {
    id: 'p1',
    firstName: 'Bukayo',
    lastName: 'Saka',
    nationality: 'England',
    birthDate: null,
    height: 178,
    weight: null,
    photo: null,
    birthPlace: null,
    birthCountry: null,
    isFree: false,
    photoLockedByAdmin: false,
    photoSourceUrl: null,
    externalId: null,
    teamId: 't1',
    positionId: 'pos1',
    team: { name: 'Arsenal', logo: 'ars.png' },
    position: { nameEn: 'Right Winger' },
  } as unknown as PlayerWithRel;

  it('computes fullName and flattens team/position', () => {
    const dto = toPlayerResponse(base);
    expect(dto.fullName).toBe('Bukayo Saka');
    expect(dto.teamName).toBe('Arsenal');
    expect(dto.teamLogo).toBe('ars.png');
    expect(dto.positionName).toBe('Right Winger');
  });

  it('maps nulls to undefined and handles missing position', () => {
    const dto = toPlayerResponse({
      ...base,
      position: null,
      positionId: null,
      weight: null,
    } as unknown as PlayerWithRel);
    expect(dto.positionName).toBeUndefined();
    expect(dto.positionId).toBeUndefined();
    expect(dto.weight).toBeUndefined();
  });
});
