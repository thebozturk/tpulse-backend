# TransferPulse Back Office — Frontend API Entegrasyon Rehberi

> Bu doküman back office (admin panel) frontend'inin backend API'lerini bağlaması
> için gereken **tüm** bilgiyi içerir. Kaynak sözleşme: `openapi.json` (v1.1.0).
> Tüm uçlar canlı ve test edilmiştir.

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Base URL (dev)** | `http://localhost:8080` |
| **Tüm yollar** | `/api/...` ile başlar (global prefix yok, controller'larda gömülü) |
| **Content-Type** | `application/json` (dosya yükleme uçları hariç) |
| **Auth** | `Authorization: Bearer <accessToken>` |
| **Contract sürümü** | `1.1.0` (bkz. `openapi.json` → `info.version`) |
| **Swagger UI** | `GET /swagger` (dev'de açık) |

> **Önemli:** Admin uçlarının tamamı `role: "Admin"` ister. Admin olmayan token → `403`.

---

## 2. Kimlik Doğrulama Akışı

Back office girişinde standart kullanıcı login'i kullanılır; kullanıcının `role`'ü
`Admin` olmalıdır.

### 2.1 Giriş — `POST /api/auth/login`  *(public)*

İstek:
```json
{ "email": "admin@acme.com", "password": "Secret123" }
```

Yanıt `200` — **zarfsız** (auth uçları `{data}` ile sarılmaz):
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "opaque-random-token",
  "expiresAt": "2026-06-07T12:15:00.000Z",
  "user": {
    "id": "uuid", "username": "admin", "email": "admin@acme.com",
    "nickname": "Admin", "role": "Admin", "status": "Active",
    "reputationScore": 0, "isMailConfirm": true, "createdAt": "..."
  }
}
```

Frontend: `accessToken`'ı bellekte, `refreshToken`'ı güvenli depoda tut.
`user.role !== "Admin"` ise BO'ya girişi engelle.

### 2.2 Her isteğe token ekle

```
Authorization: Bearer <accessToken>
```

### 2.3 Token yenileme — `POST /api/auth/refresh`  *(public)*

Access token kısa ömürlüdür (15 dk). `401` alındığında:
```json
{ "refreshToken": "..." }
```
Yanıt `200` (rotation — yeni refresh token döner, eskisi geçersizleşir):
```json
{ "accessToken": "...", "refreshToken": "...(yeni)", "expiresAt": "..." }
```

### 2.4 Çıkış

- `POST /api/auth/logout` body `{ "refreshToken": "..." }` → tek cihaz.
- `POST /api/auth/revoke-all` (Bearer) → tüm cihazlar.

### 2.5 Ban davranışı (önemli!)

Bir kullanıcı **banlanır/askıya alınırsa** access token'ı süresi dolmadan da
**anında geçersizleşir**: korumalı uçlara yapılan istek `403` döner ve refresh
token'ları iptal edilir. Frontend `403` + `"Hesabınız banlandı/askıya alındı"`
mesajını yakalayıp oturumu sonlandırmalıdır.

---

## 3. Response Zarfları

BO uçları üç tutarlı zarf kullanır:

| Zarf | Şekil | Kullanım |
|---|---|---|
| **Single** | `{ "data": T }` | tekil kayıt (detay, oluştur, güncelle) |
| **Paged** | `{ "items": T[], "page", "pageSize", "totalCount", "totalPages" }` | listeler |
| **Action** | `{ "success": true }` | sil/aksiyon (gövdesiz işlem) |

> Auth uçları (login/refresh) **zarfsız** ham DTO döner — yukarıya bakın.
> `DELETE .../currency-rates/:id` → `204 No Content` (gövde yok).

---

## 4. Hata Formatı

Tüm hatalar `HttpExceptionFilter` ile tek formatta döner:

```json
{
  "success": false,
  "message": "Kullanıcı bulunamadı",
  "statusCode": 404,
  "path": "/api/admin/users/...",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

Validation hatalarında ek `errors` alanı (class-validator mesaj dizisi):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["status must be a valid enum value", "reason must be shorter than 500"],
  "statusCode": 400,
  "path": "...", "timestamp": "..."
}
```

### Status kodları

| Kod | Anlam |
|---|---|
| `400` | Validation / geçersiz gövde (bilinmeyen alan da reddedilir) |
| `401` | Token yok / geçersiz / süresi dolmuş → **refresh dene** |
| `403` | Yetki yok (Admin değil) **veya** kullanıcı banlı/askıda |
| `404` | Kayıt bulunamadı |
| `409` | Çakışma (ör. tekrar rapor, aynı tarihli döviz kuru, son admin'i düşürme) |
| `429` | Rate limit aşıldı |

> **Dikkat:** Gövde gönderirken **fazladan/bilinmeyen alan göndermeyin** —
> `forbidNonWhitelisted` aktif, bilinmeyen alan `400` ile reddedilir.

---

## 5. Ortak Konseptler

### 5.1 Sayfalama
Tüm liste uçları: `?page=1&pageSize=20` (varsayılan `page=1`, `pageSize=20`, **max 100**).
Yanıt `totalPages` ve `totalCount` ile gelir.

### 5.2 Enum değerleri (string)

```ts
type UserStatus      = 'Active' | 'Inactive' | 'Banned' | 'Suspended';
type UserRole        = 'User' | 'Admin';
type ReportTargetType= 'Post' | 'Comment' | 'TransferComment' | 'User';
type ReportReason    = 'Spam' | 'Hate' | 'Harassment' | 'Other';
type ReportStatus    = 'Pending' | 'Reviewed' | 'Actioned' | 'Dismissed';
type BroadcastStatus = 'Queued' | 'Sending' | 'Done' | 'Failed';
```

`NotificationEventType` **sayısaldır**: `1=Rumour, 2=Transfer, 3=Announcement`
(broadcast'ler `3` olarak üretilir).

### 5.3 Rate limit
Global `300/dk/IP`. Mutating uçlar `120/dk`. **Broadcast `10/dk`** (pahalı).
`429` alınırsa kullanıcıya "biraz sonra tekrar deneyin" gösterin.

---

## 6. Endpoint Kataloğu

Aşağıdaki tüm `/api/admin/*` uçları **Bearer + Admin** ister.
`POST /api/reports` herhangi bir oturum açmış kullanıcı içindir.

### 6.1 Dashboard

#### `GET /api/admin/dashboard/overview`
Genel bakış metrikleri (60-90 sn cache'li).
```json
{ "data": {
  "users":      { "total": 1240, "activeToday": 87, "newThisWeek": 53 },
  "content":    { "transfers": 320, "rumours": 145, "news": 76, "posts": 5021, "comments": 18342 },
  "moderation": { "pendingReports": 12 },
  "recent":     [ { "type": "post", "id": "uuid", "label": "metin özeti", "createdAt": "..." } ]
} }
```

### 6.2 Kullanıcı Yönetimi

#### `GET /api/admin/users?status=&role=&q=&page=&pageSize=`
Filtreli liste. `q` → username/email/nickname araması.
→ `Paged<User>` (aşağıdaki `User` şekli).

#### `GET /api/admin/users/:id`
→ `{ data: UserDetail }` (User + `bannedAt?`, `banReason?`, `updatedAt?`).

#### `GET /api/admin/users/:id/content?type=posts|comments|transfers&page=&pageSize=`
Kullanıcının içeriği.
→ `Paged<{ type, id, label, createdAt }>`.

#### `PATCH /api/admin/users/:id/status`
```json
{ "status": "Banned", "reason": "Irkçı içerik" }   // reason opsiyonel
```
→ `{ data: UserDetail }`. Ban/suspend/inactive → token iptali + anında 403 etkisi.

#### `PATCH /api/admin/users/:id/role`
```json
{ "role": "Admin" }   // "User" | "Admin"
```
→ `{ data: UserDetail }`. **Son aktif admin'i düşürmek `409`.**

#### `PATCH /api/admin/users/:id/reputation`
```json
{ "delta": 5 }     // VEYA { "value": 100 } — tam olarak biri (ikisi/hiçbiri → 400)
```
→ `{ data: UserDetail }`.

**User şekli:**
```ts
interface User {
  id: string; username: string; email: string; nickname: string;
  profilePic?: string; isMailConfirm: boolean; status: UserStatus;
  favouriteTeam?: string; reputationScore: number; role: UserRole; createdAt: string;
}
interface UserDetail extends User { bannedAt?: string; banReason?: string; updatedAt?: string; }
```

### 6.3 İçerik Moderasyonu

#### `GET /api/admin/posts?ownerId=&q=&page=&pageSize=`
→ `Paged<Post>` (mevcut public post şekli).

#### `DELETE /api/admin/posts/:id`
Admin owner-bypass siler (beğeni/oy/yorum cascade temizlenir). → `{ "success": true }`.

#### `GET /api/admin/comments?ownerId=&q=&page=&pageSize=`
→ `Paged<AdminComment>`:
```ts
interface AdminComment {
  id: string; postId: string; ownerId: string; ownerUsername: string;
  content: string; likeCount: number; createdAt: string;
}
```

#### `DELETE /api/admin/comments/:id` → `{ "success": true }`
#### `DELETE /api/admin/transfer-comments/:id` → `{ "success": true }`

### 6.4 Şikayet / Moderasyon Kuyruğu

#### `POST /api/reports`  *(herhangi bir oturum açmış kullanıcı)*
```json
{ "targetType": "Post", "targetId": "uuid", "reason": "Hate", "note": "opsiyonel" }
```
→ `201 { data: Report }`. Aynı hedefe tekrar rapor → `409`. Hedef yoksa → `404`.

#### `GET /api/admin/reports?status=&page=&pageSize=`
→ `Paged<Report>`. `status` filtresi (genelde `Pending`).

#### `PATCH /api/admin/reports/:id`
```json
{ "status": "Actioned", "deleteContent": true, "banUser": false }
```
- `status`: `Reviewed | Actioned | Dismissed`
- `deleteContent` (ops.): raporlanan içeriği sil (`Actioned` ile)
- `banUser` (ops.): içerik sahibini / hedef kullanıcıyı banla (`Actioned` ile)
→ `{ data: Report }`.

**Report şekli:**
```ts
interface Report {
  id: string; reporterUserId: string; targetType: ReportTargetType; targetId: string;
  reason: ReportReason; note?: string; status: ReportStatus;
  reviewedByUserId?: string; reviewedAt?: string; createdAt: string;
}
```

### 6.5 Audit Log

#### `GET /api/admin/audit-logs?actor=&action=&from=&to=&page=&pageSize=`
`actor` = userId; `action` = ör. `user.status`; `from`/`to` = ISO tarih.
→ `Paged<AuditLog>`:
```ts
interface AuditLog {
  id: string; actorUserId: string; action: string;
  targetType?: string; targetId?: string; metadata?: unknown; createdAt: string;
}
```
**Action katalog:** `user.status`, `user.role`, `user.reputation`, `post.delete`,
`comment.delete`, `transferComment.delete`, `report.review`, `notification.broadcast`.

### 6.6 Sistem: Broadcast & Döviz

#### `POST /api/admin/notifications/broadcast`  *(10/dk limit)*
```json
{ "title": "Bakım", "body": "02:00-03:00 bakım.", "target": "all" }  // target ops., default "all"
```
→ `202 { data: Broadcast }` (kuyruğa alınır, async işlenir):
```ts
interface Broadcast {
  id: string; title: string; body: string; target: string;
  status: BroadcastStatus; sentCount: number; createdBy: string; createdAt: string;
}
```

#### `GET /api/admin/notifications/broadcasts?page=&pageSize=`
Gönderim geçmişi → `Paged<Broadcast>`. `status`/`sentCount` ile ilerlemeyi gösterin.

#### `GET /api/admin/currency-rates?page=&pageSize=` → `Paged<CurrencyRate>`
#### `POST /api/admin/currency-rates`
```json
{ "currencyCode": "EUR", "baseCurrencyCode": "TRY", "rate": 35.42, "rateDate": "2026-06-07T00:00:00.000Z" }
```
→ `201 { data: CurrencyRate }`. Aynı (kod, baz, tarih) → `409`. `rate` pozitif olmalı.

#### `PUT /api/admin/currency-rates/:id`  `{ "rate": 35.9 }` → `{ data: CurrencyRate }`
#### `DELETE /api/admin/currency-rates/:id` → `204` (gövdesiz)

```ts
interface CurrencyRate {
  id: string; currencyCode: string; baseCurrencyCode: string;
  rate: number; rateDate: string; createdAt: string;
}
```

---

## 7. Hızlı Referans Tablosu

| Method | Path | Auth | Gövde / Query |
|---|---|---|---|
| POST | `/api/auth/login` | public | `{email,password}` |
| POST | `/api/auth/refresh` | public | `{refreshToken}` |
| GET | `/api/admin/dashboard/overview` | Admin | — |
| GET | `/api/admin/users` | Admin | `?status,role,q,page,pageSize` |
| GET | `/api/admin/users/:id` | Admin | — |
| GET | `/api/admin/users/:id/content` | Admin | `?type,page,pageSize` |
| PATCH | `/api/admin/users/:id/status` | Admin | `{status,reason?}` |
| PATCH | `/api/admin/users/:id/role` | Admin | `{role}` |
| PATCH | `/api/admin/users/:id/reputation` | Admin | `{delta?\|value?}` |
| GET | `/api/admin/posts` | Admin | `?ownerId,q,page,pageSize` |
| DELETE | `/api/admin/posts/:id` | Admin | — |
| GET | `/api/admin/comments` | Admin | `?ownerId,q,page,pageSize` |
| DELETE | `/api/admin/comments/:id` | Admin | — |
| DELETE | `/api/admin/transfer-comments/:id` | Admin | — |
| POST | `/api/reports` | User | `{targetType,targetId,reason,note?}` |
| GET | `/api/admin/reports` | Admin | `?status,page,pageSize` |
| PATCH | `/api/admin/reports/:id` | Admin | `{status,deleteContent?,banUser?}` |
| GET | `/api/admin/audit-logs` | Admin | `?actor,action,from,to,page,pageSize` |
| POST | `/api/admin/notifications/broadcast` | Admin | `{title,body,target?}` |
| GET | `/api/admin/notifications/broadcasts` | Admin | `?page,pageSize` |
| GET | `/api/admin/currency-rates` | Admin | `?page,pageSize` |
| POST | `/api/admin/currency-rates` | Admin | `{currencyCode,baseCurrencyCode,rate,rateDate}` |
| PUT | `/api/admin/currency-rates/:id` | Admin | `{rate}` |
| DELETE | `/api/admin/currency-rates/:id` | Admin | — |

---

## 8. Hazır TypeScript Client (kopyala-kullan)

Otomatik token yenileme + tipli zarflar içeren minimal fetch wrapper:

```ts
// bo-api.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export interface Paged<T> {
  items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number;
}
interface Single<T> { data: T; }
interface ApiError { success: false; message: string; errors?: string[]; statusCode: number; }

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem('bo_refresh');

export function setSession(at: string, rt: string) {
  accessToken = at; refreshToken = rt; localStorage.setItem('bo_refresh', rt);
}
export function clearSession() {
  accessToken = refreshToken = null; localStorage.removeItem('bo_refresh');
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await raw('/api/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { clearSession(); return false; }
  const t = await res.json();
  setSession(t.accessToken, t.refreshToken);
  return true;
}

/** Tüm BO çağrıları bunu kullanır: 401'de bir kez refresh dener, 403'te oturumu düşürür. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && (await refresh())) res = await raw(path, init);
  if (res.status === 403) { clearSession(); throw new Error('Yetki yok / hesap pasif'); }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error((body as ApiError).message), body);
  return body as T;
}

// ── Örnek kullanım ───────────────────────────────────────────────
import type { /* yukarıdaki tipler */ } from './bo-types';

export const BO = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; refreshToken: string; user: { role: string } }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  dashboard: () => api<Single<DashboardOverview>>('/api/admin/dashboard/overview'),

  listUsers: (q: { status?: string; role?: string; q?: string; page?: number }) =>
    api<Paged<User>>(`/api/admin/users?${new URLSearchParams(q as Record<string,string>)}`),

  banUser: (id: string, reason?: string) =>
    api<Single<UserDetail>>(`/api/admin/users/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'Banned', reason }) }),

  reports: (status = 'Pending', page = 1) =>
    api<Paged<Report>>(`/api/admin/reports?status=${status}&page=${page}`),

  actionReport: (id: string, opts: { status: string; deleteContent?: boolean; banUser?: boolean }) =>
    api<Single<Report>>(`/api/admin/reports/${id}`,
      { method: 'PATCH', body: JSON.stringify(opts) }),

  broadcast: (title: string, body: string) =>
    api<Single<Broadcast>>('/api/admin/notifications/broadcast',
      { method: 'POST', body: JSON.stringify({ title, body }) }),
};
```

> **İpucu:** Tipleri elle yazmak yerine `openapi.json`'dan otomatik üretebilirsiniz:
> ```bash
> npx openapi-typescript openapi.json -o src/api/schema.d.ts
> ```
> Böylece backend her güncellendiğinde tipler senkron kalır.

---

## 9. Entegrasyon Kontrol Listesi

- [ ] `.env` → `VITE_API_URL=http://localhost:8080`
- [ ] Login → `user.role === "Admin"` kontrolü (değilse BO'ya girişi engelle)
- [ ] `api()` wrapper: 401→refresh, 403→logout, 429→retry-after mesajı
- [ ] Bilinmeyen alan **gönderme** (400 olur)
- [ ] Enum'ları `<select>`'lerden sabit listeyle besle (bkz. §5.2)
- [ ] Liste ekranlarında `totalPages`/`totalCount` ile sayfalama
- [ ] Broadcast sonrası `GET .../broadcasts` ile `status`/`sentCount` polling
- [ ] Tipleri `openapi.json`'dan üretip CI'da senkron tut
```
