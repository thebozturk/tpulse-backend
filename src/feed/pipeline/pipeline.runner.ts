import { Injectable, Logger } from '@nestjs/common';
import { Candidate, FeedQuery, PipelineStages } from './types';

/**
 * Candidate-pipeline orkestratörü:
 *   sources (paralel, graceful) → dedup → filters (sıralı) → scorers (sıralı) → selector
 *
 * Bir source çökerse feed düşmez (degrade) — yalnızca o kaynağın adayları eksilir.
 */
@Injectable()
export class PipelineRunner {
  private readonly logger = new Logger(PipelineRunner.name);

  async run(query: FeedQuery, stages: PipelineStages): Promise<Candidate[]> {
    // 1. Kaynaklar paralel — biri çökerse diğerleri devam eder.
    const results = await Promise.allSettled(
      stages.sources.map((s) => s.fetch(query)),
    );
    const all: Candidate[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      } else {
        this.logger.warn(
          `source '${stages.sources[i].name}' başarısız: ${String(r.reason)}`,
        );
      }
    });

    // 2. Aynı post birden çok kaynaktan gelebilir → birleştir, köken(leri) topla.
    let candidates = this.dedup(all);

    // 3. Filtreler sıralı.
    for (const filter of stages.filters) {
      candidates = filter.apply(candidates, query).kept;
    }

    // 4. Skorlayıcılar sıralı (her biri bir öncekinin skorunu işler).
    for (const scorer of stages.scorers) {
      candidates = scorer.score(candidates, query);
    }

    // 5. Seçim (sırala + havuzu kırp).
    return stages.selector.select(candidates, query);
  }

  private dedup(candidates: Candidate[]): Candidate[] {
    const byId = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = byId.get(c.post.id);
      if (existing) {
        c.origins.forEach((o) => existing.origins.add(o));
      } else {
        byId.set(c.post.id, {
          post: c.post,
          score: c.score,
          origins: new Set(c.origins),
        });
      }
    }
    return [...byId.values()];
  }
}
