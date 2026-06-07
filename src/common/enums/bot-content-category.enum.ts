/**
 * Bot ingestion içerik kategorisi (smallint saklanır — Post.category).
 * Duyum / Son dakika / Resmi.
 */
export enum BotContentCategory {
  Rumour = 1, // duyum
  Breaking = 2, // son dakika
  Official = 3, // resmi
}

/** API'nin kabul ettiği string anahtarlar (DTO @IsEnum için). */
export const BOT_CONTENT_CATEGORY_KEYS = [
  'Rumour',
  'Breaking',
  'Official',
] as const;
export type BotContentCategoryKey = (typeof BOT_CONTENT_CATEGORY_KEYS)[number];

export const BOT_CATEGORY_BY_KEY: Record<
  BotContentCategoryKey,
  BotContentCategory
> = {
  Rumour: BotContentCategory.Rumour,
  Breaking: BotContentCategory.Breaking,
  Official: BotContentCategory.Official,
};
