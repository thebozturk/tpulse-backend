---
name: security-injection
keywords: "injection, NoSQL, ReDoS, SSRF, command injection, LDAP, XSS"
description: "Injection saldırıları — tespit ve önleme"
---

# Injection Attacks

## NoSQL Injection

### Operator injection
```typescript
// Client sends
{ "email": { "$ne": null }, "password": { "$ne": null } }

// ❌ Backend passes directly
const user = await userModel.findOne(req.body);
// → Returns first user (auth bypass)
```

**Önleme:**
- DTO + `forbidNonWhitelisted`
- Query whitelist
- Operator'ları kabul etme

```typescript
export class LoginDto {
  @IsEmail() email: string;      // Sadece string, operator değil
  @IsString() password: string;
}
```

### $where injection
```typescript
// ❌ YASAK
await userModel.find({ $where: req.query.filter });
```

User `'function() { while(true) {} }'` → DoS.
**Çözüm:** $where hiç kullanma.

### $regex injection
```typescript
// ❌
await userModel.find({ name: { $regex: req.query.q } });
```

User `.*` → tüm dokümanlar match.
User `(a+)+$` → ReDoS.

**Çözüm:** escape + length limit
```typescript
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (q.length > 50) throw new BadRequestException();
await model.find({ name: { $regex: escapeRegex(q), $options: 'i' } });
```

## SQL Injection (yaygın değil bizim için — MongoDB)

SQL yazıyorsan (başka DB):
- **Prepared statements / parameterized queries** zorunlu
- String concat ASLA (`"SELECT * FROM users WHERE email = '" + email + "'"` ❌)
- ORM kullan (TypeORM, Prisma)

## Command Injection

```typescript
// ❌ ÇOK TEHLİKELİ
import { exec } from 'child_process';
exec(`convert ${userInput}.jpg out.png`);
// User sends: "image; rm -rf /"
```

**Çözüm:** execFile + arguments array:
```typescript
import { execFile } from 'child_process';

execFile('convert', [userInput, 'out.png'], (err, stdout) => { ... });
// Arguments array shell interpret etmez
```

Security-gate BLOCK eder template string'li exec.

## SSRF (Server-Side Request Forgery)

User'dan URL al, backend ona istek at:
```typescript
// ❌ Yaygın: webhook URL, image import
await axios.get(req.body.imageUrl);
// User sends: http://169.254.169.254/metadata (AWS metadata)
// veya: http://localhost:6379/ (internal Redis)
```

**Savunma:**

### 1. URL parse + whitelist
```typescript
const url = new URL(input);
if (!['https:'].includes(url.protocol)) throw new BadRequestException();

const blockedHosts = ['localhost', '127.0.0.1', '169.254.169.254', '0.0.0.0', '::1'];
if (blockedHosts.includes(url.hostname)) throw new BadRequestException();

// Private IP range check
const dns = require('dns').promises;
const addresses = await dns.resolve4(url.hostname);
for (const addr of addresses) {
  if (isPrivateIP(addr)) throw new BadRequestException();
}
```

### 2. DNS rebinding önlemi
```typescript
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127
  );
}
```

### 3. Library kullan
```bash
pnpm add ssrf-req-filter
```

## LDAP Injection

LDAP kullanıyorsan:
```typescript
// ❌
const filter = `(&(uid=${username})(password=${password}))`;
// User username: admin)(&(uid=*
```

LDAP escape:
```typescript
function escapeLDAP(s: string): string {
  return s.replace(/[\\*()\x00]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}
```

## XSS (Stored)

Backend user input'u sakladığı için responsibility:
```typescript
// ❌ User posts: <script>alert('XSS')</script>
await postModel.create({ content: req.body.content });
// Frontend render ederse → XSS
```

**İki yaklaşım:**

### 1. Store sanitized (bizim tercih)
```typescript
import DOMPurify from 'isomorphic-dompurify';
content = DOMPurify.sanitize(content, { ALLOWED_TAGS: ['b', 'i', 'strong'] });
```

### 2. Store raw, escape on render (frontend responsibility)
Frontend React zaten escape eder default. Ama email/PDF vb. için backend sanitize tercih.

## Prototype Pollution

```typescript
// ❌ Object merge raw
Object.assign(target, req.body);
// User: { "__proto__": { "isAdmin": true } }
// → Her object'te isAdmin true
```

**Çözüm:** `lodash.merge` 2024+ versiyonu güvenli. Manual: `Object.create(null)` ile prototype'sız obje.

JSON.parse güvenli (proto inheritance yok default).

## XXE (XML)

XML parser kullanıyorsan:
```typescript
// ❌ External entity expansion
const parser = new DOMParser();
parser.parseFromString(userXml);
```

User: `<!DOCTYPE [<!ENTITY x SYSTEM "file:///etc/passwd">]>...` → local file read.

**Çözüm:** XML parser'da external entity kapat, DTD kapat. Veya JSON kullan (XML kullanma gerekmedikçe).

## Header Injection

```typescript
// ❌ User input response header'ına
res.setHeader('X-User', req.body.username);
// User: "alice\r\nSet-Cookie: hacked"
```

CRLF injection → response splitting. Modern Node.js koruyor ama dikkat.

## Template Injection

Template engine'de user input render:
```typescript
// ❌
const template = `Hello ${userInput}`;  // Handlebars/Jinja vs.
```

User: `{{constructor.constructor('alert(1)')()}}`

**Çözüm:** Sandbox template engine + user input **data olarak** geçir, template string'e değil.

## Anti-pattern özet

- `$where` / `$regex` user input
- Template string'li `exec()`
- URL hostname check yok
- `Object.assign` req.body ile
- Store-raw-render-unsafely cycle

## Aksiyon

1. DTO whitelist (operator injection stop)
2. Command: `execFile([args])` template değil
3. URL parse + hostname whitelist (SSRF)
4. Regex escape + length limit
5. LDAP escape (kullanıyorsan)
6. Store-time sanitize (DOMPurify)
7. XML yerine JSON (mümkünse)
8. Security-gate hook'u serbest bırak — inject pattern'ları BLOCK ediyor
