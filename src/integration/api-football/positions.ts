/** api-sports genel 4 pozisyon → hardcoded EN/TR Position seti (seed + sync ortak). */
export interface PositionSeed {
  codeEn: string;
  nameEn: string;
  codeTr: string;
  nameTr: string;
}

export const POSITIONS: PositionSeed[] = [
  { codeEn: 'GK', nameEn: 'Goalkeeper', codeTr: 'KL', nameTr: 'Kaleci' },
  { codeEn: 'DEF', nameEn: 'Defender', codeTr: 'DEF', nameTr: 'Defans' },
  { codeEn: 'MID', nameEn: 'Midfielder', codeTr: 'OS', nameTr: 'Orta Saha' },
  { codeEn: 'ATT', nameEn: 'Attacker', codeTr: 'FW', nameTr: 'Forvet' },
];

/** api-sports games.position / seed "position" → Position.codeEn. */
export function positionCode(pos?: string | null): string | null {
  switch (pos) {
    case 'Goalkeeper':
      return 'GK';
    case 'Defender':
      return 'DEF';
    case 'Midfielder':
      return 'MID';
    case 'Attacker':
    case 'Forward':
      return 'ATT';
    default:
      return null;
  }
}
