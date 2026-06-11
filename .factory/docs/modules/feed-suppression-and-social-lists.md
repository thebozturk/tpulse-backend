# feed-suppression-and-social-lists

> Kaynak: `docs/backend_requirements.md` (Feature 2 + Feature 3).
> Feature 1 (profil foto) ve Feature 4 (Google Sign-In) keşifte **zaten tam implement** bulundu — bu spec dışı.

## Amaç

İki eksik/yarım kalan davranışı tamamlamak:

1. **Feature 2 (kısmi):** Klasik `GET /api/posts` feed'inin de oturum açmış kullanıcı için
   engellenen/susturulan yazarları gizlemesi. (`/api/feed/for-you` zaten yapıyor; bu, eski
   `posts` feed'ine de aynı bastırmayı taşıyor.)
2. **Feature 3 (tam yeni):** Kullanıcının engellediği/susturduğu kişilerin profil listesini
   dönen iki GET endpoint'i.

## Keşif notu (mevcut durum)

- `BlocksService.getSuppressedAuthorIds(userId)` ve repo karşılığı **zaten var** — Feature 2 için
  yeni sorgu yazmaya gerek yok, sadece `posts` feed'ine bağlanacak.
- `src/feed/` modülü (`/api/feed/for-you`) block+mute (yazar + keyword) bastırmasını zaten yapıyor.
  Dokümandaki Feature 2, kodda feed mantığı ayrı modüle taşındığı için orada karşılanmış durumda;
  bu spec yalnızca eski `GET /api/posts` ucunu aynı hizaya getirir.
- `BlocksController` `@Controller('api')` ile `users/:id/block|mute` action'larını barındırıyor;
  yeni `me/blocks` ve `me/mutes` GET'leri buraya eklenecek (yeni controller yok — kullanıcı kararı).

---

## Feature 2 — GET /api/posts bastırması

### Repository sözleşmesi (`src/posts/post.repository.ts`)
`PostFilter` arayüzüne alan eklenir:
```typescript
export interface PostFilter {
  // ...mevcut alanlar
  suppressedAuthorIds?: string[];
}
```

### Prisma repo (`src/posts/prisma-post.repository.ts`)
`feed()` içindeki `where` koşuluna yazar bastırma kuralı (dokümandaki birebir kural):
```typescript
ownerId:
  filter.ownerId ??
  (filter.suppressedAuthorIds?.length
    ? { notIn: filter.suppressedAuthorIds }
    : undefined),
```
Not: `ownerId` filtresi varsa (örn. admin moderasyon `adminList`) bastırma uygulanmaz — açık
owner sorgusu önceliklidir.

### Service (`src/posts/posts.service.ts`)
`feed()` metodu, oturum açmış kullanıcı için bir kez bastırma listesini çekip her iki dala
(`onlyFavourites` ve normal) geçirir:
```typescript
const suppressedAuthorIds = user
  ? await this.blocks.getSuppressedAuthorIds(user.userId)
  : undefined;
```
- `BlocksService` constructor injection ile eklenir.
- `adminList()` bu yoldan geçmez (kendi `repo.feed` çağrısı suppression'sız kalır — moderasyon
  her şeyi görmeli).

### Modül (`src/posts/posts.module.ts`)
`imports` dizisine `BlocksModule` eklenir. `BlocksModule`, `BlocksService`'i export ediyor
olmalı (etmiyor ise export eklenecek). Döngüsel bağımlılık yok (BlocksModule, PostsModule'e
bağımlı değil).

---

## Feature 3 — Engellenenler/Susturulanlar listesi

### Repository sözleşmesi (`src/blocks/block.repository.ts`)
```typescript
export interface BlockedMutedUserRow {
  id: string;
  username: string;
  nickname: string;
  profilePic: string | null;
  verificationType: VerificationType | null;
}

export interface IBlockRepository {
  // ...mevcut metotlar
  getBlockedUsers(userId: string): Promise<BlockedMutedUserRow[]>;
  getMutedUsers(userId: string): Promise<BlockedMutedUserRow[]>;
}
```
(User alanları doğrulandı: `username`, `nickname`, `profilePic?`, `verificationType?` şemada mevcut.)

### Prisma repo (`src/blocks/prisma-block.repository.ts`)
`userBlock` / `userMute` üzerinden ilişkili profili join eden sorgular:
```typescript
async getBlockedUsers(userId: string): Promise<BlockedMutedUserRow[]> {
  const rows = await this.prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: {
      blocked: {
        select: { id: true, username: true, nickname: true, profilePic: true, verificationType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => r.blocked);
}
// getMutedUsers: aynı kalıp, userMute + muterId + muted relation
```
(İlişki adları `userBlock.blocked` / `userMute.muted` Prisma şemasından doğrulanacak; farklıysa
şemadaki gerçek relation alan adı kullanılır.)

### DTO (`src/blocks/dto/block.dto.ts`)
`BlockedMutedUserDto` — her alanda `@ApiProperty`, Swagger `type: [BlockedMutedUserDto]` için:
```typescript
export class BlockedMutedUserDto {
  @ApiProperty() id: string;
  @ApiProperty() username: string;
  @ApiProperty() nickname: string;
  @ApiProperty({ nullable: true }) profilePic: string | null;
  @ApiProperty({ enum: VerificationType, nullable: true })
  verificationType: VerificationType | null;
}
```

### Service (`src/blocks/blocks.service.ts`)
```typescript
listBlockedUsers(userId: string): Promise<BlockedMutedUserRow[]> {
  return this.repo.getBlockedUsers(userId);
}
listMutedUsers(userId: string): Promise<BlockedMutedUserRow[]> {
  return this.repo.getMutedUsers(userId);
}
```

### Controller (`src/blocks/blocks.controller.ts`)
İki yeni GET (sınıf seviyesindeki `@Throttle(write)` yerine read override):
```typescript
@Get('me/blocks')
@Throttle(ThrottlePolicies.read)
@ApiOperation({ summary: 'Engellenen kullanıcılar' })
@ApiResponse({ status: 200, type: [BlockedMutedUserDto] })
listBlocks(@CurrentUser() user: AuthUser): Promise<BlockedMutedUserDto[]> {
  return this.blocks.listBlockedUsers(user.userId);
}

@Get('me/mutes')
@Throttle(ThrottlePolicies.read)
@ApiOperation({ summary: 'Susturulan kullanıcılar' })
@ApiResponse({ status: 200, type: [BlockedMutedUserDto] })
listMutes(@CurrentUser() user: AuthUser): Promise<BlockedMutedUserDto[]> {
  return this.blocks.listMutedUsers(user.userId);
}
```
- Auth: mevcut global JwtAuthGuard + `@CurrentUser()` (controller zaten `@ApiBearerAuth()`).
- `ThrottlePolicies.read` yoksa uygun read policy eklenir/kullanılır.

---

## Test

- **posts.service.spec** — feed(): oturumlu kullanıcıda `getSuppressedAuthorIds` çağrılıyor ve
  `suppressedAuthorIds` repo'ya geçiyor; oturumsuzda çağrılmıyor; `onlyFavourites` dalında da geçiyor.
- **blocks.service.spec** — `listBlockedUsers`/`listMutedUsers` repo'ya delege ediyor.
- **prisma-block.repository** (varsa integration) — join doğru profil alanlarını dönüyor.
- **blocks route-shape** — `GET /api/me/blocks` & `/api/me/mutes` 200 + `[BlockedMutedUserDto]` şekli;
  auth yoksa 401.

## Bağımlılıklar / Env
- Yeni paket yok. Yeni env yok. Yeni migration yok (mevcut `userBlock`/`userMute`/`User` yeterli).

## Build sırası (`/build feed-suppression-and-social-lists`)
1. Feature 3 repository sözleşmesi + Prisma sorguları + DTO
2. Feature 3 service + controller GET'leri
3. Feature 2 PostFilter alanı + prisma-post repo where + posts.service + PostsModule import
4. Testler
5. `pnpm tsc --noEmit && pnpm lint && pnpm test`

## Kapsam dışı (zaten mevcut — dokunma)
- Feature 1: `src/profile/*` + `src/storage/image-upload.service.ts` (5 endpoint tam).
- Feature 4: `POST /api/auth/google` + `auth.service.google()` (spec'e birebir uyuyor).
- `/api/feed/for-you` bastırması (zaten çalışıyor).
