---
name: performance-compression
keywords: "compression, gzip, brotli, response, payload"
description: "Response compression — gzip, brotli"
---

# Compression

## Setup

```bash
pnpm add compression
pnpm add -D @types/compression
```

```typescript
// main.ts
import * as compression from 'compression';

app.use(compression({
  threshold: 1024,  // 1KB altı sıkıştırma
  level: 6,         // 1-9, 6 default (balance)
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
```

JSON ~70% küçülür. Network savings büyük.

## Brotli

Brotli daha iyi compression (gzip'ten 15-25% küçük). Browser destek 95%+.

```bash
pnpm add shrink-ray-current
```

```typescript
import * as shrinkRay from 'shrink-ray-current';
app.use(shrinkRay());
// Auto: brotli > gzip > none
```

## CDN tarafında

Cloudflare, Fastly compression yapar — backend'de gerek olmayabilir. Test:
```bash
curl -H "Accept-Encoding: br, gzip" -I https://api.acme.com/data
# Content-Encoding: br
```

CDN handle ediyorsa backend'de double-compression yok.

## Trade-off

CPU ↔ network. Mobile/slow network için worth. Datacenter internal traffic için CPU israfı olabilir.

## Aksiyon

- compression middleware kur
- Threshold 1KB
- CDN kontrol — duplicate ise kapat
