# TransferPulse — Bot İçerik Ingestion Entegrasyonu

> Bot projesinin (haber çeken + onaylı tweet atan) **aynı içeriği TransferPulse
> uygulamasının akışına otomatik eklemesi** için entegrasyon rehberi. İçerik
> "duyum / son dakika / resmi" olarak kategorize edilir ve **TransferPulse** adına
> akışta (feed) yayınlanır.

---

## 1. Genel Bakış

```
Bot  ──(X-Api-Key + JSON)──►  POST /api/ingest/posts  ──►  Akışta Post (TransferPulse)
```

- **Kimlik:** JWT değil — bot bir **API key** ile kimliklenir (servis-to-servis).
- **İçerik:** serbest metin + kategori + kaynak (tweet) bilgisi; opsiyonel oyuncu/takım.
- **Idempotent:** her tweet'in `sourceId`'si benzersizdir — aynı tweet iki kez
  gönderilse bile **tek** içerik oluşur (bot güvenle retry yapabilir).
- **Yayıncı:** içerik "TransferPulse" sistem kullanıcısı adına eklenir; uygulamada
  marka hesabı olarak görünür.

---

## 2. Kimlik Doğrulama (API Key)

### 2.1 Nasıl çalışır
- Bot her isteğe `X-Api-Key: <API_KEY>` header'ı ekler.
- Backend, key'i **düz metin saklamaz**; sadece **SHA-256 hash**'ini `BOT_API_KEY_HASH`
  env değişkeninde tutar ve gelen key'i sabit-zamanlı (timing-safe) karşılaştırır.
- Key yanlış/eksik ya da backend'de hash tanımlı değilse → **401** (fail-closed).

### 2.2 Key üretimi (bir kez, kurulum)

```bash
# 1) Güçlü bir API key üret (bu değer BOTA verilir, gizli tutulur)
API_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
echo "BOT API KEY (bota verilecek): $API_KEY"

# 2) Hash'ini hesapla (bu değer BACKEND .env'ine konur)
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$API_KEY"
```

- **Bot tarafı:** `API_KEY`'i güvenli secret olarak saklar (env/secret manager).
- **Backend tarafı:** çıktı hash'i `.env` → `BOT_API_KEY_HASH=<hash>` olarak konur ve
  servis yeniden başlatılır. (Düz key backend'de **hiç** durmaz.)

> **Önemli:** API key'i yalnızca bot ile paylaşın; loglara/commit'e yazmayın.
> Sızarsa: yeni key üret → backend'de `BOT_API_KEY_HASH`'i güncelle → eski key anında geçersiz olur (**rotasyon**).

---

## 3. Endpoint

### `POST /api/ingest/posts`

**Headers**
```
Content-Type: application/json
X-Api-Key: <API_KEY>
```

**Body**
| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `category` | `"Rumour" \| "Breaking" \| "Official"` | ✅ | duyum / son dakika / resmi |
| `text` | string (≤2000) | ✅ | İçerik metni (tweet metni) |
| `sourceId` | string (≤64) | ✅ | **Tweet id** — idempotency anahtarı (benzersiz) |
| `sourceUrl` | string (≤500) | — | Tweet/haber URL'si |
| `imageUrl` | string (≤500) | — | Görsel URL'si |
| `playerId` | uuid | — | İlgili oyuncu (varsa) |
| `teamId` | uuid | — | İlgili takım (varsa) |
| `fromTeamId` | uuid | — | Transferde "kimden" takımı |
| `toTeamId` | uuid | — | Transferde "kime" takımı |

> Bilinmeyen/fazladan alan göndermeyin → `400`.

**Başarılı yanıt — `201`**
```json
{ "data": { "id": "uuid", "status": "created" } }
```
Aynı `sourceId` tekrar gönderilirse — yine `201`:
```json
{ "data": { "id": "uuid", "status": "duplicate" } }   // yeni kayıt açılmadı
```

---

## 4. Kategoriler

| Gönderilen `category` | Anlamı | Uygulamada |
|---|---|---|
| `Rumour` | Duyum | `category=1` |
| `Breaking` | Son dakika | `category=2` |
| `Official` | Resmi | `category=3` |

Frontend bu sayısal `category` ile rozet/etiket gösterir (akıştaki Post yanıtında `category` alanı döner).

---

## 5. Oyuncu / Takım Bağlama Kuralları (opsiyonel)

İçeriği uygulamadaki oyuncu/takım kartına bağlamak istersen, **geçerli kombinasyonlardan biri** olmalı (aksi halde `400`):

| Gönderilen | Sonuç |
|---|---|
| Hiçbiri | Serbest metin içerik (önerilen, en esnek) |
| Yalnız `teamId` | Takım içeriği |
| Yalnız `playerId` | Oyuncu içeriği |
| `playerId` + `fromTeamId` + `toTeamId` | Transfer içeriği |
| Diğer kısmi kombinasyonlar (ör. yalnız `fromTeamId`) | ❌ `400` |

> UUID'leri çözemiyorsan **hiç gönderme** — içerik yine serbest metin olarak akışa girer.
> ID'ler TransferPulse'daki oyuncu/takım UUID'leridir (bizim katalog id'lerimiz).

---

## 6. Hata Durumları

| Kod | Sebep | Bot ne yapmalı |
|---|---|---|
| `400` | Geçersiz gövde (eksik alan, geçersiz kategori, geçersiz ID kombinasyonu) | Payload'ı düzelt, tekrar deneme (kalıcı hata) |
| `401` | Key yok/yanlış veya backend'de hash yok | Key/secret yapılandırmasını kontrol et |
| `429` | Rate limit (yazma: 120/dk) | Bekle, exponential backoff ile tekrar dene |
| `5xx` | Geçici sunucu hatası | Retry (idempotency sayesinde güvenli) |

Hata formatı:
```json
{ "success": false, "message": "...", "statusCode": 400, "path": "...", "timestamp": "..." }
```

---

## 7. Örnek İstekler

### cURL
```bash
curl -X POST https://api.transferpulse.app/api/ingest/posts \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{
    "category": "Breaking",
    "text": "Son dakika: Oyuncu X resmen Y takımında!",
    "sourceId": "1810000000000000001",
    "sourceUrl": "https://x.com/TransferPulse/status/1810000000000000001",
    "imageUrl": "https://cdn.example/x.jpg"
  }'
```

### Node.js
```js
import crypto from 'node:crypto';

const API = process.env.TP_API_URL;        // https://api.transferpulse.app
const KEY = process.env.TP_BOT_API_KEY;    // gizli

export async function pushToFeed(tweet) {
  const res = await fetch(`${API}/api/ingest/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY },
    body: JSON.stringify({
      category: tweet.category,         // 'Rumour' | 'Breaking' | 'Official'
      text: tweet.text,
      sourceId: tweet.id,               // tweet id → idempotency
      sourceUrl: tweet.url,
      imageUrl: tweet.image ?? undefined,
      playerId: tweet.playerId ?? undefined,
      teamId: tweet.teamId ?? undefined,
    }),
  });
  if (res.status === 429 || res.status >= 500) throw new Error(`retry: ${res.status}`);
  if (!res.ok) { console.error('kalıcı hata', await res.json()); return; }
  const { data } = await res.json();
  console.log(`feed: ${data.status} (${data.id})`);   // created | duplicate
}
```

### Python
```python
import requests, os

API, KEY = os.environ["TP_API_URL"], os.environ["TP_BOT_API_KEY"]

def push_to_feed(tweet):
    r = requests.post(
        f"{API}/api/ingest/posts",
        headers={"X-Api-Key": KEY},
        json={
            "category": tweet["category"],     # Rumour | Breaking | Official
            "text": tweet["text"],
            "sourceId": tweet["id"],           # idempotency
            "sourceUrl": tweet.get("url"),
            "imageUrl": tweet.get("image"),
        },
        timeout=10,
    )
    if r.status_code in (429,) or r.status_code >= 500:
        raise RuntimeError(f"retry: {r.status_code}")   # backoff ile tekrar
    r.raise_for_status()
    return r.json()["data"]["status"]                   # created | duplicate
```

---

## 8. Operasyonel Notlar

- **Akış:** bot onay verir vermez bu ucu çağırır → içerik anında uygulama akışında
  TransferPulse adına görünür (kullanıcılar beğenebilir/yorum yapabilir).
- **Idempotency:** her zaman gerçek **tweet id**'sini `sourceId` olarak gönder.
  Retry/yeniden işleme çift içerik üretmez.
- **Rate limit:** uç 120/dk. Toplu geçmiş aktarımında istekleri yay (throttle).
- **Güvenlik:** key'i HTTPS dışında kullanma; secret manager'da tut; periyodik rotasyon yap.
- **Faz-2 (opsiyonel sertleştirme):** kanal/replay riski artarsa HMAC imza + timestamp
  penceresi eklenebilir (backend'de hazır desen mevcut; talep halinde açılır).

---

## 9. Bot Tarafı Entegrasyon Kontrol Listesi

- [ ] `TP_API_URL` ve `TP_BOT_API_KEY` secret olarak tanımlı
- [ ] Her tweet için `category` doğru maplenıyor (Rumour/Breaking/Official)
- [ ] `sourceId = tweet.id` (idempotency garanti)
- [ ] `429`/`5xx` → exponential backoff retry; `400` → retry yok (logla)
- [ ] Oyuncu/takım UUID'si çözülemiyorsa ilgili alanı **gönderme**
- [ ] `status: "duplicate"` normaldir (tekrar gönderim) — hata sayma
- [ ] Key sadece HTTPS üzerinden, loglara yazılmadan kullanılıyor
```
