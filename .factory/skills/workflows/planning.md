---
name: planning
keywords: "plan, tasarım, decompose, strateji, yaklaşım, approach"
description: "İş yapmadan önce nasıl plan kurulur"
---

# Planning

## Ne zaman kullan

Kullanıcı yeni bir iş istediğinde, **kod yazmadan önce** plan kur. Özellikle:
- 3+ dosya değişecekse
- Yeni bir modül ekleniyorsa
- Mevcut kod davranışı değiştirilecekse (migration, refactor)

Sadece tek bir tip değişikliği (örn. "typo düzelt") için plan yapma.

## Prensipler

**1. Önce oku, sonra yaz.**
Mevcut kodun ne yaptığını anla. Benzer şey daha önce yapılmış mı, pattern var mı?

**2. Spec'e bağlı kal.**
`.factory/docs/modules/<modül>.md` varsa ondan çıkma. Spec dışı "bonus" ekleme → scope creep.

**3. Conventions'ı respect et.**
`.factory/memory/conventions.json`'a bak. Proje `_camelCase` kullanıyorsa sen de öyle yaz, kendi tercihini dayatma.

**4. En küçük işten başla.**
"Foundation → extension" sırasıyla: önce base case, sonra edge case. İlk build'de perfection'ı hedefleme.

**5. Değişiklik listesi önce verilir.**
Plan şöyle görünmeli:
```
Değişecek dosyalar (4):
  YENİ: src/modules/profile-avatar/*.ts (5 dosya)
  DEĞİŞ: src/modules/users/user.schema.ts (+2 satır)
  DEĞİŞ: docker-compose.yml (minio servisi)
  YENİ: test/profile-avatar.spec.ts

Paket eklenecek: multer, sharp, @aws-sdk/client-s3
Env var eklenecek: AWS_S3_BUCKET, ...
Tahmini süre: 20dk
```

## Anti-pattern'ler

### "Kod yazarken planı açıklayayım"
Hayır. Plan önce. Yazarken plan değişirse dur, kullanıcıya yeni plan göster, onay al.

### "Her detayı planın içine koy"
Plan = dosya listesi + yaklaşım. Kod yaklaşımı pseudo-code'a iner ama **fonksiyon gövdesi yazma**.

### "Plan listesini çok uzatma"
15 maddeli plan → kullanıcı okumaz. 5-7 madde yeterli. Sub-item'lar dallanabilir ama ana madde kısa.

### "Onay almadan başla"
Kullanıcı "yap" demeden Write çağırma. "Planı onaylıyor musun?" sorusu ZORUNLU.

## İyi plan örnek

```
HEDEF: Kullanıcı avatar yükleme

YAKLAŞIM: S3 stream upload + sharp thumbnail

DEĞİŞİKLİKLER:
1. YENİ modül: src/modules/profile-avatar/
   - DTO, service, controller, test
   - S3 adapter module'e inject
2. user.schema.ts → avatar field eklenecek
3. docker-compose.yml → minio (local S3)
4. .env.example → AWS credentials

BAĞIMLILIK: multer, sharp, @aws-sdk/client-s3

SIRAYLA:
1. Schema + DTO (test ile)
2. Service (S3 mock ile test)
3. Controller (integration test)
4. docker-compose güncelle, minio başlat
5. Manuel smoke: POST /profile/avatar

ONAY İSTEĞİ:
Bu planla devam edeyim mi? Özellikle S3 yerine başka bir storage mı tercih edersin?
```

## Aksiyon

Plan kurarken:
1. Spec'i oku (varsa)
2. Conventions oku
3. Benzer mevcut kodu grep'le
4. Değişiklik listesini çıkar
5. Yaklaşım bir cümleyle
6. Sırayla adımlar
7. Risk/soru varsa belirt
8. Onay iste
