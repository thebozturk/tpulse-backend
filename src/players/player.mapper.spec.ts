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
    firstNameTr: 'Bukayo',
    lastNameTr: 'Saka',
    teamId: 't1',
    positionId: 'pos1',
    team: { name: 'Arsenal', nameTr: 'Arsenal', logo: 'ars.png' },
    position: { nameEn: 'Right Winger' },
  } as unknown as PlayerWithRel;

  it('computes fullName and flattens team/position', () => {
    const dto = toPlayerResponse(base, 'en');
    expect(dto.fullName).toBe('Bukayo Saka');
    expect(dto.teamName).toBe('Arsenal');
    expect(dto.teamLogo).toBe('ars.png');
    expect(dto.positionName).toBe('Right Winger');
  });

  it('maps nulls to undefined and handles missing position', () => {
    const dto = toPlayerResponse(
      {
        ...base,
        position: null,
        positionId: null,
        weight: null,
      } as unknown as PlayerWithRel,
      'en',
    );
    expect(dto.positionName).toBeUndefined();
    expect(dto.positionId).toBeUndefined();
    expect(dto.weight).toBeUndefined();
  });

  it('returns Turkish names when lang=tr and falls back to English when missing', () => {
    const dto = toPlayerResponse(
      {
        ...base,
        firstNameTr: 'Bukayo',
        lastNameTr: null,
        team: { name: 'Arsenal', nameTr: 'Arsenal FK', logo: 'ars.png' },
      } as unknown as PlayerWithRel,
      'tr',
    );
    expect(dto.fullName).toBe('Bukayo Saka');
    expect(dto.teamName).toBe('Arsenal FK');
  });
});
