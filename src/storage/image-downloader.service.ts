import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

/** SSRF korumalı görsel indirici (docs/04): private/loopback IP bloke, content-type + boyut + redirect sınırı. */
@Injectable()
export class ImageDownloaderService {
  async download(url: string): Promise<Buffer> {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = this.parse(current);
      await this.assertPublicHost(parsed.hostname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(current, {
          redirect: 'manual',
          signal: controller.signal,
        });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) {
            throw new BadRequestException('Geçersiz yönlendirme');
          }
          current = new URL(loc, current).toString();
          continue;
        }
        if (!res.ok) {
          throw new BadRequestException(`İndirme başarısız (${res.status})`);
        }
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) {
          throw new BadRequestException('İçerik bir görsel değil');
        }
        const declared = Number(res.headers.get('content-length') ?? 0);
        if (declared > MAX_BYTES) {
          throw new BadRequestException('Görsel çok büyük');
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) {
          throw new BadRequestException('Görsel çok büyük');
        }
        return buf;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new BadRequestException('Çok fazla yönlendirme');
  }

  private parse(url: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Geçersiz URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Sadece http/https');
    }
    return parsed;
  }

  private async assertPublicHost(hostname: string): Promise<void> {
    const records = await lookup(hostname, { all: true }).catch(() => {
      throw new BadRequestException('Host çözümlenemedi');
    });
    for (const { address } of records) {
      if (this.isBlocked(address)) {
        throw new BadRequestException('Özel/iç ağ adresi engellendi');
      }
    }
  }

  private isBlocked(ip: string): boolean {
    if (ip.includes(':')) {
      // IPv6: loopback, link-local, unique-local
      const lower = ip.toLowerCase();
      return (
        lower === '::1' ||
        lower.startsWith('fe80') ||
        lower.startsWith('fc') ||
        lower.startsWith('fd')
      );
    }
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) {
      return true;
    }
    const [a, b] = p;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
}
