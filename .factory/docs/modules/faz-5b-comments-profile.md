# faz-5b-comments-profile

> Faz 5 (Sosyal) 2/2. Kaynak: docs/02-04. Post-comments (async 202) + transfer-comments (senkron) + player profile. reaction.processor'a comment handler'ları eklenir.

## Amaç

Yorumlar: post-comments async (outbox), transfer-comments senkron. 2-seviye nesting (üst + direkt reply). Like-state. Player profile aggregation (Faz 3/5a'dan ertelenen).

## Kararlar

- **Nesting 2-seviye:** top-level (parentId=null) + direkt reply'lar (parentId=top.id). Reply'a reply düzleştirilir (root'a).
- **Post-comment:** create/like/unlike **async 202** (outbox + reaction.processor `comment.create`/`comment.reaction`). **Transfer-comment:** create **201**, like/unlike **200** senkron.
- Player profile 5b'ye dahil (posts 5a + news 3a + transfers 3b hazır).

## Messaging eklemeleri (mevcut ReactionProcessor + events)

- `CommentCreateEvent {userId, postId, content, parentId?, createdAtUtc}` · `CommentReactionEvent {commentId, userId, isLike}`
- `comment.create` handler: parent post doğrula → Comment oluştur → `post.commentCount` +1.
- `comment.reaction` handler: like/unlike Comment (idempotent, CommentLike unique) + `comment.likeCount` ±1.

## Post-comments — `CommentController` (route gömülü)

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/api/posts/:postId/comments` | public (OptionalJwt) | `{items:CommentDto[]}` (like-state, 2-seviye) |
| POST | `/api/posts/:postId/comments` | auth | **202** / 404 |
| PUT | `/api/comments/:id` | auth | 200 / 403 / 404 |
| DELETE | `/api/comments/:id` | auth | 200 / 403 / 404 |
| POST | `/api/comments/:id/like` | auth | **202** / 404 |
| DELETE | `/api/comments/:id/like` | auth | **202** / 404 |

## Transfer-comments — `TransferCommentController` (SENKRON)

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/api/transfers/:transferId/comments` | public (OptionalJwt) | `{items:TransferCommentDto[]}` |
| POST | `/api/transfers/:transferId/comments` | auth | **201** `{data:{commentId}}` / 404 |
| PUT | `/api/transfer-comments/:id` | auth | 200 / 403 / 404 |
| DELETE | `/api/transfer-comments/:id` | auth | 200 / 403 / 404 |
| POST | `/api/transfer-comments/:id/like` | auth | **200** / 404 |
| DELETE | `/api/transfer-comments/:id/like` | auth | **200** / 404 |

## DTO'lar (docs/03)

- **CommentDto:** id, ownerId, ownerName, ownerPhoto?, content?, postId, parentId?, likeCount, isLiked, createdAtUtc, replies: CommentDto[]
- **TransferCommentDto:** aynı, postId yerine transferId
- **CreateCommentDto / CreateTransferCommentDto:** content(≤2000), parentId?

## Player profile

`GET /api/players/:id/profile` → **PlayerProfileDto** { player: PlayerResponseDto, transfers: TeamTransferLineDto[] (≤20), news: NewsResponseDto[] (≤10), posts: PostResponseDto[] (≤10) }. PlayersService aggregation: PlayerRepo + TRANSFER_REPOSITORY (mevcut) + NewsService + PostsService. PlayersModule → NewsModule + PostsModule import (servisleri export).

## Yapı

```
src/comments/ (comment.repository + prisma impl, comments.service, comment.controller, comment.mapper, dto/)
src/transfer-comments/ (… senkron)
src/messaging/ (reaction.processor + events: comment handler'ları ekle)
players/ (PlayersController +/:id/profile, PlayersService.getProfile; PlayersModule import News+Posts)
```
CommentsModule imports MessagingModule (OutboxService). reaction.processor PrismaService ile Comment/CommentLike yazar.

## Test

- **Unit:** comments.service (createAsync→enqueue, react 202, update/delete 403), comment 2-seviye tree builder, transfer-comments.service (create senkron, like senkron 200, 403), reaction.processor comment handler (commentCount artışı, idempotent like), players.service profile aggregation.
- **E2E:** post comment POST 202 → job → listede (2-seviye, reply nested); comment like 202 → likeCount; transfer-comment POST 201 senkron + like 200; profile player+transfers+news+posts; 403 ownership.

## Doğrulama (docs/06 Faz 5 — 5b)

- [ ] post-comment create/like 202, job sonrası görünür + commentCount/likeCount doğru.
- [ ] transfer-comment create 201 + like 200 senkron.
- [ ] 2-seviye nesting (reply'lar replies[] altında); like-state.
- [ ] ownership 403; player profile 4 blok dolu.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. events + reaction.processor comment handler'ları.
2. CommentsModule (repo + service async + controller + 2-seviye mapper + dto).
3. TransferCommentsModule (senkron repo/service/controller).
4. Player profile (PlayersService.getProfile + controller + News/Posts export + module import).
5. app.module wiring + unit + e2e + tsc + lint + commit.

## Sonraki

Faz 5 TAMAM. → Faz 6 (Favoriler & Bildirimler: me/favourites, NotificationService dedup+opt-out, onlyFavourites feed bağlama, rumour/transfer create→notification job).
