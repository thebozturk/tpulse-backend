# Futbol verisini local Postgres'e yükleme

Paylaşılan dosya: **`tpulse-football-data.sql.gz`** (~7.8 MB, gzip).
İçerik: `league, position, team, player, player_statistic, transfers` tablolarının
**data-only** dökümü (80 lig, ~2.6K takım, ~37K oyuncu, ~41K istatistik, ~52K transfer).
Kullanıcı/post/yorum verisi YOK (sızıntı yok).

> Dosyayı Drive / WeTransfer / Slack ile paylaş — git'e eklenmez (`.gitignore`'da).

## Ön koşul (arkadaşların)

Şema güncel olmalı (yeni `player_statistic` tablosu + name-unique gevşetmesi):

```bash
git fetch && git checkout feat/all-leagues-ingestion
pnpm install
pnpm prisma migrate deploy     # veya: pnpm prisma migrate dev
```

## Yükleme

`DATABASE_URL` örneği: `postgresql://tpulse:tpulse@localhost:5432/transferpulse`

### A) Postgres host'ta erişilebilir (psql kurulu)

```bash
# (Önerilir) eski futbol verisini temizle — CASCADE post/news bağlarını da sıfırlar (dev için sorunsuz)
psql "$DATABASE_URL" -c 'TRUNCATE league, position, team, player, player_statistic, transfers RESTART IDENTITY CASCADE;'

# Yükle
gunzip -c tpulse-football-data.sql.gz | psql "$DATABASE_URL"
```

### B) Postgres Docker container'da (kendi compose'ları)

```bash
PGC=<postgres-container-adı>   # ör: tpulse-deploy-backend-postgres-1

docker exec -i "$PGC" psql -U tpulse -d transferpulse \
  -c 'TRUNCATE league, position, team, player, player_statistic, transfers RESTART IDENTITY CASCADE;'

gunzip -c tpulse-football-data.sql.gz | docker exec -i "$PGC" psql -U tpulse -d transferpulse
```

## Doğrulama

```bash
psql "$DATABASE_URL" -tAc "select 'league',count(*) from league
  union all select 'team',count(*) from team
  union all select 'player',count(*) from player
  union all select 'stat',count(*) from player_statistic
  union all select 'transfers',count(*) from transfers;"
# Beklenen: league=80, team=2575, player=37335, stat=41135, transfers=52489
```

## Notlar

- Dump `--disable-triggers` ile alındı → FK sırası önemli değil, temiz yüklenir (test edildi, 0 hata).
- Boş/yeni DB ise TRUNCATE adımını atlayabilirsin; mevcut futbol verisi varsa PK çakışmasını önlemek için TRUNCATE şart.
- Yeniden üretmek için (sen):
  ```bash
  docker exec tpulse-deploy-backend-postgres-1 pg_dump -U tpulse -d transferpulse \
    --data-only --disable-triggers \
    -t league -t position -t team -t player -t player_statistic -t transfers \
    | gzip > tpulse-football-data.sql.gz
  ```
