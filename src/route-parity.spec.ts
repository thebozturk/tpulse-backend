import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Route-parite testi (docs/00 §7). App boot / DB YOK.
 * - Tüm controller'lardan reflection ile registered route'ları toplar.
 * - docs/02'nin satır-başına-method tablolarını parse eder (kanonik kaynak).
 * - docs/02'nin sıkıştırılmış "Görsel Controller'ları" tablosu (satır 269-277)
 *   makine-parse edilmez → IMAGE_ENDPOINTS ile explicit eklenir.
 * - İki yönlü diff: eksik uç YOK + beklenmeyen extra YOK (whitelist hariç).
 */

const METHOD_NAME: Record<number, string> = {
  0: 'GET',
  1: 'POST',
  2: 'PUT',
  3: 'DELETE',
  4: 'PATCH',
  5: 'ALL',
  6: 'OPTIONS',
  7: 'HEAD',
};

// docs/02 satır 269-277: her görsel controller'ı POST/PUT/DELETE /image + POST /image/from-url
const IMAGE_ENDPOINTS = ['leagues', 'teams', 'players', 'news'].flatMap((e) => [
  `POST /api/admin/${e}/:p/image`,
  `PUT /api/admin/${e}/:p/image`,
  `DELETE /api/admin/${e}/:p/image`,
  `POST /api/admin/${e}/:p/image/from-url`,
]);

// API sözleşmesi dışı, kasıtlı ops uçları (docs/02'de listelenmez)
// Back office (BO) uçları .NET parity sözleşmesinin dışındadır — kasıtlı eklenir.
const ALLOWED_EXTRA = new Set([
  'GET /health',
  'GET /api/admin/dashboard/overview', // faz-bo-1
  // faz-bo-2 — kullanıcı yönetimi
  'GET /api/admin/users',
  'GET /api/admin/users/:p',
  'GET /api/admin/users/:p/content',
  'PATCH /api/admin/users/:p/status',
  'PATCH /api/admin/users/:p/role',
  'PATCH /api/admin/users/:p/reputation',
  // faz-bo-3 — moderasyon + şikayet
  'DELETE /api/admin/posts/:p',
  'DELETE /api/admin/comments/:p',
  'DELETE /api/admin/transfer-comments/:p',
  'GET /api/admin/posts',
  'GET /api/admin/comments',
  'POST /api/reports',
  'GET /api/admin/reports',
  'PATCH /api/admin/reports/:p',
]);

// docs/02 "Sıralama Notları": kesinlikle korunması gereken bot uçları
const BOT_CRITICAL = [
  'POST /api/rumours',
  'POST /api/admin/transfers',
  'GET /api/search',
  'GET /api/players/search',
  'POST /api/auth/login',
];

function norm(route: string): string {
  let r = route.split('?')[0].trim();
  if (!r.startsWith('/')) r = '/' + r;
  r = r.replace(/\{[^}]+\}/g, ':p').replace(/:[^/]+/g, ':p');
  if (r.length > 1) r = r.replace(/\/+$/, '');
  return r;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.controller.ts') && !e.name.endsWith('.spec.ts'))
      out.push(p);
  }
  return out;
}

function collectRegistered(): Set<string> {
  const srcDir = path.resolve(__dirname, '..', 'src');
  const registered = new Set<string>();
  for (const file of walk(srcDir)) {
    // Runtime'da keşfedilen controller dosyaları → dinamik require zorunlu.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(file) as Record<string, unknown>;
    for (const exp of Object.values(mod)) {
      if (typeof exp !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, exp);
      if (base === undefined) continue;
      const proto = (exp as { prototype: object }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        const fn = (proto as Record<string, unknown>)[name];
        const sub = Reflect.getMetadata(PATH_METADATA, fn as object);
        const method = Reflect.getMetadata(METHOD_METADATA, fn as object);
        if (sub === undefined || method === undefined) continue;
        const full = norm(
          '/' + [base, sub].filter((s) => s && s !== '/').join('/'),
        );
        registered.add(`${METHOD_NAME[method as number]} ${full}`);
      }
    }
  }
  return registered;
}

function parseExpected(): Set<string> {
  const docsDir = path.resolve(__dirname, '..', 'docs');
  const file = fs.readdirSync(docsDir).find((f) => f.startsWith('02'))!;
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
  const expected = new Set<string>(IMAGE_ENDPOINTS);
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/);
    if (m) expected.add(`${m[1]} ${norm(m[2])}`);
  }
  return expected;
}

describe('Route parity (docs/02)', () => {
  const registered = collectRegistered();
  const expected = parseExpected();

  it('docs/02 uçlarının tamamı implement edilmiş (eksik uç yok)', () => {
    const missing = [...expected].filter((e) => !registered.has(e)).sort();
    expect(missing).toEqual([]);
  });

  it('beklenmeyen extra route yok (whitelist hariç)', () => {
    const extra = [...registered]
      .filter((r) => !expected.has(r) && !ALLOWED_EXTRA.has(r))
      .sort();
    expect(extra).toEqual([]);
  });

  it('bot-kritik uçlar kayıtlı (sözleşme korunur)', () => {
    for (const ep of BOT_CRITICAL) {
      const key = `${ep.split(' ')[0]} ${norm(ep.split(' ')[1])}`;
      expect(registered.has(key)).toBe(true);
    }
  });

  it('en az docs/02 baz kapsamı kadar uç var', () => {
    expect(expected.size).toBeGreaterThanOrEqual(140);
    expect(registered.size).toBeGreaterThanOrEqual(expected.size);
  });
});
