import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Para birimi çevrimi (docs/04). Karar: latest-rate + graceful fallback.
 * Para çiftine göre EN SON CurrencyRate ile çevirir; rate yoksa 1:1 (base kabul)
 * + warn. CurrencyRate tablosu boş olsa bile akış çalışır.
 */
@Injectable()
export class CurrencyConverter {
  private readonly logger = new Logger(CurrencyConverter.name);

  constructor(private readonly prisma: PrismaService) {}

  private async latestRate(from: string, to: string): Promise<number | null> {
    if (from === to) {
      return 1;
    }
    const rate = await this.prisma.currencyRate.findFirst({
      where: { currencyCode: from, baseCurrencyCode: to },
      orderBy: { rateDate: 'desc' },
    });
    return rate ? Number(rate.rate) : null;
  }

  /** Verilen para birimleri için base'e çevrim oranı haritası (eksikse 1:1 + warn). */
  async rateMap(
    currencies: string[],
    base: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const cur of new Set(currencies)) {
      const rate = await this.latestRate(cur, base);
      if (rate === null) {
        this.logger.warn(`Kur bulunamadı ${cur}->${base}, 1:1 kabul edildi`);
        map.set(cur, 1);
      } else {
        map.set(cur, rate);
      }
    }
    return map;
  }

  convertWith(
    amount: number,
    currency: string,
    map: Map<string, number>,
  ): number {
    return amount * (map.get(currency) ?? 1);
  }
}
