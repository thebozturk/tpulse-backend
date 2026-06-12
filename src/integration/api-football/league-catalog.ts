/**
 * Curated lig kataloğu — sync'in çekeceği API-Football lig/kupa external ID'leri.
 *
 * Neden env değil? 78 girişlik liste env string'ine sığmaz ve review edilemez.
 * `API_FOOTBALL_LEAGUE_IDS` env'i opsiyonel override olarak kalır (boşsa bu liste).
 *
 * Sezon BURADA tutulmaz — her ligin "current" sezonu çalışma anında
 * `/leagues` cevabındaki `seasons[].current` flag'inden türetilir
 * (Avrupa → 2025, takvim-yılı ligleri → 2026 vb.). Bkz. getCurrentSeasons().
 *
 * Liste canlı /leagues verisinden üretildi; U-yaş / kadın / qualification /
 * alt seriler hariç tutuldu. Yeni lig eklemek için external ID'yi buraya ekle.
 */

export type CatalogKind = 'league' | 'cup';

export interface CatalogEntry {
  /** API-Football league.id */
  externalId: number;
  /** Sadece okunabilirlik/dokümantasyon için; sync mantığı kullanmaz. */
  label: string;
  kind: CatalogKind;
}

export const LEAGUE_CATALOG: readonly CatalogEntry[] = [
  // ─── Uluslararası / kıtasal ────────────────────────────────────────
  { externalId: 2, label: 'UEFA Champions League', kind: 'cup' },
  { externalId: 3, label: 'UEFA Europa League', kind: 'cup' },
  { externalId: 848, label: 'UEFA Europa Conference League', kind: 'cup' },
  { externalId: 5, label: 'UEFA Nations League', kind: 'cup' },
  { externalId: 4, label: 'Euro Championship', kind: 'cup' },
  { externalId: 1, label: 'World Cup', kind: 'cup' },
  { externalId: 15, label: 'FIFA Club World Cup', kind: 'cup' },
  { externalId: 13, label: 'CONMEBOL Libertadores', kind: 'cup' },
  { externalId: 11, label: 'CONMEBOL Sudamericana', kind: 'cup' },
  { externalId: 541, label: 'CONMEBOL Recopa', kind: 'cup' },
  { externalId: 6, label: 'Africa Cup of Nations', kind: 'cup' },
  { externalId: 7, label: 'Asian Cup', kind: 'cup' },

  // ─── Türkiye (ilk 3 lig + kupalar) ─────────────────────────────────
  { externalId: 203, label: 'Turkey — Süper Lig', kind: 'league' },
  { externalId: 204, label: 'Turkey — 1. Lig', kind: 'league' },
  { externalId: 205, label: 'Turkey — 2. Lig', kind: 'league' },
  { externalId: 206, label: 'Turkey — Türkiye Kupası', kind: 'cup' },
  { externalId: 551, label: 'Turkey — Super Cup', kind: 'cup' },

  // ─── İngiltere ─────────────────────────────────────────────────────
  { externalId: 39, label: 'England — Premier League', kind: 'league' },
  { externalId: 40, label: 'England — Championship', kind: 'league' },
  { externalId: 45, label: 'England — FA Cup', kind: 'cup' },
  { externalId: 48, label: 'England — League Cup', kind: 'cup' },

  // ─── İspanya ───────────────────────────────────────────────────────
  { externalId: 140, label: 'Spain — La Liga', kind: 'league' },
  { externalId: 141, label: 'Spain — Segunda División', kind: 'league' },
  { externalId: 143, label: 'Spain — Copa del Rey', kind: 'cup' },

  // ─── İtalya ────────────────────────────────────────────────────────
  { externalId: 135, label: 'Italy — Serie A', kind: 'league' },
  { externalId: 136, label: 'Italy — Serie B', kind: 'league' },
  { externalId: 137, label: 'Italy — Coppa Italia', kind: 'cup' },

  // ─── Almanya ───────────────────────────────────────────────────────
  { externalId: 78, label: 'Germany — Bundesliga', kind: 'league' },
  { externalId: 79, label: 'Germany — 2. Bundesliga', kind: 'league' },
  { externalId: 81, label: 'Germany — DFB Pokal', kind: 'cup' },

  // ─── Fransa ────────────────────────────────────────────────────────
  { externalId: 61, label: 'France — Ligue 1', kind: 'league' },
  { externalId: 62, label: 'France — Ligue 2', kind: 'league' },
  { externalId: 66, label: 'France — Coupe de France', kind: 'cup' },

  // ─── Diğer Avrupa (üst lig) ────────────────────────────────────────
  { externalId: 88, label: 'Netherlands — Eredivisie', kind: 'league' },
  { externalId: 89, label: 'Netherlands — Eerste Divisie', kind: 'league' },
  { externalId: 90, label: 'Netherlands — KNVB Beker', kind: 'cup' },
  { externalId: 94, label: 'Portugal — Primeira Liga', kind: 'league' },
  { externalId: 96, label: 'Portugal — Taça de Portugal', kind: 'cup' },
  { externalId: 144, label: 'Belgium — Jupiler Pro League', kind: 'league' },
  { externalId: 179, label: 'Scotland — Premiership', kind: 'league' },
  { externalId: 207, label: 'Switzerland — Super League', kind: 'league' },
  { externalId: 218, label: 'Austria — Bundesliga', kind: 'league' },
  { externalId: 197, label: 'Greece — Super League 1', kind: 'league' },
  { externalId: 106, label: 'Poland — Ekstraklasa', kind: 'league' },
  { externalId: 345, label: 'Czech Republic — Czech Liga', kind: 'league' },
  { externalId: 210, label: 'Croatia — HNL', kind: 'league' },
  { externalId: 286, label: 'Serbia — Super Liga', kind: 'league' },
  { externalId: 283, label: 'Romania — Liga I', kind: 'league' },
  { externalId: 271, label: 'Hungary — NB I', kind: 'league' },
  { externalId: 172, label: 'Bulgaria — First League', kind: 'league' },
  { externalId: 119, label: 'Denmark — Superliga', kind: 'league' },
  { externalId: 103, label: 'Norway — Eliteserien', kind: 'league' },
  { externalId: 113, label: 'Sweden — Allsvenskan', kind: 'league' },
  { externalId: 235, label: 'Russia — Premier League', kind: 'league' },
  { externalId: 333, label: 'Ukraine — Premier League', kind: 'league' },

  // ─── Amerika ───────────────────────────────────────────────────────
  { externalId: 71, label: 'Brazil — Serie A', kind: 'league' },
  { externalId: 72, label: 'Brazil — Serie B', kind: 'league' },
  { externalId: 128, label: 'Argentina — Liga Profesional', kind: 'league' },
  { externalId: 129, label: 'Argentina — Primera Nacional', kind: 'league' },
  { externalId: 130, label: 'Argentina — Copa Argentina', kind: 'cup' },
  { externalId: 253, label: 'USA — Major League Soccer', kind: 'league' },
  { externalId: 262, label: 'Mexico — Liga MX', kind: 'league' },
  { externalId: 265, label: 'Chile — Primera División', kind: 'league' },
  { externalId: 239, label: 'Colombia — Primera A', kind: 'league' },
  { externalId: 268, label: 'Uruguay — Primera División', kind: 'league' },
  { externalId: 250, label: 'Paraguay — Division Profesional', kind: 'league' },
  { externalId: 242, label: 'Ecuador — Liga Pro', kind: 'league' },

  // ─── Asya / Afrika / Okyanusya ─────────────────────────────────────
  { externalId: 98, label: 'Japan — J1 League', kind: 'league' },
  { externalId: 292, label: 'South Korea — K League 1', kind: 'league' },
  { externalId: 169, label: 'China — Super League', kind: 'league' },
  { externalId: 307, label: 'Saudi Arabia — Pro League', kind: 'league' },
  { externalId: 305, label: 'Qatar — Stars League', kind: 'league' },
  { externalId: 301, label: 'UAE — Pro League', kind: 'league' },
  { externalId: 188, label: 'Australia — A-League', kind: 'league' },
  { externalId: 233, label: 'Egypt — Premier League', kind: 'league' },
  { externalId: 200, label: 'Morocco — Botola Pro', kind: 'league' },
  { externalId: 186, label: 'Algeria — Ligue 1', kind: 'league' },
  { externalId: 202, label: 'Tunisia — Ligue 1', kind: 'league' },
  {
    externalId: 288,
    label: 'South Africa — Premier Soccer League',
    kind: 'league',
  },
  { externalId: 399, label: 'Nigeria — NPFL', kind: 'league' },
];

/** Sadece external ID listesi (override yokken sync girişi). */
export const CATALOG_LEAGUE_IDS: readonly number[] = LEAGUE_CATALOG.map(
  (e) => e.externalId,
);
