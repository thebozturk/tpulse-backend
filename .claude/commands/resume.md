# /resume — Yarım Kalan İşe Devam

$ARGUMENTS: Opsiyonel. Boş bırakılırsa aktif görev okunur.

## Amaç

Önceki session'da yarıda kalan bir `/build` veya iş'i devam ettir. `active-task.md`'den durumu oku, kalan adımları gerçekleştir.

## Protocol

1. **OKU** — `active-task.md` ve `session-handoff.md`
2. **TEYİT ET** — Kullanıcıya kaldığı yeri göster
3. **DEVAM** — Kalan adımları sırayla uygula
4. **GÜNCELLE** — Her adım tamamlandıkça active-task'ı işaretle

## Context Bütçesi: Max 15k token

---

## AŞAMA 1: OKU

```
.factory/memory/active-task.md
.factory/memory/session-handoff.md
```

### `active-task.md` formatı

```markdown
## Aktif: user-profile-avatar build

Başlangıç: 2025-04-20T14:30
Spec: .factory/docs/modules/profile-avatar.md

### Adımlar
- [x] DTO + schema güncellemesi
- [x] Service (S3 adapter + sharp)
- [ ] Controller ← YARIM KALDI
- [ ] Tests
- [ ] docker-compose'a minio ekle
- [ ] Commit

### Notlar
- S3 credentials .env.example'a eklendi
- sharp paketi pnpm add ile kuruldu
- controller.ts yazmaya başlandı ama endpoint validation tamamlanmadı
```

---

## AŞAMA 2: TEYİT ET

Kullanıcıya durumu göster:

```
YARIM KALAN: user-profile-avatar build

Tamamlanan:
  ✓ DTO + schema
  ✓ Service (S3 + sharp)

Kalan:
  → Controller (yarım — validation eksik)
  → Tests
  → docker-compose güncelleme
  → Commit

Devam edeyim mi? Yoksa önce bir şeyi değiştirmek ister misin?
```

Kullanıcı onaylayınca AŞAMA 3'e geç.

---

## AŞAMA 3: DEVAM

Kalan adımları sırayla uygula. Her adımda `.factory/docs/modules/<modül>.md` spec'ine referans ver — sürpriz özellik ekleme.

İlk "yarım" adımdan başla (örn. Controller). Eğer kısmi yazılmış dosya varsa:
1. Mevcut halini oku
2. Spec ile karşılaştır
3. Eksikleri tamamla

**UYARI:** Eğer dosya yazıldıktan sonra kullanıcı manuel değişmiş olabilir → diff göster, onay al:

```
Controller.ts için notlar diyor ki "validation eksik" ama dosyayı incelediğimde:
- POST /profile/avatar endpoint'i tanımlı ✓
- Multer interceptor kuruluymuş ✓
- file validation (size, MIME) eksik ← buraya ekleyeceğim

Devam?
```

---

## AŞAMA 4: GÜNCELLE

Her adım bittiğinde `active-task.md`'yi güncelle:

```markdown
### Adımlar
- [x] DTO + schema güncellemesi
- [x] Service (S3 adapter + sharp)
- [x] Controller   ← TAMAM
- [ ] Tests        ← Şu an
- [ ] docker-compose
- [ ] Commit
```

Tümü bittiğinde `active-task.md`'yi sil (veya `## Aktif` başlığını kaldır, ama arşiv olarak tut).

---

## Özel durumlar

### Active task yok

```
$ /resume

Yarım kalan görev bulunamadı.

Son session özeti (.factory/memory/session-handoff.md):
  Son: 2025-04-20T18:45
  Branch: feature/auth-refresh
  Commit: feat(auth): add refresh token endpoint

Yeni iş için: /design veya /build
```

### Active task var ama branch değişmiş

```
$ /resume

UYARI:
  active-task.md → feature/profile-avatar branch'inde başlamış
  Şu an → feature/different-thing branch'indesin

Seçenekler:
  1. feature/profile-avatar'a dön, resume
  2. active-task'ı iptal et (yeni branch'te yeni iş)

Ne yapalım?
```

### Active task var ama dosyalar manuel değişmiş

```
$ /resume

active-task.md → controller yazımı yarım
  AMA auth.controller.ts dosyası spec'ten farklı görünüyor
  (sen manuel değiştirmişsin gibi)

Seçenekler:
  1. Mevcut halini kabul et, eksik validation'ı üstüne ekle
  2. Spec'e göre yeniden yaz (mevcut değişiklikler kaybolur)

Hangisi?
```

---

## YAPMA

- **Spec dışı özellik ekleme.** active-task'ta olmayanı tamamlama.
- **Tüm dosyaları tekrar yaz.** Sadece yarım kalanı bitir.
- **Git state'i kontrol etmeden başla.** Branch yanlışsa kullanıcıyı uyar.
- **active-task.md'yi silme kullanıcı onaylamadan.** İş bitmişse bile "arşivleyelim mi?" diye sor.
- **Kullanıcının manuel değişikliğini yok say.** Farkı gör, kullanıcıya sor.
