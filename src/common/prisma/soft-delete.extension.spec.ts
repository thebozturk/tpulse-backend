import { notDeletedWhere } from './soft-delete.extension';

describe('notDeletedWhere', () => {
  it('should inject isDeleted:false when where is undefined', () => {
    expect(notDeletedWhere(undefined)).toEqual({ isDeleted: false });
  });

  it('should inject isDeleted:false and preserve other filters', () => {
    expect(notDeletedWhere({ playerId: 'p1' })).toEqual({
      isDeleted: false,
      playerId: 'p1',
    });
  });

  it('should let explicit isDeleted override the default (admin can read deleted)', () => {
    expect(notDeletedWhere({ isDeleted: true })).toEqual({ isDeleted: true });
  });
});
