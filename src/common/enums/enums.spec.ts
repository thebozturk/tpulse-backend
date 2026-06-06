import {
  FavouriteType,
  NotificationEventType,
  PostType,
  PostVoteChoice,
  SyncRunStatus,
} from './index';

describe('domain enums (docs/01 smallint değerleri)', () => {
  it('PostType maps to stored smallint values', () => {
    expect(PostType.Transfer).toBe(1);
    expect(PostType.Team).toBe(2);
    expect(PostType.Player).toBe(3);
  });

  it('PostVoteChoice matches check constraint IN(1,2)', () => {
    expect(PostVoteChoice.Disagree).toBe(1);
    expect(PostVoteChoice.Agree).toBe(2);
  });

  it('FavouriteType covers all 4 targets', () => {
    expect([
      FavouriteType.League,
      FavouriteType.Team,
      FavouriteType.Player,
      FavouriteType.Reporter,
    ]).toEqual([1, 2, 3, 4]);
  });

  it('NotificationEventType matches dedup event types', () => {
    expect(NotificationEventType.Rumour).toBe(1);
    expect(NotificationEventType.Transfer).toBe(2);
  });

  it('SyncRunStatus starts at 0 (Success)', () => {
    expect(SyncRunStatus.Success).toBe(0);
    expect(SyncRunStatus.Partial).toBe(1);
    expect(SyncRunStatus.Failed).toBe(2);
  });
});
