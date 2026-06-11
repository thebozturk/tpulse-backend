# Backend Teknik Geliştirme ve Entegrasyon Kılavuzu

Bu doküman, belirtilen 4 ana özelliğin backend tarafında mimariye uygun şekilde tasarlanması ve uygulanması için gereken adım adım teknik gereksinimleri içermektedir.

---

## 1. Profil Fotoğrafı İşlemleri (Profile Photo Operations)

### A. API Endpoint'lerinin Tanımlanması (`src/profile/profile-photo.controller.ts`)
*   `POST /api/profile/photo`
    *   Dosya yükleme için `@UseInterceptors(FileInterceptor('image'))` dekoratörü kullanılmalıdır.
    *   İstek `@CurrentUser()` dekoratörüyle alınarak giriş yapmış kullanıcının kimliği üzerinden yürütülmelidir.
*   `PUT /api/profile/photo`
    *   Benzer şekilde multipart istek kabul edilmeli ve eski görselin üzerine yazılmalıdır.
*   `GET /api/profile/photo`
    *   Aktif kullanıcının profil fotoğrafı CDN URL'ini dönmelidir.
*   `DELETE /api/profile/photo`
    *   Profil fotoğrafını silmeli ve veri tabanındaki alanı temizlemelidir.
*   `POST /api/profile/photo/from-url`
    *   Body içerisinde harici görsel URL'ini (`ImageUrlDto`) kabul etmeli ve kullanıcının profil resmi olarak kaydetmelidir.

### B. İş Mantığı ve Dosya İşleme (`src/profile/profile.service.ts` & `src/storage/image-upload.service.ts`)
*   **Format Doğrulaması:** Dosya uzantısı ve mime-type değeri kontrol edilerek yalnızca `jpg`, `jpeg`, `png` ve `webp` formatları kabul edilmelidir.
*   **Boyut Limiti:** Maksimum dosya boyutu 5MB olarak sınırlandırılmalı, aşılması durumunda `BadRequestException` fırlatılmalıdır.
*   **Görsel Sıkıştırma:** `sharp` kütüphanesi kullanılarak resimler WebP formatına dönüştürülmeli ve optimize edilmelidir.

### C. Depolama Entegrasyonu (`src/storage/storage.service.ts`)
*   Yüklenen görsel S3/MinIO üzerinde deterministik bir key yapısı ile (örn. `avatars/{userId}.webp`) saklanmalıdır.
*   Görsel güncellendiğinde veya silindiğinde eski görsel depolama sunucusundan temizlenmelidir.
*   Oluşturulan CDN URL'i `User` tablosundaki `profilePic` sütununa yazılmalıdır.

---

## 2. Akışta Engelleme ve Susturma Filtrelemesi (Feed Filter)

### A. Repository Katmanı (`src/posts/post.repository.ts` & `src/posts/prisma-post.repository.ts`)
*   **`post.repository.ts`:** `PostFilter` arayüzüne (interface) `suppressedAuthorIds?: string[]` alanı eklenmelidir.
*   **`prisma-post.repository.ts`:** `feed()` sorgusu içerisindeki Prisma `where` koşullarına şu yazar filtreleme kuralı eklenmelidir:
    ```typescript
    ownerId: filter.ownerId ?? (filter.suppressedAuthorIds?.length ? { notIn: filter.suppressedAuthorIds } : undefined)
    ```

### B. Servis Katmanı (`src/posts/posts.service.ts`)
*   `feed()` metodu içerisinde istek atan kullanıcının oturum açıp açmadığı denetlenmelidir.
*   Oturum açmış kullanıcılar için `BlocksService` üzerinden `getSuppressedAuthorIds(userId)` çağrılarak engellenen/susturulan yazar ID listesi çekilmelidir.
*   Çekilen liste `suppressedAuthorIds` ismiyle repository parametrelerine geçilmelidir.

### C. Bağımlılık Yönetimi (`src/posts/posts.module.ts`)
*   `PostsModule` içindeki `imports` dizisine `BlocksModule` dahil edilmelidir.

---

## 3. Engellenenler ve Susturulanlar GET Metotları (Social Relations Retrieval)

### A. Repository Katmanı (`src/blocks/block.repository.ts` & `src/blocks/prisma-block.repository.ts`)
*   Veri tabanından çekilecek profiller için `BlockedMutedUserRow` veri yapısı (`id`, `username`, `nickname`, `profilePic`, `verificationType`) tanımlanmalıdır.
*   `IBlockRepository` arayüzüne `getBlockedUsers(userId: string): Promise<BlockedMutedUserRow[]>` ve `getMutedUsers(userId: string): Promise<BlockedMutedUserRow[]>` metotları eklenmelidir.
*   Prisma üzerinde `userBlock` ve `userMute` tablolarından ilişkili profilleri join ederek getiren veritabanı sorguları yazılmalıdır.

### B. DTO Tanımı (`src/blocks/dto/block.dto.ts`)
*   Swagger şeması ve tip doğrulaması için `BlockedMutedUserDto` sınıfı tanımlanmalıdır.

### C. Controller Katmanı (`src/blocks/blocks.controller.ts`)
*   Aşağıdaki endpoint'ler tanımlanmalı ve `@CurrentUser()` ile `@UseGuards(JwtAuthGuard)` ile korunmalıdır:
    *   `GET /api/me/blocks` -> `@ApiResponse({ status: 200, type: [BlockedMutedUserDto] })`
    *   `GET /api/me/mutes` -> `@ApiResponse({ status: 200, type: [BlockedMutedUserDto] })`

---

## 4. Google ile Giriş Yapma (Google Sign-In OAuth 2.0)

### A. API Endpoint'i (`src/auth/auth.controller.ts`)
*   `POST /api/auth/google` ucu oluşturularak body'de `idToken` parametresi kabul edilmelidir.

### B. Doğrulama ve Kayıt Akışı (`src/auth/auth.service.ts`)
*   Google `idToken`'ı backend tarafında `google-auth-library` (`OAuth2Client`) kullanılarak doğrulanmalıdır.
*   Payload içerisinden `email`, `sub` (Google benzersiz ID'si) ve `name` alanları ayıklanmalıdır.
*   **Kullanıcı Eşleştirme ve Kayıt Mantığı:**
    *   E-posta adresi veri tabanında mevcutsa: İlgili kaydın `googleId` alanı güncellenmeli ve e-posta onay durumu (`isMailConfirm`) `true` yapılmalıdır.
    *   E-posta adresi veri tabanında mevcut değilse: Google bilgileriyle yeni bir `User` kaydı oluşturulmalıdır. Rastgele güvenli bir şifre hash'lenip kaydedilmeli, `googleId` eklenmeli ve e-posta onaylı (`isMailConfirm: true`) işaretlenmelidir.
*   Kullanıcı doğrulandıktan sonra uygulamanın kendi JWT `accessToken` ve `refreshToken` bilgileri oluşturularak istemciye dönülmelidir.
