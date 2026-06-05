# /help — Komut Rehberi

$ARGUMENTS: Opsiyonel. Belirli bir komut adı → o komutun detayı. Boş → tüm liste.

## Amaç

Mevcut komutları, ne işe yaradıklarını ve ne zaman kullanılacaklarını listele.

## Protocol

1. **$ARGUMENTS varsa** — Belirli komut detayı
2. **$ARGUMENTS yoksa** — Kategorize liste

## Context Bütçesi: Max 5k token

---

## Tüm komutlar listesi (varsayılan)

```
FACTORY KOMUTLARI

═══ Kurulum / Başlangıç ═══
  /onboard [deep]        Mevcut projeyi tarayıp convention tespit et
  /design <ne>           İnteraktif tasarım, modül spec'i üret

═══ Geliştirme ═══
  /build <modül>         Spec'ten kod + test üret (en çok kullanılan)
  /resume                Yarım kalan görevi devam ettir

═══ Test ═══
  /test [tip]            smoke | unit | integration | e2e | coverage | all

═══ Kalite ═══
  /review [mode]         quick | deep | perf — kod incelemesi
  /improve [show]        Error log'dan kalıcı kural oluştur

═══ Yardım ═══
  /help [komut]          Bu liste veya belirli komut detayı

═══ Profile-Özel Komutlar ═══

Backend profile:
  /endpoint, /module, /db, /stream, /secure, /contract-publish

Frontend profile:
  /page, /component, /form, /hook, /seo, /schema, /sitemap, /stream-hook

Mobile profile (v1.6.0+):
  /screen, /component, /hook, /form         (RN component & screen)
  /permissions, /deeplink, /native-plugin   (native config & permissions)
  /build, /submit, /update                  (EAS Build/Submit/Update)

v1.4.0+ — Database & streaming:
  /db init|migrate|schema|seed|reset    (backend) Prisma+Postgres veya Mongoose+MongoDB
  /stream <event-name>                    (backend) SSE veya WebSocket endpoint
  /stream-hook <event-name>               (frontend) typed React subscribe hook (SSE/WS)
  /server-stream <action-name>            (frontend) React 19 Server Action streaming

v1.5.0+ — Architectural patterns:
  /architecture review [path]             Mimari incelemesi (layer, SOLID, anti-pattern)
  /architecture refactor <pattern>        Strategy/Repository/Factory/DI refactor
  /architecture audit                     Tüm projede anti-pattern envanteri

Detay için: /help <komut-adı>
```

---

## Belirli komut detayı

`$ARGUMENTS` bir komut adıysa, o komutun `.md` dosyasından özet çıkar:

```
/help build

/build — Spec'ten kod üretimi
  Aşamalar: plan → onay → kod yaz → ortam kur → test → commit
  Bütçe: 25k token
  Spec dosyası zorunlu (.factory/docs/modules/<modül>.md yoksa DUR)

  Örnek:
    /build user-profile-avatar
    /build auth-refresh-flow

  Detay: .claude/commands/build.md
```

---

## Sık sorulan sorular (FAQ)

`$ARGUMENTS = faq` ayrı mod:

```
FAQ

Q: Nereden başlayayım?
A: /onboard (mevcut proje) veya /design "modül adı" (yeni modül)

Q: Spec dosyası yazmak zorunda mıyım?
A: /build için evet. Spec olmayan build "tahmin" olur, istenmeyen özellik eklenir.

Q: Test yazıldı, compile hatası var — nasıl çözerim?
A: /test smoke ile compile durumunu gör. /build <modül> tekrar çalıştırıp düzelttirir.

Q: Bir dosya yanlış yere yazıldı — undo mümkün mü?
A: Git'ten geri al. Factory senin için commit etmez, kendin commit ettiysen revert.

Q: Factory güncellemesi geldi — ben özelleştirmiştim, ne olur?
A: factory update — kullanıcı değişikliğin .bak yedeklenir, yenisi gelir. Ayrıntı: factory status.

Q: Bir komutu kullanmak istemiyorum, nasıl devre dışı bırakırım?
A: .claude/commands/<komut>.md dosyasını sil. Sonraki update geri getirebilir, yine sil.

Q: Yeni bir skill eklemek istiyorum — nereye?
A: .factory/skills/third-party/<konu>.md — third-party klasörü update dokunmaz.

Q: Hook bozuldu, executable değil diyor?
A: chmod +x .claude/hooks/*.sh  VEYA  factory verify
```

---

## Klavye kısayolları (Claude Code built-in)

```
/                → komut listesi göster
/clear           → conversation temizle (yeni session)
Esc (iki kez)    → konuşmayı durdur
Ctrl+C           → aktif işlemi iptal et
```

---

## Yapmayın

- **Komutu "halüsine etme":** /help ile görmediğin bir komut yok.
- **Alias oluşturma:** Komutlar dosya bazlı, alias yok. /b → /build yok.
- **Argüman çeşitliliği bekleme:** Her komutun $ARGUMENTS'ı belgede net listelidir.
