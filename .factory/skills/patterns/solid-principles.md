---
name: solid-principles
keywords: "SOLID, SRP, OCP, LSP, ISP, DIP, principle, ilke, single responsibility"
description: "SOLID prensipleri — somut örnekler, ihlaller, refactor"
---

# SOLID Principles

Beş prensip — her sınıfa, her dosyaya, her commit'e uygulanır.

## SRP — Single Responsibility Principle

**Bir sınıfın değişmek için tek bir nedeni olmalı.**

### Pratik test

> "Bu dosyayı niye değiştiririm?" sorusunun cevabı tek mi?

Eğer cevap "X eklemek için VEYA Y'yi düzeltmek için" şeklindeyse — iki sebep var, böl.

### İhlal

```typescript
class UserService {
  // Reason 1: business logic değişikliği
  async createUser(data: CreateUserDto) {
    const user = await this.repo.create(data);

    // Reason 2: email format değişikliği
    const html = `<h1>Hoş geldin ${user.name}</h1>...`;
    await this.smtp.send(user.email, "Hoş geldin", html);

    // Reason 3: analytics event format değişikliği
    await this.mixpanel.track("user.created", { userId: user.id });

    return user;
  }
}
```

3 sebep değişikliğe yol açıyor: business kuralı, email template, analytics event. Üçü ayrı.

### Doğru

```typescript
class UserService {
  constructor(
    private repo: IUserRepository,
    private events: IEventBus,
  ) {}

  async createUser(data: CreateUserDto) {
    const user = await this.repo.create(data);
    await this.events.emit("user.created", { userId: user.id, email: user.email });
    return user;
  }
}

// Listener'lar ayrı, her biri tek sorumluluk
class WelcomeEmailListener {
  async handle(event: { email: string; name: string }) { /* email gönder */ }
}

class AnalyticsListener {
  async handle(event: { userId: string }) { /* track */ }
}
```

UserService sadece business kuralı bilir. Email değişirse listener değişir, analytics değişirse listener değişir.

---

## OCP — Open/Closed Principle

**Yeni davranış eklemek için açık, mevcut kodu değiştirmek için kapalı.**

### Pratik test

> Yeni bir özellik geldiğinde, mevcut bir dosyayı **açıp düzenliyorsam** — OCP ihlali. Yeni dosya **eklemekle** yetinebiliyorsam — OCP korunmuş.

### İhlal

```typescript
// Yeni payment method eklemek için bu dosya her seferinde değişiyor
function processPayment(method: string, amount: number) {
  if (method === "credit_card") {
    return stripe.charge(amount);
  } else if (method === "paypal") {
    return paypal.charge(amount);
  } else if (method === "crypto") {        // ← YENİ EKLEME
    return coinbase.charge(amount);
  }
  throw new Error("Unknown method");
}
```

Her yeni method = mevcut fonksiyonu değiştir + test'leri kır.

### Doğru — Strategy + Factory

```typescript
interface IPaymentStrategy {
  charge(amount: number): Promise<PaymentResult>;
}

class StripeStrategy implements IPaymentStrategy { /* ... */ }
class PayPalStrategy implements IPaymentStrategy { /* ... */ }
class CryptoStrategy implements IPaymentStrategy { /* ... */ }   // ← YENİ DOSYA

class PaymentFactory {
  constructor(
    private stripe: StripeStrategy,
    private paypal: PayPalStrategy,
    private crypto: CryptoStrategy,
  ) {}

  create(method: string): IPaymentStrategy {
    const strategies: Record<string, IPaymentStrategy> = {
      credit_card: this.stripe,
      paypal: this.paypal,
      crypto: this.crypto,         // ← TEK SATIR EKLEME
    };
    const strategy = strategies[method];
    if (!strategy) throw new ValidationError(`Unknown method: ${method}`);
    return strategy;
  }
}
```

Yeni method = yeni dosya + factory'ye 1 satır. Mevcut Stripe/PayPal kodu değişmez.

---

## LSP — Liskov Substitution Principle

**Subclass, superclass'ın yerine geçebilmeli — sözleşmeyi bozmadan.**

### Pratik test

> Interface'in döndüğü tip, beklenmeyen bir şey atıyorsa — LSP ihlali.

### İhlal

```typescript
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
}

class CachedUserRepository implements IRepository<User> {
  async findById(id: string): Promise<User | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    if (!this.online) {
      throw new Error("Cache miss + offline");      // ← İhlal: interface "throw" demiyor
    }
    return this.delegate.findById(id);
  }
}
```

Interface "ya null ya entity" der. Implementation throw atıyor. Caller throw beklemiyor → crash.

### Doğru

```typescript
class CachedUserRepository implements IRepository<User> {
  async findById(id: string): Promise<User | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    if (!this.online) {
      this.logger.warn("Cache miss + offline", { id });
      return null;            // sözleşmeye uyuyor
    }
    return this.delegate.findById(id);
  }
}
```

Throw etmek istiyorsan interface'i değiştir: `findById(id): Promise<Result<User | null, OfflineError>>`.

---

## ISP — Interface Segregation Principle

**Bir client, kullanmadığı method'lara bağımlı olmamalı.**

### İhlal

```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
  bulkInsert(users: User[]): Promise<void>;
  exportToCSV(): Promise<string>;
  reindexSearch(): Promise<void>;
}

class AuthService {
  constructor(private repo: IUserRepository) {}   // sadece findByEmail'e ihtiyaç var
  // Ama mock yazmak için 8 method'u stub'lamak zorunda
}
```

### Doğru — küçük, odaklı interface'ler

```typescript
interface IUserReader {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

interface IUserWriter {
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}

interface IUserBulkOps {
  bulkInsert(users: User[]): Promise<void>;
  exportToCSV(): Promise<string>;
}

interface IUserSearchOps {
  reindexSearch(): Promise<void>;
}

// Implementation hepsini sağlar
class UserRepository implements IUserReader, IUserWriter, IUserBulkOps, IUserSearchOps {
  /* ... */
}

// Client sadece ihtiyacı olanı bilir
class AuthService {
  constructor(private users: IUserReader) {}     // sadece read
}
```

Mock yazmak: 2 method stub yeter, 8 değil.

---

## DIP — Dependency Inversion Principle

**Yüksek seviye modüller, düşük seviye modüllere bağımlı olmamalı. İkisi de soyutlamaya bağımlı olmalı.**

### İhlal

```typescript
import { PrismaClient } from "@prisma/client";

class UserService {
  private prisma = new PrismaClient();      // ← somut implementasyona bağımlı

  async findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

UserService **PostgreSQL'e** bağımlı oldu. MongoDB'ye geçmek = UserService'i yeniden yazmak.

### Doğru

```typescript
// Soyutlama (interface)
interface IUserRepository {
  findById(id: string): Promise<User | null>;
}

// Yüksek seviye modül — soyutlamaya bağımlı
class UserService {
  constructor(private users: IUserRepository) {}   // ← interface

  async findUser(id: string) {
    return this.users.findById(id);
  }
}

// Düşük seviye modül — soyutlamaya bağımlı
class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

// DI container birleştirir
const prisma = new PrismaClient();
const repo: IUserRepository = new PrismaUserRepository(prisma);
const service = new UserService(repo);
```

Yarın MongoDB → `MongoUserRepository implements IUserRepository`. UserService değişmez.

---

## Pratik karar

Her commit'te 5 sorudan geç:

1. **SRP**: Bu sınıf değişmek için tek bir sebebe sahip mi?
2. **OCP**: Yeni özellik eklemek için **mevcut** dosyaları açtım mı?
3. **LSP**: Interface implementasyonu beklenmeyen bir şey atıyor mu?
4. **ISP**: Client kullanmadığı method'lara bağımlı mı?
5. **DIP**: Somut sınıfa mı, interface'e mi bağımlıyım?

Bir cevap "evet, ihlal" ise — refactor zamanı. `architecture-reviewer` agent'ı bu kontrolleri otomatik yapar.

## Yapma

- SOLID'i dini metin gibi okumak — pragmatik uygula, prototype'ta abart, production'da disiplinle
- Her sınıfa interface yazmak — sadece **birden fazla implementasyon ihtimali** veya **test mock gereksinimi** varsa
- "OCP için" 5 katman soyutlama açmak — gereksiz kompleksite, gerçek değişim noktasında soyutlamaya geç
- DIP'i ezberlemek — "high-level → abstraction" değil, **çağıran → ihtiyacı olduğu sözleşme**
