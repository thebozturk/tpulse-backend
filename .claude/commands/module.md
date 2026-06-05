# /module — Yeni NestJS Feature Modülü

$ARGUMENTS: Modül adı. Örn: `notifications`, `payments`, `audit-log`.

## Amaç

Boş bir feature modülü iskeleti oluştur: module + service + controller + DTO klasörü + test stub. İçi sonradan `/endpoint` veya `/build` ile doldurulur.

`/build` spec ister, kodu + ortamı + test'i üretir. `/module` sadece iskelet — henüz ne yapacağı belirsizse bununla başlarsın.

## Protocol

1. **İsim kontrolü** — Çakışma var mı
2. **Klasör yapısı** — feature-based
3. **Boş dosyalar** — TODO'lu template'ler
4. **Module register** — app.module.ts'e ekle
5. **Commit**

## Context Bütçesi: Max 8k token

---

## AŞAMA 1: İsim kontrolü

```bash
[ -d "src/modules/$ARGUMENTS" ] && echo "Modül zaten var"
```

Varsa DUR — `/endpoint` veya `/build` ile genişlet.

---

## AŞAMA 2: Klasör

```
src/modules/$ARGUMENTS/
├── $ARGUMENTS.module.ts
├── $ARGUMENTS.controller.ts    # boş route'lar
├── $ARGUMENTS.service.ts       # boş method'lar
├── dto/                         # boş klasör
├── schemas/                     # boş klasör (DB gerekiyorsa)
└── $ARGUMENTS.spec.ts          # boş test suite
```

---

## AŞAMA 3: Dosya içerikleri

### `$ARGUMENTS.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { <Pascal>Controller } from './<ARGUMENTS>.controller';
import { <Pascal>Service } from './<ARGUMENTS>.service';

@Module({
  imports: [],
  controllers: [<Pascal>Controller],
  providers: [<Pascal>Service],
  exports: [<Pascal>Service],
})
export class <Pascal>Module {}
```

### `$ARGUMENTS.controller.ts`
```typescript
import { Controller } from '@nestjs/common';
import { <Pascal>Service } from './<ARGUMENTS>.service';

@Controller('<kebab>')
export class <Pascal>Controller {
  constructor(private readonly service: <Pascal>Service) {}

  // TODO: /endpoint ile metodları ekle
}
```

### `$ARGUMENTS.service.ts`
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class <Pascal>Service {
  private readonly logger = new Logger(<Pascal>Service.name);

  // TODO: business logic
}
```

### `$ARGUMENTS.spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { <Pascal>Service } from './<ARGUMENTS>.service';

describe('<Pascal>Service', () => {
  let service: <Pascal>Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [<Pascal>Service],
    }).compile();

    service = module.get<<Pascal>Service>(<Pascal>Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: test case'ler
});
```

---

## AŞAMA 4: app.module.ts register

```typescript
// src/app.module.ts
import { <Pascal>Module } from './modules/<ARGUMENTS>/<ARGUMENTS>.module';

@Module({
  imports: [
    // ...
    <Pascal>Module,  // ← ekle
  ],
})
```

---

## AŞAMA 5: Doğrula + Commit

```bash
pnpm tsc --noEmit
pnpm test -- $ARGUMENTS.spec.ts    # should be defined ✓

git add src/modules/$ARGUMENTS/ src/app.module.ts
git commit -m "feat($ARGUMENTS): scaffold module"
```

---

## Yönlendirme

```
✓ Modül iskeleti hazır: $ARGUMENTS

Sonraki adım:
  - /design "$ARGUMENTS" — spec oluştur (büyük iş ise)
  - /endpoint — direkt endpoint ekle (küçük iş ise)
  - /build $ARGUMENTS — spec varsa tam implementation
```

---

## YAPMA

- **İçi dolu template yazma.** Boş iskelet — kullanıcı ne yapacağını karar versin.
- **Module adını dayatma.** `$ARGUMENTS` verilir, convert et (kebab-case → PascalCase).
- **Schema klasörü otomatik oluştur.** DB gerekmeyen modül de var — kullanıcı sonradan ekler.
- **Test'te başka bir şey yaz.** Sadece "defined" kontrolü yeterli — /build detaylandırır.
