import { agreePercentage, disagreePercentage, totalVotes } from './vote-math';

describe('VoteMath', () => {
  it('returns 0 percentages when no votes', () => {
    expect(totalVotes(0, 0)).toBe(0);
    expect(agreePercentage(0, 0)).toBe(0);
    expect(disagreePercentage(0, 0)).toBe(0);
  });

  it('computes rounded agree and complementary disagree', () => {
    expect(agreePercentage(2, 1)).toBe(67); // 2/3 ≈ 66.67 → 67
    expect(disagreePercentage(2, 1)).toBe(33); // 100 - 67
    expect(agreePercentage(1, 1)).toBe(50);
    expect(disagreePercentage(1, 1)).toBe(50);
  });
});
