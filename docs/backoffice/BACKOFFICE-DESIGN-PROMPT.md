# TransferPulse — Back Office (Admin Panel) Web Tasarım Brief'i

> **Bu doküman Claude Design'a verilmek üzere hazırlandı.** Aşağıdaki içeriği
> tasarım aracına yapıştır. Amaç: TransferPulse mobil uygulamasının görsel
> kimliğini birebir taşıyan, **web (desktop-first)** bir yönetim paneli (back
> office) tasarlamak. Panel, uygulama sahibinin (owner/admin) **her şeyi**
> yönettiği tek merkezdir.

---

## 0. Brief — Tek Cümle

> "TransferPulse"un koyu/neon-lime sportif kimliğini taşıyan, **desktop-first
> bir admin back office** tasarla: solda sabit sidebar, üstte topbar, içerikte
> veri tabloları + form/drawer'lar. Owner; kullanıcıları, transferleri,
> duyumları, haberleri, gönderi/yorum moderasyonunu, oyuncu/takım/lig
> kataloğunu, veri senkronizasyonunu ve bildirimleri buradan yönetir.

---

## 1. Ürün Bağlamı

**TransferPulse**, futbol transfer haberleri / duyumları (rumours) ve bir sosyal
akış (gönderi + oylama "Katılıyorum/Katılmıyorum" + yorum) sunan bir mobil
uygulama. Veriler kısmen API-Football'dan senkronlanıyor, kısmen elle giriliyor.

**Back office'in görevi:** Owner'ın tüm uygulamaya hakim olması:
- Kullanıcı yönetimi (görüntüleme, ban/askıya alma, rol verme)
- İçerik üretimi: yeni **transfer**, **duyum (rumour)**, **haber** ekleme
- İçerik moderasyonu: kullanıcı gönderileri/yorumları (akışta ırkçı/hakaret
  içerik görülebiliyor — **moderasyon birinci öncelik**)
- Katalog: oyuncu / takım / lig CRUD + görsel yükleme
- Veri operasyonları: API-Football senkron tetikleme + geçmiş
- Dashboard: anlık metrikler, son aktiviteler

**Hedef kullanıcı:** Tek/birkaç admin. Yoğun veri girişi ve hızlı moderasyon
yapacak güç kullanıcılar. Estetik **ama** işlevsel ve hızlı olmalı.

---

## 2. Marka & Görsel Kimlik

Mobil uygulamadan **birebir** taşınacak. Tema **yalnızca koyu (dark)**.

### 2.1 Renk Paleti (token'lar)

| Token | Hex | Kullanım |
|---|---|---|
| `--bg-base` | `#0A0A0B` | Sayfa arka planı (neredeyse siyah) |
| `--bg-surface` | `#141416` | Kart, panel, tablo arkaplanı |
| `--bg-surface-2` | `#1B1B1F` | İç içe kart / hover surface |
| `--bg-elevated` | `#202024` | Drawer, modal, dropdown |
| `--border` | `#2A2A2E` | Çizgi, ayraç, input border (≈ `rgba(255,255,255,.08)`) |
| `--accent` | `#C6F833` | **Ana neon lime** (TP yeşili) — aktif tab, CTA, vurgular |
| `--accent-hover` | `#D4FF55` | Accent hover |
| `--accent-fg` | `#0A0A0B` | Lime üzerindeki metin (siyah) |
| `--text-primary` | `#F5F6F7` | Başlık + ana metin (beyaz) |
| `--text-secondary` | `#8A8A92` | İkincil metin, label |
| `--text-muted` | `#5A5A62` | Pasif / placeholder |
| `--success` | `#3FB960` | Olumlu / "Katılıyorum" / ucuz bonservis |
| `--success-bg` | `#13301E` | Olumlu buton zemini (koyu yeşil) |
| `--danger` | `#E5484D` | Sil / ban / "Katılmıyorum" / pahalı transfer |
| `--danger-bg` | `#3A1618` | Tehlike buton zemini (koyu kırmızı) |
| `--warning` | `#E8943A` | Orta bütçe transfer / uyarı |
| `--info` | `#4A9EFF` | Bilgi / link |

**Bonservis/ücret renk skalası (transfer ücretine göre):** ucuz → `--success`
(yeşil), orta → `--warning` (turuncu), pahalı → `--danger` (kırmızı). "BONSERVİS"
(serbest transfer) rozeti **lime** zemin/çerçeve.

### 2.2 Tipografi

- **Display / büyük başlıklar** (örn. "SICAK TAKİP", sayfa başlıkları):
  **condensed, bold, italic, UPPERCASE**, sıkı harf aralığı — sportif/atletik
  his. Öneri: *Saira Condensed*, *Oswald* veya *Inter Tight* (heavy/italic).
- **Gövde / UI metni:** *Inter* (veya system sans). Net, yüksek okunabilirlik.
- **Sayılar / para / istatistik:** tabular figürler, **bold**. Para birimi
  kısaltmaları (M€) ile birlikte.
- Hiyerarşi: Sayfa başlığı (uppercase italic) → bölüm başlığı → kart başlığı →
  label (uppercase, küçük, `--text-secondary`, geniş tracking).

### 2.3 Logo & Wordmark

- **Monogram:** Beyaz **T** + neon-lime **P**, lime halka içinde, altında lime
  **kalp atışı / pulse çizgisi**. (Sidebar başında ve login'de.)
- **Wordmark:** "TRANSFER" beyaz + "PULSE" lime — tek satır, uppercase.
- "● CANLI" göstergesi: lime nokta + uppercase küçük etiket, ince çerçeveli pill.

### 2.4 Şekil & Stil

- **Köşe yuvarlaması:** kartlar ~16px, butonlar pill veya ~10px, input ~10px.
- **Butonlar:** Primary = dolgulu lime + siyah metin; Secondary = şeffaf +
  `--border`; Danger = `--danger-bg` + `--danger` metin.
- **Aktif tab/segment:** dolgulu lime pill, siyah metin (uygulamadaki "RESMİ
  TRANSFERLER" segmenti gibi).
- **İkonografi:** ince çizgi (line) ikonlar; aktifken lime.
- **Gölge:** minimal; ayrım için border + hafif surface farkı kullan (neon
  glow'u sadece accent öğelerde çok hafif kullan).
- **Avatar/rozet:** dairesel avatar; doğrulanmış kullanıcıda lime ✓ rozeti
  (uygulamadaki "@takakamil ✓" gibi).

---

## 3. Layout (İskelet)

```
┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR (sabit, ~248px, daraltılabilir 72px)  │  TOPBAR           │
│ ┌────────────────────────────┐                │  ┌──────────────┐ │
│ │ [TP logo + wordmark]        │                │  arama · ●CANLI  │ │
│ │                             │                │  · bildirim · admin│
│ │ ── GENEL ──                 │                └──────────────────┘ │
│ │  ▸ Dashboard                │  ┌─────────────────────────────┐  │
│ │ ── İÇERİK ──                │  │                             │  │
│ │  ▸ Transferler              │  │   SAYFA İÇERİĞİ             │  │
│ │  ▸ Duyumlar (Rumours)       │  │   (tablo / form / drawer)   │  │
│ │  ▸ Haberler                 │  │                             │  │
│ │ ── MODERASYON ──            │  │                             │  │
│ │  ▸ Akış / Gönderiler        │  │                             │  │
│ │  ▸ Yorumlar                 │  │                             │  │
│ │  ▸ Şikayetler (badge: 3)    │  │                             │  │
│ │ ── KATALOG ──               │  │                             │  │
│ │  ▸ Oyuncular                │  │                             │  │
│ │  ▸ Takımlar                 │  │                             │  │
│ │  ▸ Ligler                   │  │                             │  │
│ │  ▸ Transfer Dönemleri       │  │                             │  │
│ │ ── KULLANICILAR ──          │  │                             │  │
│ │  ▸ Kullanıcılar             │  │                             │  │
│ │ ── SİSTEM ──                │  │                             │  │
│ │  ▸ Veri Senkron (Sync)      │  │                             │  │
│ │  ▸ Bildirim Gönder          │  │                             │  │
│ │  ▸ Ayarlar                  │  │                             │  │
│ └────────────────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- **Sidebar:** koyu (`--bg-surface`), gruplu nav (GENEL / İÇERİK / MODERASYON /
  KATALOG / KULLANICILAR / SİSTEM). Aktif item: sol lime şerit + lime metin/ikon.
  Moderasyon ve Şikayetler item'larında bekleyen sayıyı gösteren lime/kırmızı
  badge.
- **Topbar:** global arama (oyuncu/takım/kullanıcı), "● CANLI" göstergesi,
  bildirim zili (admin uyarıları), admin avatar + dropdown (profil, çıkış).
- **İçerik:** geniş, breathing room, sayfa başlığı (uppercase italic) + sağda
  ana aksiyon butonu ("+ Yeni Transfer" vb.).

---

## 4. Ekranlar (Sayfa Sayfa)

Her ekran için **tablo görünümü + oluştur/düzenle (drawer veya modal) + detay**
varyantlarını tasarla. Boş/yükleniyor/hata durumlarını da göster.

### 4.1 Login (Admin Girişi)
Ortalanmış kart, koyu zemin, TP monogram tepede. E-posta + parola, "Giriş yap"
(lime CTA). Hatalı giriş durumu. Arka planda hafif lime pulse motifi.

### 4.2 Dashboard / Genel Bakış
- Üstte **KPI stat kartları** (4-6 adet): Toplam Kullanıcı, Aktif Bugün, Toplam
  Transfer, Bekleyen Duyum, Bekleyen Şikayet, Bugünkü Yeni Gönderi. Her kartta
  sayı + küçük trend (↑%) + mini sparkline.
- **Grafikler:** kullanıcı büyümesi (çizgi), içerik üretimi (bar: transfer/haber/
  gönderi), lig bazında transfer dağılımı (donut).
- **Canlı aktivite akışı:** son transferler/duyumlar/kayıtlar (uygulamadaki
  "SICAK TAKİP" yatay kart şeridine benzer bir "canlı" şerit).
- **Moderasyon kuyruğu özeti:** bekleyen şikayet/işaretli içerik kısayolu.

### 4.3 Transferler
- **Liste/tablo:** kolonlar — Oyuncu (avatar+ad), Pozisyon (KL/DF/OS/ST rozet),
  Yaş/Uyruk, Nereden → Nereye (takım logoları), **Ücret** (renk skalalı chip),
  Para birimi, Tarih, Kaynak (Manual/ApiSports rozet), Resmi/Duyum, aksiyonlar.
- **Filtre barı:** lig, takım, tarih aralığı, ücret aralığı, kaynak, resmi/duyum.
- **Oluştur/Düzenle drawer'ı (form):** Oyuncu seç (aranabilir select +
  avatar/önizleme), Nereden takım, Nereye takım, Ücret + para birimi, Transfer
  tarihi, Kaynak, "Resmi mi / Duyum mu" toggle. Validasyon hataları satır içi.
- **Detay:** transfer kartı + bağlı yorumlar + sil/düzenle.

### 4.4 Duyumlar (Rumours)
Transferlerle aynı yapı; ek aksiyon: **"Resmîleştir" (confirm → transfer)** —
duyumu onaylayıp resmi transfere çeviren belirgin lime aksiyon + onay dialog'u.

### 4.5 Haberler (Haber Yönetimi)
- **Liste:** Görsel küçük, Başlık, Bağlı oyuncu/takım, Kaynak, Yayın tarihi.
- **Oluştur/Düzenle:** Başlık, İçerik (zengin metin alanı), **görsel yükleme**
  (sürükle-bırak + önizleme + URL'den getir), Bağlı oyuncu (select), Nereden/
  Nereye takım (opsiyonel), Kaynak adı + URL, yayın tarihi.
- **Toplu silme** (checkbox + bulk action bar).

### 4.6 Akış / Gönderi Moderasyonu  ⚠️ *Öncelikli*
- **Liste:** kullanıcı gönderileri — Sahip (avatar+kullanıcı adı, doğrulama
  rozeti), İçerik (kısaltılmış metin), Tip (Transfer/Takım/Oyuncu), Beğeni/
  Yorum/Oy sayıları, Tarih.
- **İşaretli/şikayet edilen** gönderiler için ayrı sekme / kırmızı vurgu.
- **Aksiyon:** Görüntüle, **Sil** (onaylı), kullanıcıyı uyar/ban'a git.
- **Detay/önizleme:** gönderiyi mobildeki gibi render et (oylama barı %, yorumlar)
  ki admin bağlamı görsün. *(Ekran görüntülerinde hakaret/ırkçı içerik var —
  hızlı silme akışı kritik.)*

### 4.7 Yorum Moderasyonu
Gönderi yorumları + transfer yorumları için liste; içerik, sahip, bağlı gönderi/
transfer, tarih, **Sil**. İşaretli yorumlar üstte.

### 4.8 Şikayetler / İşaretli İçerik
Kullanıcı raporlarının kuyruğu: Rapor eden, Hedef içerik (gönderi/yorum/
kullanıcı), Sebep, Tarih, Durum. Aksiyonlar: İncele → İçeriği sil / Kullanıcıyı
ban / Reddet. (Backend'de rapor sistemi yeni eklenecek — UI'ı buna hazırla.)

### 4.9 Oyuncular (Katalog)
- **Liste:** Foto, Ad, Pozisyon, Takım, Uyruk, Yaş, Serbest mi (toggle göstergesi).
- **Oluştur/Düzenle:** Ad/soyad, uyruk, doğum tarihi, boy/kilo, pozisyon (select),
  takım (select), **foto yükleme** (yükle / URL'den / önizleme), "serbest oyuncu"
  toggle. Aranabilir.

### 4.10 Takımlar
Liste (logo, ad, lig, şehir/stadyum) + Oluştur/Düzenle (logo yükle, kuruluş yılı,
stadyum adı/şehir/kapasite, lig seç).

### 4.11 Ligler
Liste (logo, ad, ülke, takım sayısı) + Oluştur/Düzenle (lig logosu, ülke +
ülke bayrağı, lig kodu).

### 4.12 Transfer Dönemleri
Liste (ad, tip Yaz/Kış, başlangıç–bitiş) + Oluştur/Düzenle (tarih aralığı).

### 4.13 Kullanıcılar
- **Liste:** Avatar, Kullanıcı adı, Nickname, E-posta, Rol (User/Admin), **Durum**
  (Active/Inactive/Banned/Suspended — renkli rozet), İtibar puanı, Kayıt tarihi.
- **Filtre:** durum, rol, arama.
- **Detay sayfası:** profil + **kullanıcının içeriği** (gönderileri, yorumları,
  transferleri) sekmeleri + aktivite.
- **Aksiyonlar:** **Ban / Askıya al / Aktifleştir** (durum değiştir), **Rol
  ver/al** (Admin yap), itibar düzenle. Yıkıcı aksiyonlar onay dialog'u ister.

### 4.14 Veri Senkron (Sync / Data Ops)
- API-Football senkronunu **tetikle** (tümü / belirli lig) — büyük lime aksiyon.
- **Senkron geçmişi tablosu (SyncRun):** Başlangıç, Süre, Durum (Başarılı/Kısmi/
  Hatalı rozet), eklenen/güncellenen lig-takım-oyuncu sayıları, hata sayısı.
- Offline seed yükleme (JSON) opsiyonu.

### 4.15 Bildirim Gönder (Broadcast)
Manuel bildirim oluştur: başlık, gövde, hedef (tüm kullanıcılar / segment),
önizleme + gönder. Gönderim geçmişi.

### 4.16 Ayarlar
- **Döviz kurları** yönetimi (EUR baz; USD/GBP/TRY oranları — düzenlenebilir tablo).
- Admin profil + parola değiştir.
- (Opsiyonel) uygulama geneli ayarlar, feature flag'ler.

---

## 5. Ortak Bileşenler (Design System)

Tasarımı bir bileşen kütüphanesi olarak kur:

- **Veri tablosu:** sıralanabilir başlık, sayfalama, satır hover, satır aksiyon
  menüsü (⋯), satır seçimi (bulk), yoğun (compact) satır yüksekliği.
- **Filtre barı:** chip/dropdown filtreler + arama + "temizle".
- **Form alanları:** text, textarea, **aranabilir select** (oyuncu/takım — avatar/
  logo'lu), date picker, **para + para birimi** input, **görsel yükleme** (drag-
  drop + önizleme + URL'den getir), toggle/switch, segment control.
- **Drawer (sağdan)** ve **Modal** — oluştur/düzenle için drawer tercih.
- **Onay dialog'u** — yıkıcı aksiyonlar (sil/ban) için kırmızı vurgulu.
- **Stat kart** — sayı + label + trend + sparkline.
- **Rozetler:** durum (renkli), pozisyon (KL/DF/OS/ST), kaynak, "BONSERVİS"
  (lime), doğrulanmış kullanıcı (lime ✓).
- **Para chip'i** — değere göre yeşil/turuncu/kırmızı.
- **Avatar** + takım/lig **logo** öğeleri.
- **Toast/snackbar** (başarı = lime, hata = kırmızı).
- **Boş durum** (illüstrasyon + "Henüz X yok" + CTA), **yükleniyor** (skeleton),
  **hata** (tekrar dene).
- **Canlı şerit** — yatay kaydırmalı "SICAK TAKİP" tarzı kart şeridi (dashboard).

---

## 6. Etkileşim & Durumlar

- **Yıkıcı aksiyon** her zaman onay ister (sil, ban, toplu silme).
- **Optimistic feedback:** kaydet → toast + tabloyu güncelle.
- **Hızlı moderasyon:** listeden tek tıkla sil (onaylı), klavye kısayolları
  (J/K gez, Del sil) düşün.
- **Boş/loading/error** her tablo ve form için tasarlanmalı.
- **Yetki:** sadece Admin rolü erişir (login zorunlu).

---

## 7. Responsive & Erişilebilirlik

- **Desktop-first** (1280–1920px hedef). 1024px'te sidebar daraltılır (ikon-only).
- Tablet'te tablolar yatay kaydırma; formlar tek kolon.
- Kontrast: koyu zeminde metin WCAG AA. Lime üzerinde **siyah** metin
  (lime + beyaz okunmaz — kullanma).
- Odak (focus) halkaları lime; klavye gezinmesi.

---

## 8. Teslim Edilecek Ekran Listesi (öncelik sırası)

1. Login
2. Dashboard
3. Transferler — liste + oluştur/düzenle drawer
4. Duyumlar — liste + "resmîleştir" akışı
5. Haberler — liste + oluştur/düzenle (görsel yükleme)
6. Akış/Gönderi moderasyonu — liste + detay/sil  ⚠️
7. Yorum moderasyonu + Şikayetler
8. Kullanıcılar — liste + detay + ban/rol
9. Oyuncular / Takımlar / Ligler — liste + form (katalog seti)
10. Transfer Dönemleri
11. Veri Senkron — tetikle + geçmiş tablosu
12. Bildirim Gönder
13. Ayarlar (döviz kurları)
14. Bileşen kütüphanesi sayfası (tablo, form, rozet, buton, kart varyantları)

---

## 9. Ton

Sportif, hızlı, "canlı/anlık", profesyonel. Spor-medya + modern SaaS dashboard
karışımı. Neon-lime **vurgu** rengidir — az ama etkili kullan; zemin koyu ve
sakin kalsın, veri ön planda olsun.
