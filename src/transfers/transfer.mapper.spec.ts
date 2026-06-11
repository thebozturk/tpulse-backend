import { TransferWithRel } from './transfer.repository';
import { toTeamTransferLine, toTransferResponse } from './transfer.mapper';

const base = {
  id: 'tr1',
  playerId: 'p1',
  fromTeamId: 'ft',
  toTeamId: 'tt',
  feeAmount: 1000000,
  feeCurrency: 'EUR',
  transferDate: new Date('2026-01-01'),
  createdByUserId: null,
  isRumour: false,
  isDeleted: false,
  source: 'Manual',
  createdAt: new Date('2026-01-02'),
  updatedAt: null,
  player: {
    id: 'p1',
    firstName: 'Kylian',
    lastName: 'Mbappe',
    firstNameTr: null,
    lastNameTr: null,
    photo: 'm.png',
    nationality: 'France',
    teamId: 'tt',
    position: { nameEn: 'Striker' },
    team: { name: 'Real Madrid', nameTr: null },
  },
  fromTeam: { id: 'ft', name: 'PSG', nameTr: null, logo: 'psg.png' },
  toTeam: { id: 'tt', name: 'Real Madrid', nameTr: null, logo: 'rm.png' },
  createdByUser: null,
} as unknown as TransferWithRel;

describe('transfer.mapper', () => {
  it('toTransferResponse flattens nested entities and converts fee to number', () => {
    const dto = toTransferResponse(base, 'en');
    expect(dto.player.name).toBe('Kylian Mbappe');
    expect(dto.player.positionName).toBe('Striker');
    expect(dto.player.teamName).toBe('Real Madrid');
    expect(dto.fromTeam.name).toBe('PSG');
    expect(typeof dto.feeAmount).toBe('number');
    expect(dto.feeAmount).toBe(1000000);
    expect(dto.createdBy).toBeUndefined();
  });

  it('toTransferResponse maps createdBy when present', () => {
    const dto = toTransferResponse(
      {
        ...base,
        createdByUser: {
          id: 'u1',
          username: 'reporter',
          profilePic: null,
          role: 'Reporter',
        },
      } as unknown as TransferWithRel,
      'en',
    );
    expect(dto.createdBy).toEqual({
      id: 'u1',
      username: 'reporter',
      photo: undefined,
      role: 'Reporter',
    });
  });

  it('toTeamTransferLine produces leaner line shape', () => {
    const line = toTeamTransferLine(base, 'en');
    expect(line).toMatchObject({
      transferId: 'tr1',
      playerName: 'Kylian Mbappe',
      fromTeamName: 'PSG',
      toTeamName: 'Real Madrid',
      feeAmount: 1000000,
    });
  });

  it('toTransferResponse prefers Turkish names when lang=tr', () => {
    const tr = toTransferResponse(
      {
        ...base,
        player: {
          ...base.player,
          firstNameTr: 'Kilyan',
          lastNameTr: 'Mbape',
          team: { name: 'Real Madrid', nameTr: 'Real Madrid TR' },
        },
        fromTeam: { id: 'ft', name: 'PSG', nameTr: 'PSG TR', logo: 'psg.png' },
      } as unknown as TransferWithRel,
      'tr',
    );
    expect(tr.player.name).toBe('Kilyan Mbape');
    expect(tr.player.teamName).toBe('Real Madrid TR');
    expect(tr.fromTeam.name).toBe('PSG TR');
  });
});
