import { BotContentCategory } from '../common/enums/bot-content-category.enum';
import { PostType } from '../common/enums';

/** Bot içeriğinin akış (Post) dışında yansıyacağı hedef sekme. */
export type ProjectionTarget = 'rumour' | 'transfer' | 'news' | 'none';

/**
 * (postType + category) → yansıma hedefi. Saf, yan etkisiz.
 *
 *  - Transfer şekli + Rumour   → 'rumour'   (Duyumlar)
 *  - Transfer şekli + Official → 'transfer' (Transferler)
 *  - Transfer şekli + Breaking → 'none'     (yalnız akış)
 *  - Team / Player şekli        → 'news'     (Haberler, kategoriden bağımsız)
 */
export function resolveProjectionTarget(
  postType: PostType,
  category: BotContentCategory,
): ProjectionTarget {
  if (postType === PostType.Team || postType === PostType.Player) {
    return 'news';
  }
  // postType === PostType.Transfer
  switch (category) {
    case BotContentCategory.Rumour:
      return 'rumour';
    case BotContentCategory.Official:
      return 'transfer';
    case BotContentCategory.Breaking:
    default:
      return 'none';
  }
}
