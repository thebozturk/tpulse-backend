# for-you-feed

> X (Twitter) "For You" algoritmasının (`x-algorithm`: candidate-pipeline / home-mixer / thunder / phoenix) **mimari desenlerini** tpulse'a uyarlayan skor bazlı feed. Ağır altyapı (gRPC / Kafka / transformer) ALINMAZ; alınan desenler: composable pipeline, multi-signal weighted scoring, author diversity, in/out-of-network ayrımı, iki aşamalı filtreleme, seen/served dedup, negatif sinyaller.

## Amaç

Mevcut kronolojik feed'in (`GET /api/posts`, `ORDER BY createdAtUtc DESC`) yanına, kullanıcıya özel **skorlanmış** "Senin İçin" feed'i eklemek:
- **In-network**: kullanıcının favori oyuncu/takım/haberci'leri (`UserFavourite`) **+** takip ettiği kullanıcılar (yeni `Follow`).
- **Out-of-network (keşif)**: favourite/follow dışından, son saatlerde yüksek engagement-velocity alan ("trend") postlar.
- Her ikisi birleşip ortak skorla sıralanır; çeşitlilik (diversity) ve daha önce görüleni gösterme (seen/served dedup) uygulanır.

Hedef kapsam: **tam ranking pipeline** (kullanıcı onayı). In-network = favourite **ve** follow birlikte. Keşif = trend/popüler bazlı (ML yok).

## Stack notu

Proje **Prisma + PostgreSQL** kullanıyor (CLAUDE.md'deki MongoDB kuralları bu repo için geçerli değil — şema Prisma). Redis `CacheService` (`src/common/redis/cache.service.ts`) mevcut. Async işleme Outbox + BullMQ (`src/messaging/`, `ReactionProcessor`) üstünde.

---

## Mimari — iki katman

### A) Skor üretimi (yazma yolu — async, mevcut Outbox/BullMQ üstünde)

`Post`'a denormalize `hotScore` (Float, indexed) + `scoreUpdatedAt` eklenir. Her like/vote/comment `ReactionProcessor`'dan geçtiğinde hotScore yeniden hesaplanır (HN/Reddit tarzı zaman-sönümlü ağırlıklı engagement):

```
weighted = w_like·likeCount
         + w_vote·(agreeCount + disagreeCount)
         + w_comment·commentCount
         − w_report·reportCount        // negatif sinyal (reports modülünden)

hotScore = weighted / (ageHours + 2)^gravity
```

- Ağırlıklar ve `gravity` **config'ten** gelir (magic number yok → `feed.config.ts`).
- Böylece "trend/keşif" kaynağı tek bir indexed `ORDER BY hotScore DESC` ile ucuza gelir; per-engagement timestamp taraması gerekmez.
- Idempotent: ReactionProcessor zaten idempotent; hotScore recompute son sayaçlardan deterministik.

### B) Feed pipeline (okuma yolu — yeni `src/modules/feed/`)

X candidate-pipeline'ının NestJS interface karşılığı. Stage'ler DI ile inject edilir, `new` yok. Kaynaklar paralel (`Promise.all`), filter/scorer sıralı.

| Stage | Implementasyon |
|-------|----------------|
| **QueryHydration** | favourite id'leri (player/team/reporter) + follow listesi + blocked/muted id'leri + mutedKeyword'ler + Redis "served" seti yüklenir |
| **Sources** (paralel) | `FavouriteSource` (favori konulu postlar, hotScore DESC LIMIT N) · `FollowSource` (takip edilen kullanıcı postları) · `DiscoverySource` (global hotScore top-M, in-network dışı) |
| **Hydrators** | author bilgisi, recency, `inNetwork: boolean` flag |
| **Filters (pre-scoring)** | `DropDuplicatesFilter` · `SelfPostFilter` · `BlockedAuthorFilter` (block/mute) · `MutedKeywordFilter` · `AgeFilter` · `SeenServedFilter` (Redis served + client-sent seen) |
| **Scorers (sıralı)** | `AffinityScorer` (favourite + follow bonusu) → `WeightedScorer` (hotScore × affinity, negatif sinyaller offset) → `AuthorDiversityScorer` ((1−floor)·decay^pozisyon + floor) → `OonScorer` (keşif içeriğini hafif söndür) |
| **Selector** | final skora göre sırala, top-K |
| **Post-Selection Filters** | `DedupConversationFilter` / son görünürlük |
| **SideEffects** (async, non-blocking) | sunulan post id'lerini Redis "served" setine yaz (sonraki sayfa dedup) + feed sayfasını cache'le |

**Boş-favourite/follow fallback**: hiç sinyal yoksa pipeline tamamen DiscoverySource'a düşer (cold start).

---

## API

- `GET /api/feed/for-you` → `PagedResult<FeedItemDto>`
  - Query: `cursor?` veya `page`/`pageSize`, `seenIds?` (client-sent, opsiyonel)
  - `@UseGuards(JwtAuthGuard)` — kişiye özel
  - Response: `{ data: FeedItemDto[], meta: { cursor?, timestamp } }`
- `POST /api/users/:id/follow` · `DELETE /api/users/:id/follow` — follow grafiği (`@Throttle`)
- `POST /api/users/:id/block` · `DELETE /api/users/:id/block`
- `POST /api/users/:id/mute` · `DELETE /api/users/:id/mute`
- `POST /me/muted-keywords` · `DELETE /me/muted-keywords/:id` — muted keyword yönetimi

Mevcut `GET /api/posts` (kronolojik) **dokunulmaz** — yan yana yaşar.

---

## Veri modeli (Prisma)

**Değişen — `Post`:**
```prisma
hotScore       Float    @default(0)
scoreUpdatedAt DateTime @default(now()) @db.Timestamptz
// + @@index([hotScore(sort: Desc)])
// + discovery in-network dışı sorgular için kombinasyon index'leri
```

**Yeni:**
```prisma
model Follow {
  id          String   @id @default(uuid()) @db.Uuid
  followerId  String   @db.Uuid
  followingId String   @db.Uuid
  createdAt   DateTime @default(now()) @db.Timestamptz
  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
  @@map("follow")
}

model UserBlock { /* blockerId, blockedId, unique, createdAt */ }
model UserMute  { /* muterId, mutedId, unique, createdAt */ }
model MutedKeyword { /* userId, keyword (lowercase, trim), unique(userId,keyword) */ }
```

**Redis (DB değil):** per-user `served` seti — TTL'li sorted set (`CacheService` üstünde), ör. `tpulse:feed:served:<userId>`, TTL ~24s/ saat.

---

## Kurallar

- Stage'ler interface + DI; `new` ile instantiation yok. Her stage tek sorumluluk (SRP).
- Tüm skor ağırlıkları / decay / gravity / LIMIT'ler `feed.config.ts` (ConfigService) — hardcode yok.
- Sources paralel (`Promise.all` / `allSettled` graceful degradation), filter & scorer sıralı.
- DiscoverySource hatası feed'i düşürmez (degrade → sadece in-network).
- Negatif sinyaller skoru düşürür: report (post), block/mute (author) → filtre + ağırlık.
- Diversity: aynı author'dan art arda gösterim `decay^pozisyon` ile söndürülür.
- Seen/served: aynı oturumda/24s içinde sunulan tekrar gösterilmez.
- `select: false` hassas alanlarda korunur; FeedItemDto'da sensitive alan yok.
- Controller: `@ApiOperation`, `@ApiResponse`, `@UseGuards`, mutating endpoint'lerde `@Throttle`.

---

## Test

- **Unit**:
  - Her scorer'ın matematiği (weighted sum, affinity bonus, diversity decay, oon attenuation).
  - hotScore decay formülü (yaş arttıkça düşer; negatif sinyal düşürür).
  - Her filter `{kept, removed}` doğruluğu (blocked/muted/self/age/seen).
- **Integration**: `PipelineRunner` — paralel source + sıralı stage akışı; bir source çökerse degrade.
- **E2E** (`GET /api/feed/for-you`):
  - Favourite/follow postları skorda bonus alır.
  - Aynı author art arda söndürülür (diversity).
  - Daha önce served post tekrar gelmez.
  - Boş favourite/follow → discovery fallback (cold start).
  - 401 guard, 400 invalid query.
- Coverage: scorer/filter >80% lines.

---

## Dependencies

Yeni paket gerekmez (mevcut: Prisma, BullMQ, ioredis/CacheService, class-validator, swagger). Opsiyonel: metrics için mevcut observability altyapısı.

---

## Env / Config (`feed.config.ts` → env)

```
FEED_W_LIKE=1
FEED_W_VOTE=0.5
FEED_W_COMMENT=2
FEED_W_REPORT=5            # negatif
FEED_GRAVITY=1.5
FEED_AFFINITY_FAVOURITE=1.3
FEED_AFFINITY_FOLLOW=1.5
FEED_DIVERSITY_DECAY=0.5
FEED_DIVERSITY_FLOOR=0.1
FEED_OON_ATTENUATION=0.8   # keşif içeriği çarpanı
FEED_SOURCE_LIMIT=200      # source başına aday havuzu
FEED_RESULT_SIZE=30
FEED_SERVED_TTL_SECONDS=86400
FEED_AGE_MAX_HOURS=168
```
Tümü `.env.example`'a placeholder ile girer.

---

## Build sırası (fazlar)

**Faz 1 — Skorlu sıralama temeli**
1. Prisma migrate: `Post.hotScore` + `scoreUpdatedAt` + index; `Follow` tablosu.
2. `ReactionProcessor` → engagement sonrası hotScore recompute (config ağırlıklar).
3. `feed.config.ts` + pipeline interface'leri (`pipeline/`) + `PipelineRunner`.
4. `FavouriteSource` + `FollowSource` + `WeightedScorer` + `TopKSelector`.
5. `GET /api/feed/for-you` + follow endpoint'leri + DTO + testler.

**Faz 2 — Keşif + çeşitlilik + dedup**
6. `DiscoverySource` (global hotScore, in-network dışı) + `OonScorer`.
7. `AuthorDiversityScorer`.
8. `SeenServedFilter` + Redis served SideEffect.

**Faz 3 — Negatif sinyal + cache + gözlemlenebilirlik**
9. `UserBlock`/`UserMute`/`MutedKeyword` + ilgili filter & endpoint'ler.
10. Feed sayfası cache (tag-based invalidation, post create/engagement'ta).
11. Pipeline metrics (stage latency, filter removed count, source hit).

---

## X-algorithm eşlemesi (referans)

| X bileşeni | Bizim karşılık |
|-----------|----------------|
| candidate-pipeline (Source/Hydrator/Filter/Scorer/Selector/SideEffect trait'leri) | `pipeline/` interface'leri + `PipelineRunner` |
| Thunder (in-network in-memory store) | `FavouriteSource` + `FollowSource` (Postgres + hotScore index; in-memory store gerekmez) |
| Phoenix retrieval (out-of-network ML) | `DiscoverySource` (ML yok → hotScore tabanlı trend) |
| Phoenix ranking (multi-action transformer) | `WeightedScorer` (denormalize hotScore + affinity, ML yok) |
| Author Diversity Scorer | `AuthorDiversityScorer` (aynı decay formülü) |
| Pre/Post-selection filters | iki aşamalı filter chain |
| PreviouslyServed/SeenPostsFilter | `SeenServedFilter` + Redis served set |
| Negatif weighted sinyaller (block/mute/report) | report + UserBlock/UserMute ağırlık & filtre |
| Grok content understanding (spam) | kapsam dışı (mevcut `reports` modülü + admin moderasyon yeterli) |
