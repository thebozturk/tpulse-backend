export const FOLLOW_REPOSITORY = Symbol('FOLLOW_REPOSITORY');

export interface IFollowRepository {
  /** Takip kaydı oluşturur. Zaten varsa false (idempotent). */
  create(followerId: string, followingId: string): Promise<boolean>;
  /** Takibi kaldırır. Kayıt yoksa false. */
  remove(followerId: string, followingId: string): Promise<boolean>;
  exists(followerId: string, followingId: string): Promise<boolean>;
  /** Kullanıcının takip ettiklerinin id listesi (feed in-network kaynağı için). */
  getFollowingIds(followerId: string): Promise<string[]>;
  userExists(userId: string): Promise<boolean>;
}
