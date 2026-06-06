# faz-6a-favourites-notifications

> Faz 6 (Favoriler & Bildirimler) 1/2. Kaynak: docs/02-04. Favourites + Notifications + generateForTransfer (outbox tetikli) + onlyFavourites feed bağlama. Rumour-write → 6b.

## Amaç

me/favourites CRUD + targets, me/notifications read + preferences (opt-out), NotificationService.generateForTransfer (dedup + opt-out), admin/transfer create → notification.generate (outbox), onlyFavourites feed bağlama.

## Kararlar

- **Notification job:** outbox `notification.generate` event + reaction.processor handler → NotificationService.generateForTransfer (durable, idempotent — dedup zaten unique).
- **6b:** rumour create/update/delete/confirm + bunların notification tetikçisi.
- Favori League **store**'da League olarak saklanır; **getTargets**'ta takım ID'lerine genişler (feed filtresi).

## Favourites — `api/me/favourites` (auth, write throttle)

| Method | Route | Response |
|---|---|---|
| GET | `/api/me/favourites` | `{items:FavouriteDto[]}` (isim+görsele çözülmüş) |
| POST | `/api/me/favourites` `{type,targetId}` | 201 (Added) / 200 `{unchanged}` (AlreadyExists) / 404 (TargetNotFound) |
| DELETE | `/api/me/favourites/:favouriteId` | 200 / 404 |
| PUT | `/api/me/favourites` `{favourites:[{type,targetId}]}` | 200 `{items}` (tüm seti değiştir) |

- **FavouriteDto:** id, type, targetId, name, imageUrl?, createdAt
- **AddFavouriteDto:** type(IsEnum FavouriteType), targetId(uuid) · **SetFavouritesDto:** favourites: AddFavouriteDto[]
- Çözümleme: League→league(name/logo), Team→team(name/logo), Player→player(fullName/photo), Reporter→user(nickname/profilePic). Target yoksa 404 (add).
- `getTargets(userId)` → `{playerIds, teamIds, reporterUserIds}`: League fav → o ligin takım id'leri (genişletme).

## Notifications — `api/me/notifications` (auth)

| Method | Route | Response |
|---|---|---|
| GET | `/api/me/notifications?page&pageSize&unreadOnly` | paged NotificationDto |
| GET | `/api/me/notifications/unread-count` | `{count}` |
| POST | `/api/me/notifications/:id/read` | 200 / 404 |
| POST | `/api/me/notifications/read-all` | 200 `{data:{count}}` |
| GET | `/api/me/notification-preferences` | `{items:[{eventType,enabled}]}` (tüm event type'lar) |
| PUT | `/api/me/notification-preferences` `{preferences:[{eventType,enabled}]}` | 200 `{items}` |

- **NotificationDto:** id, eventType, title, body, transferId?, isRead, createdAt
- **Preference:** opt-out modeli — satır yoksa enabled kabul; PUT upsert.

## NotificationService.generateForTransfer(transferId) (docs/03 §6)

1. Transfer yükle (player, fromTeam, toTeam, createdByUserId, isRumour). eventType = isRumour ? Rumour(1) : Transfer(2).
2. Eşleşen userId'ler:
   - Player fav (type=3, targetId=playerId)
   - Team fav (type=2, targetId ∈ {fromTeamId,toTeamId})
   - League fav (type=1, targetId ∈ {fromTeam.leagueId,toTeam.leagueId})
   - Reporter fav (type=4, targetId=createdByUserId)
   - Set'le dedup (kullanıcı çok yoldan eşleşse 1 bildirim). Oluşturanı (createdByUserId) atla.
3. Opt-out: NotificationPreference(userId,eventType,enabled=false) varsa atla.
4. Notification oluştur (dedup unique `(userId,transferId,eventType)` → create, P2002 yut). title/body player+team'den.
5. Oluşturulan sayıyı dön.

## Messaging eklemesi

- events: `NotificationGenerateEvent {transferId}` + `OutboxEventType.NotificationGenerate='notification.generate'`.
- reaction.processor: `notification.generate` → NotificationService.generateForTransfer(transferId). (MessagingModule, NotificationsModule import eder → NotificationService inject.)
- **Tetik:** AdminTransfersService.create sonrası `outbox.enqueue('notification.generate',{transferId})`. TransfersModule, MessagingModule import eder.

## onlyFavourites feed bağlama (5a stub)

PostsService.feed: onlyFavourites=true && user → FavouriteService.getTargets(user) → post repo `feed(filter, targets)` where `OR: [playerId in playerIds, teamId in teamIds, ownerId in reporterUserIds]`. Hedef boşsa boş feed. PostsModule, FavouritesModule import eder.

## Yapı

```
src/favourites/ (favourite.repository + prisma impl, favourites.service, me-favourites.controller, dto/)
src/notifications/ (notification.repository + prisma impl, notifications.service, me-notifications.controller, me-notification-preferences.controller, dto/)
src/messaging/ (events + processor: notification.generate)
transfers/ (AdminTransfersService → outbox enqueue; TransfersModule import MessagingModule)
posts/ (feed onlyFavourites → FavouriteService; PostsModule import FavouritesModule + PostRepo.feed targets param)
```
Bağımlılık: Transfers→Messaging→Notifications; Posts→Favourites. Cycle yok.

## Test

- **Unit:** favourites.service (add Added/AlreadyExists/TargetNotFound, getTargets league→team genişletme), notifications.service (preferences opt-out default, markRead 404, generateForTransfer eşleşme+dedup+opt-out), reaction.processor notification.generate handler.
- **E2E (BullMQ):** favori ekle (player) → admin/transfer create (eşleşen) → job → me/notifications'ta bildirim (dedup: 2. kez transfer aynı→tek); opt-out edilen tip gelmez; unread-count/read/read-all; onlyFavourites feed sadece favori hedefleri.

## Doğrulama (docs/06 Faz 6 — 6a)

- [ ] favori ekle → eşleşen transfer create → bildirim üretiliyor; dedup çalışıyor.
- [ ] opt-out edilen event tipi gelmiyor (preference enabled=false).
- [ ] unread-count/read/read-all; preferences get/put.
- [ ] onlyFavourites feed sadece favori hedef post'ları.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. events + processor notification.generate + NotificationsModule (repo/service/controllers).
2. FavouritesModule (repo + targets + service + controller).
3. NotificationService.generateForTransfer.
4. Tetik: AdminTransfersService outbox enqueue + TransfersModule import Messaging.
5. onlyFavourites: PostRepo.feed targets + PostsService + PostsModule import Favourites.
6. app.module wiring + unit + e2e + commit.

## Sonraki

Faz 6b — rumour write (POST/PUT/DELETE/confirm, Admin/Reporter) + notification tetikçisi. Sonra Faz 7 (API-Football sync) / Faz 8 (hardening).
