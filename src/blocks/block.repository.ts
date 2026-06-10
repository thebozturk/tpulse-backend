export const BLOCK_REPOSITORY = Symbol('BLOCK_REPOSITORY');

export interface MutedKeywordRow {
  id: string;
  keyword: string;
}

export interface IBlockRepository {
  block(blockerId: string, blockedId: string): Promise<boolean>;
  unblock(blockerId: string, blockedId: string): Promise<boolean>;
  mute(muterId: string, mutedId: string): Promise<boolean>;
  unmute(muterId: string, mutedId: string): Promise<boolean>;
  userExists(userId: string): Promise<boolean>;
  /** Feed bastırma: block ∪ mute edilen yazar id'leri (tekilleştirilmiş). */
  getSuppressedAuthorIds(userId: string): Promise<string[]>;
  /** Eklenmişse satır, zaten varsa null (idempotent). keyword normalize gelmiş olmalı. */
  addKeyword(userId: string, keyword: string): Promise<MutedKeywordRow | null>;
  removeKeyword(userId: string, keywordId: string): Promise<boolean>;
  getKeywords(userId: string): Promise<MutedKeywordRow[]>;
  /** Feed: kullanıcının muted keyword string listesi (normalize/lowercase). */
  getMutedKeywordStrings(userId: string): Promise<string[]>;
}
