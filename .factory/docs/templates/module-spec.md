# <Modül Adı>

> Bu dosya `/design` komutuyla oluşturulur. `/build <modül>` bu spec'i okuyarak kod üretir.

## Amaç

1-2 cümle: Bu modül ne yapar, hangi sorunu çözer?

## Kapsam

**DAHİL**
- Bu modülün yapacağı şeyler (3-5 madde)

**HARİÇ**
- Bu modülün yapmayacağı, yanlışlıkla eklenmemesi gereken şeyler
- "İleride yapılabilir" fikirler

## API / Arayüz

### Endpoint'ler (backend)
```
POST   /resource       — açıklama
GET    /resource/:id   — açıklama
PATCH  /resource/:id   — açıklama
DELETE /resource/:id   — açıklama
```

### Props / Hook signature (frontend)
```typescript
type Props = { ... };
export function useResource(id: string): { data, loading, error };
```

### Events / Webhooks (varsa)
```
resource.created   — payload şeması
resource.updated
resource.deleted
```

## Veri Modeli

### Schema (MongoDB / Prisma / ...)
```typescript
{
  _id: ObjectId
  field: Type
  ...
  createdAt: Date
  updatedAt: Date
}
```

### İlişkiler
- `belongs to` / `has many` / `many-to-many`
- Foreign key'ler, index'ler

## Dosya Yapısı

```
src/modules/<modül>/
├── <modül>.module.ts
├── <modül>.controller.ts
├── <modül>.service.ts
├── <modül>.schema.ts
├── dto/
│   ├── create-<modül>.dto.ts
│   └── update-<modül>.dto.ts
└── <modül>.spec.ts
```

## Bağımlılıklar

### Paketler
- `package-name@version` — neden gerekli

### Servisler (internal)
- `AuthModule` — user context için
- `StorageModule` — file upload için

### Dış Servisler
- AWS S3 (AWS_S3_BUCKET env var)
- Redis (caching için)

## Güvenlik

- Endpoint'ler auth gerektirir mi? (guard)
- Rate limit gerekli mi?
- Input validation kuralları
- Sensitive data yönetimi (password, token, PII)

## Performans Kriterleri

- p95 latency hedefi
- Concurrent request kapasitesi
- Cache stratejisi (varsa)

## Test Stratejisi

### Unit tests
- Service logic (mocked dependencies)
- Validation logic

### Integration tests
- Controller + real DB (testcontainers)
- Auth flow

### Edge case'ler
- Large input
- Concurrent modification
- Network failure
- Invalid auth

## Build Sırası

1. Schema + DTO (test'iyle birlikte)
2. Service (unit test)
3. Controller (integration test)
4. Module registration
5. docker-compose güncellemesi (gerekli servisler)
6. OpenAPI doc regenerate
7. Commit

## Açık Sorular

- [ ] Henüz netleşmemiş noktalar buraya — /design ile çözülür
- [ ] ...

## Değişiklik Geçmişi

- 2025-04-20: İlk spec oluşturuldu (`/design`)
- 2025-04-22: Avatar history eklendi
