import { PostWithRel } from '../../posts/post.repository';
import { PostFavouriteTargets } from '../../posts/post.repository';

/**
 * X (Twitter) candidate-pipeline desenine uyarlanmış soyutlamalar.
 * Her stage bağımsız ve tek sorumluluklu — yeni source/filter/scorer eklemek
 * mevcut kodu değiştirmeden mümkün.
 */

export type CandidateOrigin = 'favourite' | 'follow' | 'discovery';

/** Query hydration sonucu — pipeline'ın çalışacağı kullanıcı bağlamı. */
export interface FeedQuery {
  userId: string;
  page: number;
  pageSize: number;
  /** Favori hedefleri (in-network: konu ilgisi — oyuncu/takım/haberci). */
  favourite: PostFavouriteTargets;
  /** Takip edilen kullanıcı id'leri (in-network: kişi ilgisi). */
  followingIds: string[];
  /** Daha önce sunulan (Redis served) + client-sent görülen post id'leri. */
  seenIds: Set<string>;
}

/** Pipeline boyunca taşınan aday: post + ara skor + köken(ler). */
export interface Candidate {
  post: PostWithRel;
  score: number;
  origins: Set<CandidateOrigin>;
}

/** Aday üreten kaynak (in-network / out-of-network). Paralel çalışır. */
export interface Source {
  readonly name: string;
  fetch(query: FeedQuery): Promise<Candidate[]>;
}

/** Aday eleyen filtre. Sıralı çalışır; { kept, removed } döner. */
export interface Filter {
  readonly name: string;
  apply(
    candidates: Candidate[],
    query: FeedQuery,
  ): { kept: Candidate[]; removed: Candidate[] };
}

/** Aday skorlayan stage. Sıralı çalışır; skoru günceller. */
export interface Scorer {
  readonly name: string;
  score(candidates: Candidate[], query: FeedQuery): Candidate[];
}

/** Skora göre sıralayıp sonuç havuzunu seçer. */
export interface Selector {
  select(candidates: Candidate[], query: FeedQuery): Candidate[];
}

/** Runner'a verilen stage seti. */
export interface PipelineStages {
  sources: Source[];
  filters: Filter[];
  scorers: Scorer[];
  selector: Selector;
}

/** Yeni aday yardımcısı. */
export function toCandidate(
  post: PostWithRel,
  origin: CandidateOrigin,
): Candidate {
  return { post, score: 0, origins: new Set([origin]) };
}
