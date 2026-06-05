# /design — İnteraktif Tasarım

$ARGUMENTS: Opsiyonel. Ne tasarlanacak (modül, endpoint, feature).
Boş bırakılırsa kullanıcıdan öğrenir.

## Amaç

Yeni bir modül/feature/endpoint için **birlikte karar alma** turu. Tek seferde plan gösterip onay almak yerine, birkaç tur konuşarak netleştirir. Sonuç: `.factory/docs/modules/<isim>.md` altına kayıtlı spec.

## Protocol

1. **DİNLE** — Kullanıcı anlatır, özetle ve doğrulat
2. **KEŞFET** — Projede mevcut ilgili dosyaları tara
3. **DETAYLANDIR** — Eksik noktaları sor (max 3 soru per tur)
4. **ÖNER** — Mevcut pattern'larla uyumlu yaklaşım öner
5. **ONAYLA** — Kullanıcı son halini onaylar
6. **YAZ** — Spec dosyasını oluştur

## Context Bütçesi: Max 30k token

---

## AŞAMA 1: DİNLE

`$ARGUMENTS` yoksa: "Ne tasarlamak istiyorsun? Kısaca anlatır mısın?"

Kullanıcı anlattıktan sonra **kendi cümlelerinle özetle**:

```
Anladığım kadarıyla:
- Kullanıcılar profil resmi yükleyebilecek
- Sadece JPG/PNG, max 5MB
- Avatar çözünürlükte thumbnail otomatik oluşacak
- S3'e yükleyip CDN URL'i dönecek

Doğru mu? Eksik/yanlış var mı?
```

Kullanıcı düzeltir ya da onaylar.

---

## AŞAMA 2: KEŞFET

Projedeki ilgili dosyaları tara:

```bash
# örnek: file upload için
grep -r "multer\|fileInterceptor" src --include="*.ts" -l
find src -name "*upload*" -o -name "*file*"
```

Kullanıcıya göster:
```
Projede ilgili bulduğum dosyalar:
- src/modules/users/user.service.ts (user entity burada)
- src/modules/storage/ klasörü yok — yeni modül gerekecek
- Multer kullanılmamış, paket eklenecek

Bunlarla çalışmak uygun mu, yoksa farklı bir yapı mı?
```

---

## AŞAMA 3: DETAYLANDIR

Eksik kalan konuları **max 3 soru per tur** sor. Liste değil, somut soru:

Kötü örnek:
```
1. Hangi image format?
2. Max size?
3. Storage provider?
4. CDN?
5. Permissions?
6. Moderation?
...
```

İyi örnek:
```
Üç şeyi netleştirmem lazım:
1. Yüklenen orijinal dosyayı saklayalım mı yoksa sadece thumbnail yeterli mi?
2. Image moderation (NSFW detect vs.) dahil olsun mu?
3. Aynı user birden fazla avatar tutabilir mi (history), yoksa tek aktif mi?
```

Cevaplara göre belki bir tur daha.

---

## AŞAMA 4: ÖNER

Mevcut convention'lara ve skill'lere uygun bir yaklaşım öner. Birden fazla varsa alternatifleri göster:

```
Önerim:

Yaklaşım A (basit):
  - Multer disk storage → S3 manuel upload
  - Sharp ile thumbnail
  - User.avatar field

Yaklaşım B (daha sağlam):
  - Multer memory storage → AWS SDK direct stream to S3
  - Lambda thumbnail trigger (async)
  - UserAvatar entity (history için)

Hangisi daha uygun? Ya da hibrit (A şimdi, B sonra)?
```

---

## AŞAMA 5: ONAYLA

Final spec'in özetini göster:

```
SPEC ÖZETİ: user-profile-avatar

Modül: src/modules/profile-avatar/
Yeni dosyalar:
  - profile-avatar.module.ts
  - profile-avatar.controller.ts (POST /profile/avatar)
  - profile-avatar.service.ts
  - dto/upload-avatar.dto.ts
  - profile-avatar.spec.ts

Değişecek:
  - user.schema.ts → avatar: { url, uploadedAt }

Paketler:
  - @nestjs/platform-express (var)
  - multer (yeni)
  - @aws-sdk/client-s3 (yeni)
  - sharp (yeni)

Env variables:
  - AWS_S3_BUCKET
  - AWS_S3_REGION
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY

Build sırası: /build profile-avatar
Tahmini dosya sayısı: 5 yeni, 1 değişim

Onaylıyor musun?
```

---

## AŞAMA 6: YAZ

`.factory/docs/modules/profile-avatar.md` oluştur:

```markdown
# profile-avatar

## Amaç
Kullanıcıların avatar yüklemesi ve thumbnail'lı CDN URL'i alması.

## API
- POST /profile/avatar (multipart) → { url: string }

## Modeller
- User.avatar: { url: string, uploadedAt: Date }

## Dosya yapısı
...

## Kurallar
- Max 5MB, JPG/PNG only
- S3'e stream upload (memory'de tutma)
- 200x200 thumbnail + orijinal
- Eski avatar S3'ten sil (user.avatar varsa)

## Test
- Unit: service upload logic
- Integration: controller end-to-end
- Edge: büyük dosya, yanlış MIME, S3 failure

## Dependencies
- multer, @aws-sdk/client-s3, sharp

## Env variables
...

## Build order
1. DTO + schema güncellemesi
2. Service (S3 adapter + sharp)
3. Controller
4. Tests
5. docker-compose'a minio ekle (local dev)
```

---

## YAPMA

- **İlk turda plan göster, onay al, başla yapma.** Bu /design değil /build olur.
- **Tüm detayları ilk mesajda sor.** Max 3 soru per tur.
- **Kullanıcının anlatımını "uzatıp" teknik detaya boğma.** Önce onun seviyesinde özetle.
- **Kod yazma.** Sadece spec. Kod /build işi.
- **Spec yazmadan "hadi başlayalım" de.** Dosya zorunlu.
