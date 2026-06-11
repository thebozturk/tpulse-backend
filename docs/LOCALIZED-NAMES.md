# TransferPulse — Takım / Lig / Oyuncu Adı Lokalizasyonu (Genel Bakış)

API-Football'dan gelen isimler İngilizce. Bu özellik her varlığa **düzenlenebilir bir
Türkçe ad** ekler ve response'ları isteğin diline göre döndürür. Bu belge backend
değişikliğini ve dağıtımı özetler; frontend tarafları için ayrı rehberler var.

## İlgili belgeler
- 📱 Mobil: [`mobile/LOCALIZED-NAMES-INTEGRATION.md`](./mobile/LOCALIZED-NAMES-INTEGRATION.md)
- 🖥️ Panel (backoffice): [`backoffice/LOCALIZED-NAMES-INTEGRATION.md`](./backoffice/LOCALIZED-NAMES-INTEGRATION.md)

---

## 1. Tasarım

| Alan | Anlam | Yöneten |
|---|---|---|
| `name` (takım/lig), `firstName`/`lastName` (oyuncu) | İngilizce kanonik ad | API-Football senkronu |
| `nameTr`, `firstNameTr`/`lastNameTr` | Türkçe gösterim adı (opsiyonel) | Admin (panel) |

- **Okuma:** `Accept-Language` header → `tr` ise `nameTr ?? name`, `en` ise `name`.
  Header yoksa varsayılan **`tr`**.
- **Yazma (senkron):** yeni kayıtta `nameTr = name` ile dolu başlar; **güncellemede
  `nameTr`'ye dokunulmaz** → admin düzeltmesi re-sync'te korunur.
- **Admin düzenleme:** `PUT /api/admin/{teams,leagues,players}/:id` body'sine
  `nameTr` (oyuncuda `firstNameTr`/`lastNameTr`) eklendi.
- Public response DTO'larına ham `nameTr` alanları **additive** (non-breaking) eklendi.

---

## 2. Şema değişikliği

`prisma/schema.prisma`:

| Model | Yeni kolon |
|---|---|
| `Team` | `nameTr String? @db.VarChar(50)` |
| `League` | `nameTr String? @db.VarChar(30)` |
| `Player` | `firstNameTr String? @db.VarChar(32)`, `lastNameTr String? @db.VarChar(32)` |

Migration: `prisma/migrations/20260611120000_add_name_tr_columns/` — kolonları ekler
ve **mevcut satırları İngilizce adla backfill eder** (`UPDATE ... SET nameTr = name`).

### Dağıtım (gerekli tek manuel adım)

Migration **henüz hiçbir DB'ye uygulanmadı.** Hedef DB'ye deploy akışıyla uygula:

```bash
pnpm db:deploy        # prisma migrate deploy — additive + backfill, güvenli/geri-uyumlu
```

> Backfill sayesinde panel açıldığında tüm varlıklarda Türkçe alan dolu gelir;
> admin yalnız çevrilmesi gerekenleri düzeltir.

---

## 3. Kod tarafı (özet)

- **Dil çözümü:** `src/common/i18n/lang.ts` (`Lang`, `resolveLang`, `pickName`) +
  `src/common/i18n/lang.decorator.ts` (`@ReqLang()`).
- **Lokalize edilen modüller:** teams, leagues, players, transfers (+stats), news,
  posts, feed, search — controller `@ReqLang()` → service → mapper `pickName(...)`.
- **Write-side:** `football-data.sync.service.ts` + `football-data.seeder.ts` (insert'te
  `nameTr` doldurur, update'te dokunmaz).
- **Contract:** `openapi.json` yeniden üretildi (yeni alanlar dahil).

Doğrulama: `pnpm tsc --noEmit` ✓ · `pnpm lint` ✓ · ilgili modül testleri ✓.

---

## 4. Davranış matrisi

| İstek | `name` değeri |
|---|---|
| `Accept-Language: tr` | Türkçe (`nameTr`), yoksa İngilizce'ye düşer |
| `Accept-Language: en` | İngilizce (kanonik) |
| Header yok | Türkçe (varsayılan) |

**Çevrilmeyen alanlar:** haber başlığı/içeriği, post içeriği, stadyum/şehir, ülke,
kullanıcı adı — yalnızca **varlık adları** (takım/lig/oyuncu) lokalize edilir.
