# /endpoint — Yeni Endpoint Ekleme

$ARGUMENTS: Endpoint açıklaması. Örn: `"PATCH /users/:id/avatar için endpoint"` veya `"users/update-email"`.

## Amaç

`/build` daha ağır — tam modül yapısı istiyor. `/endpoint` **mevcut bir modüle tek bir endpoint** eklemek için hafif. Spec dosyası gerektirmez, interaktif soruyla çalışır.

## Protocol

1. **ANLA** — Hangi modül, hangi method, hangi path
2. **OKU** — İlgili controller + service
3. **PLANLA** — Değişecek satırlar
4. **ONAYLA** → Yaz → Test → Commit

## Context Bütçesi: Max 15k token

---

## AŞAMA 1: ANLA

Kullanıcıdan net bilgi al (3 soruyu tek mesajda):

```
Endpoint detayı:
1. Hangi modülde? (örn. users, profile, orders)
2. HTTP method + path? (örn. PATCH /users/:id/email)
3. Request body + response şeması? (basit tarif)

Auth gerektiriyor mu? Hangi role?
```

Kullanıcı cevap verir.

---

## AŞAMA 2: OKU

```bash
# Mevcut controller'ı bul
find src/modules -name "*.controller.ts" | grep -i <modül>
# Mevcut service'i de
find src/modules -name "*.service.ts" | grep -i <modül>
```

Bu dosyaları oku. Pattern'leri öğren: mevcut metod isimlendirme, guard kullanımı, DTO organizasyonu.

---

## AŞAMA 3: PLANLA

```
PLAN: PATCH /users/:id/email

Değişecek dosyalar:
  DEĞİŞ src/modules/users/users.controller.ts — yeni metod +15 satır
  DEĞİŞ src/modules/users/users.service.ts — updateEmail +20 satır
  YENİ  src/modules/users/dto/update-email.dto.ts +10 satır
  DEĞİŞ test/users.spec.ts — 3 test case

Auth: @UseGuards(JwtAuthGuard), @Throttle(5, 60) — 5 istek / dakika

DTO alanları:
  email: string (@IsEmail, @MinLength(5))
  password: string (@MinLength(8))  — email değişimi için re-auth

Onay?
```

---

## AŞAMA 4: YAZ

Sırayla:
1. DTO (`update-email.dto.ts`)
2. Service metodu (`updateEmail`)
3. Controller metodu (PATCH route)
4. Test case'leri (spec'te yeni `describe` bloğu)

Post-write hook her dosyayı kontrol eder. Security-gate password flow için devreye girer.

---

## AŞAMA 5: DOĞRULA

```bash
pnpm tsc --noEmit
pnpm lint
pnpm test -- users.spec.ts
```

Smoke test (docker-compose çalışıyorsa):
```bash
curl -X PATCH http://localhost:3000/users/me/email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"oldpass123"}'
```

---

## AŞAMA 6: COMMIT

```bash
git add src/modules/users/ test/users.spec.ts
git commit -m "feat(users): add email update endpoint"
```

Kullanıcıya:
```
✓ Endpoint eklendi
  PATCH /users/:id/email
  Test: 3/3 geçti
  Commit: feat(users): add email update endpoint

Contract güncellemesi: /contract-publish
```

---

## YAPMA

- **Yeni modül oluşturma.** Bu `/build` işi. `/endpoint` mevcut modüle eklenti.
- **Auth/guard skip etme.** Spec'te "public" denilmemişse default guard var.
- **DTO olmadan body kabul etme.** `@Body() dto: CreateXDto` zorunlu.
- **Rate limit @Throttle atlama.** Mutating endpoint'te her zaman.
- **Contract publish'i atlama.** Endpoint eklendi → contract güncel değil → frontend kırılır.
