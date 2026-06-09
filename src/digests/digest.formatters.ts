import { Prisma } from '@prisma/client';

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  TRY: '₺',
};

/** "Stefan Savić" gibi tam ad. */
export function playerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOL[code?.toUpperCase()] ?? code;
}

/**
 * Transfer ücretini e-posta için okunabilir stringe çevirir.
 * 0 → "Bonservissiz", >=1M → "26M €", >=1K → "750K €", aksi → "500 €".
 */
export function formatFee(
  amount: Prisma.Decimal | number | null | undefined,
  currency: string,
): string {
  const value = amount == null ? 0 : Number(amount);
  if (!value || value <= 0) {
    return 'Bonservissiz';
  }
  const symbol = currencySymbol(currency);
  if (value >= 1_000_000) {
    return `${trim(value / 1_000_000)}M ${symbol}`;
  }
  if (value >= 1_000) {
    return `${trim(value / 1_000)}K ${symbol}`;
  }
  return `${trim(value)} ${symbol}`;
}

/** Gereksiz ".0" kuyruğunu atar (26.0 → "26", 26.5 → "26.5"). */
function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

/**
 * Global sıralamadan yüzdelik dilim (TOP %X) üretir.
 * rank=1, total=100 → 1; rank=50 → 50. 1..100 arası clamp.
 */
export function rankPercentile(rank: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.max(1, Math.ceil((rank / total) * 100)));
}
