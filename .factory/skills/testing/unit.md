---
name: testing-unit
keywords: "unit test, jest, mock, isolated, fast"
description: "Unit test pattern'ları — Jest + NestJS"
---

# Unit Test

## Kapsam

- Tek class/function
- Dış bağımlılıklar mock
- DB yok, HTTP yok, filesystem yok
- <10ms/test
- Test pyramid'ın geniş tabanı

## NestJS TestingModule

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { _id: '1', email: 'a@b.com' };
      userModel.findById.mockReturnValue({ lean: () => mockUser } as any);

      const result = await service.findById('1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when not found', async () => {
      userModel.findById.mockReturnValue({ lean: () => null } as any);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });
});
```

## AAA pattern

```typescript
it('should X when Y', () => {
  // Arrange
  const input = { ... };
  mock.method.mockReturnValue(...);

  // Act
  const result = service.doSomething(input);

  // Assert
  expect(result).toBe(...);
});
```

## Mock strategy

### Dependency mock (class)
```typescript
{ provide: UserService, useValue: { findById: jest.fn() } }
```

### Partial mock
```typescript
const userService = module.get(UserService);
jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
```

### Manual class mock
```typescript
class MockUserService {
  findById = jest.fn();
  create = jest.fn();
}

{ provide: UserService, useClass: MockUserService }
```

## Coverage hedef

- Lines >80%
- Branches >75%
- Functions >90%

`pnpm test --coverage` rapor.

## Anti-pattern'ler

- `any` type
- `done` callback (async/await)
- `console.log` debug bıraktı
- Test'ler birbirine bağımlı
- Gerçek DB
- `setTimeout` wait

Bkz. `.claude/rules/tests.md` detay.

## Aksiyon

1. Her service için .spec.ts
2. AAA pattern
3. Mock constructor DI ile
4. afterEach(clearAllMocks)
5. Coverage >80%
