# TransferPulse — .NET → NestJS Migration Dokümanları

Bu klasör, mevcut **TPulseBackend** (.NET 8 / Clean Architecture) projesini **NestJS**'e birebir taşımak için hazırlanmış eksiksiz bir referans setidir. Bir AI ajanına verildiğinde, davranışı koruyarak yeni projeyi kurabilecek detayı içerir.

## Dosyalar

| # | Dosya | İçerik |
|---|---|---|
| 00 | [`00-OVERVIEW.md`](./00-OVERVIEW.md) | Proje özeti, mevcut & hedef mimari, kapsam, taşıma ilkeleri, bilinen nüanslar |
| 01 | [`01-DATA-MODEL.md`](./01-DATA-MODEL.md) | 25 entity + 6 enum + ilişkiler/index → tam **Prisma schema** |
| 02 | [`02-API-ENDPOINTS.md`](./02-API-ENDPOINTS.md) | 30 controller, ~120 endpoint (route/auth/params/body/response) |
| 03 | [`03-APPLICATION-LOGIC.md`](./03-APPLICATION-LOGIC.md) | CQRS→service, validation, ~28 servis/repo sözleşmesi, ~60 DTO |
| 04 | [`04-INFRASTRUCTURE.md`](./04-INFRASTRUCTURE.md) | Auth/JWT, Redis, R2 storage, API-Football, outbox/jobs, email, config & env |
| 05 | [`05-NESTJS-ARCHITECTURE.md`](./05-NESTJS-ARCHITECTURE.md) | Hedef NestJS yapısı, modül düzeni, kavram eşleme, kütüphane seçimleri |
| 06 | [`06-MIGRATION-ROADMAP.md`](./06-MIGRATION-ROADMAP.md) | 9 fazlı taşıma planı + doğrulama kriterleri |

## Önerilen Okuma / Çalışma Sırası

1. **`00`** ve **`05`** — ne yapacağını ve hedef yapıyı anla.
2. **`06`** — fazları görev listesine çevir.
3. Her fazda ilgili referansı aç: şema için **`01`**, altyapı için **`04`**, endpoint/iş mantığı için **`02`** + **`03`**.

## Kritik Hatırlatmalar
- Route'lar, response envelope'ları (`{success,message,data}` / `{items,page,pageSize,totalCount,totalPages}`) ve DB şeması **birebir** korunur.
- Bazı uçlar **asenkron 202** (post/comment create & like) — outbox/job davranışını koru.
- `Transfer` **soft delete**, notification **dedup**, favourite **opt-out**, transfer kart zamanı **`createdAt`**.
- Bot (`TRANSFER_BOT_SPEC.md`) bu backend'in tüketicisidir; `rumours`/`admin/transfers`/`search`/`players/search`/`auth/login` sözleşmeleri bozulmamalı.

> Notlar `git`'e dahil edilen `.cs` kaynak kodundan derlenmiştir; bir alanın kesin değeri için (token süreleri, kalite, kolon adı) ilgili kaynak dosyaya / `appsettings.json`'a danış.
