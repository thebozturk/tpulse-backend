# Runbook: AWS S3 Bucket Kurulumu (görsel storage)

Görsel upload entegrasyonu **kod tarafında hazır** (`src/storage/`). Bu runbook yeni
bir AWS S3 bucket'ı oluşturup projeye bağlamayı anlatır. **Kod değişikliği gerekmez** —
her şey env ile sürülür.

## Oluşturulmuş ortamlar (2026-06-12, hesap 055237683797, eu-central-1)

| Ortam | Bucket | IAM user | Notlar |
|-------|--------|----------|--------|
| **Prod** | `transferpulse-prod` | `transferpulse-app` | public-read GET, write IAM ile |
| **Dev (local)** | `transferpulse-dev` | `transferpulse-app-dev` | objeler 30 gün lifecycle ile otomatik silinir |

Lokal geliştirme MinIO değil **gerçek S3 (dev bucket)** kullanır: `S3_ENDPOINT` boş,
`S3_FORCE_PATH_STYLE=false`. Access secret'ları AWS bir kez gösterir → secret manager'da tut.

## Mimari özet

- **Tek bucket**, entity'ler bucket içinde **klasör (key prefix)** olarak ayrılır.
- Key formatı deterministik: `<folder>/<entityId>.webp` → re-sync eski objeyi ezer, orphan yok.
- Object'ler doğrudan `S3_PUBLIC_BASE_URL` ile **public GET** olarak servis edilir.
- **Write** sadece IAM credential ile (uygulama). Public write **asla**.

Kullanılan prefix'ler:

| Prefix       | Kaynak                              |
|--------------|-------------------------------------|
| `players/`   | players + api-football sync         |
| `teams/`     | teams + api-football sync           |
| `leagues/`   | leagues + api-football sync         |
| `news/`      | news                                |
| `profiles/`  | kullanıcı profil fotoğrafı          |

---

## 0. Değişkenler (kendine göre doldur)

```bash
export AWS_REGION=eu-central-1
export BUCKET=transferpulse-prod          # global benzersiz olmalı
export APP_USER=transferpulse-app
```

## 1. Bucket oluştur

```bash
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
```

> Not: `us-east-1` için `--create-bucket-configuration` satırını **çıkar** (AWS o bölgede kabul etmez).

## 2. Public erişim ayarı (sadece GET açık)

Önce "Block Public Access"in policy üzerinden public-read'e izin verecek şekilde gevşetilmesi:

```bash
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

Sonra **sadece okuma** için bucket policy:

```bash
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket-policy.json
```

> CloudFront kullanacaksan public-read yerine OAC (Origin Access Control) tercih et;
> o durumda bu policy'yi CloudFront dağıtımına özelleştir.

## 3. CORS (tarayıcıdan doğrudan GET için)

```bash
cat > /tmp/cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://transferpulse.app", "http://localhost:3000"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/cors.json
```

> Upload backend üzerinden yapıldığı için (presigned PUT yok), CORS'a PUT eklemeye gerek yok.

## 4. Uygulama için IAM user + write policy

Uygulama yalnızca **PutObject** ve **DeleteObject** yetkisine ihtiyaç duyar (kod
`PutObjectCommand` + `DeleteObjectCommand` kullanıyor).

```bash
aws iam create-user --user-name "$APP_USER"

cat > /tmp/app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AppWriteObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    }
  ]
}
EOF

aws iam put-user-policy --user-name "$APP_USER" \
  --policy-name transferpulse-s3-write \
  --policy-document file:///tmp/app-policy.json

aws iam create-access-key --user-name "$APP_USER"
# → AccessKeyId + SecretAccessKey çıktısını güvenli yere al (secret bir kez gösterilir)
```

## 5. Env'i bağla

`.env.production` (veya secret manager) içine:

```env
S3_ENDPOINT=                         # AWS'de BOŞ (MinIO için doluydu)
S3_REGION=eu-central-1
S3_BUCKET=transferpulse-prod
S3_ACCESS_KEY_ID=<adım 4 çıktısı>
S3_SECRET_ACCESS_KEY=<adım 4 çıktısı>
S3_PUBLIC_BASE_URL=https://transferpulse-prod.s3.eu-central-1.amazonaws.com
S3_FORCE_PATH_STYLE=false            # AWS'de false (MinIO'da true'ydu)
```

> CloudFront önündeyse `S3_PUBLIC_BASE_URL` CDN domain'i olur:
> `https://cdn.transferpulse.app`

## 6. Doğrula

```bash
# Upload (uygulama üzerinden, multipart):
curl -X POST https://api.transferpulse.app/profile/photo \
  -H "Authorization: Bearer <token>" \
  -F "image=@./test.jpg"
# → { "data": { "url": "https://.../profiles/<userId>.webp" } } dönmeli

# Public GET (auth'suz erişilebilmeli):
curl -I "https://transferpulse-prod.s3.eu-central-1.amazonaws.com/profiles/<userId>.webp"
# → HTTP/1.1 200 OK, Content-Type: image/webp
```

## Güvenlik kontrol listesi

- [ ] Public policy yalnızca `s3:GetObject` içeriyor (PutObject **yok**).
- [ ] IAM user policy yalnızca bu bucket ARN'sine kısıtlı (`*` resource değil).
- [ ] Access key secret manager'da (AWS SSM / Vault / Doppler), repoda değil.
- [ ] `S3_FORCE_PATH_STYLE=false` (AWS) — MinIO'dan kalan `true` taşınmadı.
- [ ] Bucket versiyonlama opsiyonel; deterministik key ezme yaptığı için şart değil.

## İlgili kod

- `src/storage/storage.service.ts` — S3Client, `upload()` / `delete()`
- `src/storage/image-upload.service.ts` — validate → WebP → S3 akışı
- `src/storage/image.service.ts` — format/boyut/magic-byte doğrulama
- `src/config/env.validation.ts` — `S3_*` env şeması (boşsa upload pasif)
