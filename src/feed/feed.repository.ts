import { PostFavouriteTargets, PostWithRel } from '../posts/post.repository';

export const FEED_REPOSITORY = Symbol('FEED_REPOSITORY');

/**
 * Feed aday havuzunu hotScore'a göre çeker. Skorlama (affinity/diversity)
 * uygulamada yapılır; DB yalnızca aday üretir.
 */
export interface IFeedRepository {
  /** Favori konu (oyuncu/takım/haberci) ile eşleşen postlar, hotScore DESC. */
  byFavourite(
    targets: PostFavouriteTargets,
    limit: number,
  ): Promise<PostWithRel[]>;
  /** Takip edilen yazarların postları, hotScore DESC. */
  byAuthors(authorIds: string[], limit: number): Promise<PostWithRel[]>;
  /** Out-of-network keşif: global hotScore DESC (kişiselleştirilmemiş — cacheable).
   *  Viewer'ın kendi postları SelfPostFilter'da elenir. */
  discovery(limit: number): Promise<PostWithRel[]>;
}
