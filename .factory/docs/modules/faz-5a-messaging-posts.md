# faz-5a-messaging-posts

> Faz 5 (Sosyal) 1/2. Kaynak: docs/02-04. Messaging altyapısı (outbox + BullMQ + cron) + Post CRUD/feed (async 202 create/like, sync vote). Comments → 5b. onlyFavourites → Faz 6. Player profile → 5b sonrası.

## Amaç

Async write path kurulumu + Post feed/CRUD. post create & like/unlike **202 + outbox**; vote **senkron 200**. Like-state hidrasyonu (OptionalJwtGuard).

## Kararlar

- **Async model:** outbox + BullMQ + cron(1dk) dispatcher + idempotent processor (Redis lock). Tek process (Faz 0). 202 davranışı korunur.
- **Comments 5b'ye**, onlyFavourites feed **Faz 6'ya** (post repo favourite-targets param'ı hazır ama pasif; onlyFavourites=true → auth 401 + boş feed).
- player profile → posts+news+transfers aggregation, 5b sonrası ayrı.

## Paketler

`@nestjs/bullmq bullmq @nestjs/schedule` (+ Redis bağlantısı mevcut RedisModule/config'ten).

## Messaging (`src/messaging/`)

- **BullModule.forRootAsync** (Redis connection config'ten) + `outbox` queue.
- **OutboxService:** `enqueue(eventType, payload)` → OutboxMessage satırı (retryCount=0, processedAtUtc=null).
- **OutboxDispatcher** (`@Cron('*/1 * * * *')`): processedAtUtc=null && retryCount<10 (batch 250) → her birini BullMQ `outbox` queue'ya `add({messageId}, {jobId: messageId, attempts:5, backoff})`. jobId=messageId → kuyruğa duplicate eklenmez.
- **ReactionProcessor** (`@Processor('outbox')`): job.messageId → OutboxMessage yükle → idempotency Redis lock `job:outbox:{messageId}` (SET NX, TTL 10dk) → eventType switch:
  - `post.create` → Post oluştur (payload'dan)
  - `post.reaction` → like/unlike uygula + likeCount güncelle
  - (comment.* → 5b)
  - başarı: processedAtUtc=now; hata: retryCount++ + lastError, throw (BullMQ attempts:5 retry).
- Event tipleri: `PostCreateEvent {userId,content,postType,isVotingEnabled,playerId?,teamId?,fromTeamId?,toTeamId?,createdAtUtc}`, `PostReactionEvent {postId,userId,isLike}`.

## Post endpoint'leri (docs/02)

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/api/posts/new-count` | public | `{count}` (afterPostId zorunlu) |
| GET | `/api/posts` | OptionalJwt | paged PostDto (onlyFavourites=true → auth 401, Faz 6 filtre) |
| GET | `/api/posts/:id` | OptionalJwt | `{data:PostDto}` (like state) / 404 |
| GET | `/api/posts/by-player/:playerId` | OptionalJwt | `{items}` |
| GET | `/api/posts/by-team/:teamId` | OptionalJwt | `{items}` |
| GET | `/api/posts/my` | auth | `{items}` |
| POST | `/api/posts` | auth | **202** (outbox) / 400 (PostType shape) |
| POST | `/api/posts/:id/vote` | auth | 200 `{data:PostVoteResult}` / 400 / 404 (SENKRON) |
| PUT | `/api/posts/:id` | auth | 200 / 403 / 404 |
| DELETE | `/api/posts/:id` | auth | 200 / 403 / 404 |
| POST | `/api/posts/:id/like` | auth | **202** / 200 `{unchanged}` / 404 |
| DELETE | `/api/posts/:id/like` | auth | **202** / 200 `{unchanged}` / 404 |

> like/unlike: önce post var mı (404) + mevcut like durumu senkron kontrol → zaten istenen durumdaysa 200 `{unchanged:true}`, değilse outbox enqueue → 202.

## OptionalJwtGuard

passport-jwt tabanlı; token yoksa/invalidse `request.user=undefined` (throw etmez). GET feed/detail'de like-state hidrasyonu için. `src/common/guards/optional-jwt.guard.ts`.

## DTO'lar (docs/03)

- **PostDto:** id, ownerId, ownerName, ownerPhoto?, isMailConfirm, userRole, content, postType, player*(id/name/photo)?, team*(id/name/logo)?, fromTeam*, toTeam*, likeCount, isLiked, isVotingEnabled, agreeCount, disagreeCount, totalVotes(comp), agreePercentage(comp), disagreePercentage(comp), userVote?, createdAtUtc, commentCount
- **CreatePostDto:** content(≤5000), postType(IsEnum PostType), playerId?, teamId?, fromTeamId?, toTeamId?, isVotingEnabled. **PostType shape** custom validation (1=player+from+to/team null; 2=team; 3=player) → 400.
- **UpdatePostDto:** content(≤5000), playerId?, teamId?, fromTeamId?, toTeamId?
- **PostFilterDto:** playerId?, teamId?, ownerId?, search?, onlyFavourites=false, page, pageSize≤100
- **VotePostDto:** choice(IsEnum PostVoteChoice) · **PostVoteResultDto:** result(Invalid|Unchanged|Applied), agreeCount, disagreeCount, totalVotes, agreePercentage, disagreePercentage, userVote?

## VoteMath (docs/03 §6 — birebir)

```
total = a+d; agreePct = t===0?0:round(a*100/t); disagreePct = t===0?0:100-agreePct
PostVoteApplyResult: Invalid (post yok/voting kapalı) | Unchanged (aynı oy) | Applied
```

## Yapı

```
src/messaging/ (messaging.module, outbox.service, outbox.dispatcher, reaction.processor, events.ts)
src/posts/ (post.repository + prisma-post.repository, posts.service, posts.controller,
            post.mapper, dto/)
src/common/guards/optional-jwt.guard.ts
```
PostsModule imports MessagingModule (OutboxService). MessagingModule processor PrismaService kullanır (Post create/like). app.module: BullModule root + ScheduleModule.forRoot + MessagingModule + PostsModule.

## Test

- **Unit:** vote-math (yüzdeler, Invalid/Unchanged/Applied), posts.service (feed map + like-state, create→enqueue 202, like unchanged kontrol, update/delete 403 ownership), post-shape validator (postType FK doluluk), outbox.service (enqueue satır), reaction.processor (post.create→Post, idempotency lock).
- **E2E (infra+BullMQ):** POST /posts → 202 → (cron/job bekle) → GET /posts'ta görünür; like → 202 → likeCount artar; tekrar like → 200 unchanged; vote → yüzdeler; PUT başkası → 403; PostType shape 400.

## Doğrulama (docs/06 Faz 5 — 5a)

- [ ] post create 202 → job sonrası DB'de + feed'de görünür.
- [ ] like/unlike 202, idempotent (job tekrarı çift like yapmaz); unchanged 200.
- [ ] vote senkron, VoteMath yüzdeleri doğru.
- [ ] like-state hidrasyonu (auth varsa isLiked/userVote).
- [ ] PostType shape 400; ownership 403.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. Paketler + BullModule/ScheduleModule wiring.
2. MessagingModule (outbox.service, dispatcher cron, reaction.processor, events).
3. OptionalJwtGuard + post DTO'lar + shape validator + VoteMath.
4. PostRepository + PostsService (read/like-state, async create/like, sync vote, ownership).
5. PostsController.
6. Unit + e2e (BullMQ job bekleme) + tsc + lint + commit.

## Sonraki

Faz 5b — comments (post-comments async 202 + transfer-comments sync) + like-state + reaction.processor comment handler'ları + player profile.
