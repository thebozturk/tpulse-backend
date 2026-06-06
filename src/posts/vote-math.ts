/** docs/03 §6 VoteMath — birebir taşındı. */
export function totalVotes(agree: number, disagree: number): number {
  return agree + disagree;
}

export function agreePercentage(agree: number, disagree: number): number {
  const t = totalVotes(agree, disagree);
  return t === 0 ? 0 : Math.round((agree * 100) / t);
}

export function disagreePercentage(agree: number, disagree: number): number {
  const t = totalVotes(agree, disagree);
  return t === 0 ? 0 : 100 - agreePercentage(agree, disagree);
}
