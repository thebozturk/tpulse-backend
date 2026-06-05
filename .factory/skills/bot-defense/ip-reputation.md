---
name: bot-defense-ip-reputation
keywords: "IP, reputation, abuseipdb, proxy, vpn, tor, datacenter"
description: "IP reputation check — VPN/Tor/datacenter detection"
---

# IP Reputation

## Risk faktörleri

| Risk | Açıklama |
|------|----------|
| **Datacenter IP** | AWS, Hetzner, DigitalOcean — gerçek user değil, bot/scraper |
| **VPN** | Anonimleştirme — şüpheli ama legit user da kullanır |
| **Tor exit node** | Anonimite — yüksek risk |
| **Known bot UA** | Bilinen scraper/crawler |
| **Abuse history** | Önceki saldırı kaydı |
| **Rapid requests** | Bot velocity |

## Provider seçenekleri

### AbuseIPDB
```bash
# Free: 1k/day
```

```typescript
@Injectable()
export class IpReputationService {
  async check(ip: string): Promise<{ score: number; reports: number }> {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
      {
        headers: {
          Key: this.config.getOrThrow('ABUSEIPDB_KEY'),
          Accept: 'application/json',
        },
      },
    );
    const { data } = await res.json();
    return {
      score: data.abuseConfidenceScore,  // 0-100
      reports: data.totalReports,
    };
  }
}
```

### IPQualityScore
Daha kapsamlı: VPN/proxy/Tor/datacenter detection. Paid.

### MaxMind GeoIP2 (offline)
```bash
pnpm add maxmind
```
DB indir, local lookup. Datacenter ASN check.

### Cloudflare Workers
Edge-level. Suspicious IP'leri 403'le erkenden block. Backend'e ulaşmaz.

## Cache zorunlu

API call her request'te = pahalı + rate limit. Redis cache:
```typescript
async getReputation(ip: string): Promise<number> {
  const cached = await this.redis.get(`ipreputation:${ip}`);
  if (cached) return parseFloat(cached);

  const { score } = await this.abuseIpService.check(ip);
  await this.redis.set(`ipreputation:${ip}`, score, 'EX', 24 * 3600); // 24h
  return score;
}
```

## Datacenter IP detection

ASN (Autonomous System Number) check:
```typescript
// MaxMind GeoLite2 ASN database
import { Reader } from 'maxmind';

const lookup = await Reader.open<AsnResponse>('./GeoLite2-ASN.mmdb');
const result = lookup.get('1.2.3.4');

const datacenterAsns = [
  16509, // AWS
  14061, // DigitalOcean
  24940, // Hetzner
  63949, // Linode
  20473, // Vultr
];

const isDatacenter = result && datacenterAsns.includes(result.autonomous_system_number);
```

## VPN / Tor detection

Tor exit node listesi:
```bash
curl https://check.torproject.org/exit-addresses
```

Daily refresh, Redis set'e kaydet:
```typescript
async refreshTorList() {
  const res = await fetch('https://check.torproject.org/exit-addresses');
  const text = await res.text();
  const ips = text.match(/ExitAddress (\S+)/g)?.map(l => l.split(' ')[1]) || [];

  await this.redis.del('tor-exit-nodes');
  if (ips.length) await this.redis.sadd('tor-exit-nodes', ...ips);
  await this.redis.expire('tor-exit-nodes', 24 * 3600);
}

async isTor(ip: string): Promise<boolean> {
  return (await this.redis.sismember('tor-exit-nodes', ip)) === 1;
}
```

## Adaptive policy

Tek başına IP reputation reject etme — false positive yüksek (corporate proxy, mobile carrier NAT, family VPN).

```typescript
async getRiskScore(ip: string): Promise<number> {
  let score = 0;

  if (await this.isTor(ip)) score += 0.5;
  if (await this.isDatacenter(ip)) score += 0.3;
  if (await this.isVpn(ip)) score += 0.2;
  const abuseScore = await this.getReputation(ip);
  score += abuseScore / 100 * 0.5;

  return Math.min(score, 1);
}

// Risk score → action
if (score > 0.8) requireCaptcha();
if (score > 0.6) requireEmail2fa();
if (score > 0.3) requireFingerprint();
// Default: allow
```

## Allowlist

Kurumsal müşteri proxy IP'si false positive verirse:
```typescript
@Prop({ type: [String], default: [] })
ipAllowlist: string[];

// User profil'inde "trust this network" tıklar
async addTrustedIp(userId: string, ip: string) {
  await this.userModel.updateOne({ _id: userId }, { $addToSet: { ipAllowlist: ip } });
}
```

## CIDR range

Tek IP yerine range:
```typescript
import { isInSubnet } from 'is-in-subnet';

const corporateIps = ['10.0.0.0/8', '172.16.0.0/12'];
const isCorporate = corporateIps.some(cidr => isInSubnet(ip, cidr));
```

## Geo-blocking

Bazı ülkelerden tam block (sanctions, compliance):
```typescript
import { Reader } from 'maxmind';

const cityLookup = await Reader.open('./GeoLite2-City.mmdb');
const result = cityLookup.get(ip);
const country = result?.country?.iso_code;

const blockedCountries = ['XX', 'YY']; // sanctions list
if (blockedCountries.includes(country)) {
  throw new ForbiddenException('Service not available in your region');
}
```

**Dikkat:** GDPR, kullanıcıya bildirim. Erişim reddediliyorsa neden açık olmalı.

## True client IP

CDN/proxy arkasında `req.ip` proxy IP. Gerçek IP `X-Forwarded-For` veya `CF-Connecting-IP`:

```typescript
// main.ts
app.set('trust proxy', 1);  // CDN sayısı

// Cloudflare özel header
const realIp = req.headers['cf-connecting-ip'] || req.ip;
```

## Anti-pattern'ler

### Sadece IP block
```typescript
if (await this.isTor(ip)) throw new ForbiddenException();
```
Tor user her zaman attacker değil. Risk score'a feed et, hard block etme.

### Cache yok
```typescript
// ❌ Her request'te 200ms API call
await this.abuseIpdb.check(ip);
```

### IP'yi kullanıcı kimliği gibi kullan
```typescript
// ❌ Aynı IP'den iki user → "aynı kişi"
```
Mobile carrier NAT'ta milyonlarca user aynı IP.

### Trust proxy yanlış
```typescript
app.set('trust proxy', true);  // ❌ X-Forwarded-For spoofable
```
Sadece trust ettiğin proxy sayısı veya IP.

### Geo-block bilgisi olmadan
```typescript
throw new ForbiddenException();  // user neden olduğunu bilmiyor
```

## Aksiyon

1. Datacenter ASN detection (MaxMind, offline)
2. Tor exit node listesi (daily refresh)
3. AbuseIPDB integration (cached 24h)
4. Risk score combine (IP rep + datacenter + VPN + abuse history)
5. Adaptive challenge based on score
6. trust proxy doğru CDN sayısı ile
7. CIDR allowlist (kurumsal kullanıcı)
8. Geo-block (compliance gerekiyorsa)
