import { positionCode } from './positions';

describe('positionCode', () => {
  it('maps api-sports general positions to codes', () => {
    expect(positionCode('Goalkeeper')).toBe('GK');
    expect(positionCode('Defender')).toBe('DEF');
    expect(positionCode('Midfielder')).toBe('MID');
    expect(positionCode('Attacker')).toBe('ATT');
  });

  it('returns null for unknown/empty', () => {
    expect(positionCode('Coach')).toBeNull();
    expect(positionCode(undefined)).toBeNull();
  });
});
