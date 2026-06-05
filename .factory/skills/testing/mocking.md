---
name: testing-mocking
keywords: "mock, jest, spy, stub, fake"
description: "Mocking stratejileri"
---

# Mocking

## Jest mock tipleri

### jest.fn()
```typescript
const callback = jest.fn();
callback.mockReturnValue(42);
callback.mockResolvedValue('async');
callback.mockImplementation((x) => x * 2);

expect(callback).toHaveBeenCalledWith('arg');
expect(callback).toHaveBeenCalledTimes(2);
```

### jest.spyOn()
Mevcut metodu mock, orijinal erişilebilir:
```typescript
const spy = jest.spyOn(service, 'method').mockReturnValue(42);
// Test sonrası
spy.mockRestore();  // orijinale döner
```

### jest.mock() (module mock)
```typescript
jest.mock('axios');
import axios from 'axios';

(axios.get as jest.Mock).mockResolvedValue({ data: {...} });
```

## External service mock

### HTTP (axios, fetch)
MSW (Mock Service Worker):
```bash
pnpm add -D msw
```

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('https://api.stripe.com/v1/charges', () => {
    return HttpResponse.json({ id: 'ch_123', status: 'succeeded' });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Real HTTP catch, mock response dön.

### Time mock
```typescript
jest.useFakeTimers();
jest.setSystemTime(new Date('2026-01-01'));

// Test
expect(service.getCurrentYear()).toBe(2026);

jest.useRealTimers();
```

## Nest'te provider override

```typescript
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EmailService)
  .useValue({ send: jest.fn() })
  .overrideProvider(getModelToken(User.name))
  .useValue({ findOne: jest.fn() })
  .compile();
```

## Anti-pattern'ler

### Gerçek external call
```typescript
it('test', async () => {
  await axios.get('https://real-api.com');  // ❌ network flaky
});
```

### Mock reset unutma
```typescript
// Test A'nın mock'u test B'ye sızar
it('a', () => { spy.mockReturnValue(1); });
it('b', () => { /* spy hala 1 döner */ });
```
afterEach clearAllMocks.

### Over-mocking
```typescript
// Her şey mock → test hiçbir şey test etmiyor
```
Sadece gerekli dış bağımlılıkları mock.

## Aksiyon

1. Jest built-in mock
2. MSW HTTP için
3. Module override NestJS
4. afterEach clearAllMocks
5. Sadece external bağımlılıkları mock
