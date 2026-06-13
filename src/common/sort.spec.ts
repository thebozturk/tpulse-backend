import { parseSort } from './sort';

describe('parseSort', () => {
  const allowed = new Set(['createdAt', 'feeAmount', 'transferDate']);

  it('returns null when sort is undefined', () => {
    expect(parseSort(undefined, allowed)).toBeNull();
  });

  it('parses ascending field', () => {
    expect(parseSort('feeAmount', allowed)).toEqual({
      field: 'feeAmount',
      direction: 'asc',
    });
  });

  it('parses descending field with leading dash', () => {
    expect(parseSort('-feeAmount', allowed)).toEqual({
      field: 'feeAmount',
      direction: 'desc',
    });
  });

  it('returns null for whitelist-dışı field (default sıralamaya düşer)', () => {
    expect(parseSort('password', allowed)).toBeNull();
    expect(parseSort('-secret', allowed)).toBeNull();
  });
});
