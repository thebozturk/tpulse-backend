---
name: nestjs-pipes-validation
keywords: "pipe, validation, class-validator, transform, whitelist, forbidNonWhitelisted"
description: "ValidationPipe config ve class-validator kullanımı"
---

# Pipes & Validation

## Global ValidationPipe (ZORUNLU)

`main.ts`'te:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                // DTO'da tanımlı olmayan field'ları sil
    forbidNonWhitelisted: true,     // Extra field varsa 400 dön
    transform: true,                 // DTO instance'ına dönüştür
    transformOptions: {
      enableImplicitConversion: true, // @Query string → number auto convert
    },
    disableErrorMessages: process.env.NODE_ENV === 'production',  // prod'da stack trace yok
  }),
);
```

**Bu olmadan class-validator decorator'ları etkisiz — hepsi boşa yazılır.**

## class-validator decorator katalogu

### String
- `@IsString()`
- `@IsEmail()` — RFC 5321
- `@IsUrl()` — http/https
- `@IsUUID('4')` — UUID v4
- `@Matches(/^[A-Z]+$/)` — regex
- `@MinLength(n)`, `@MaxLength(n)`
- `@Length(min, max)`
- `@IsStrongPassword()` — karmaşıklık

### Number
- `@IsNumber()`, `@IsInt()`
- `@IsPositive()`, `@IsNegative()`
- `@Min(n)`, `@Max(n)`

### Date
- `@IsDate()`
- `@MinDate(new Date('2020-01-01'))`

### Boolean / Enum
- `@IsBoolean()`
- `@IsEnum(MyEnum)`

### Object / Array
- `@IsArray()`
- `@ArrayMinSize(n)`, `@ArrayMaxSize(n)`
- `@ValidateNested({ each: true })` + `@Type(() => ChildDto)`
- `@IsObject()`

### Optional
- `@IsOptional()` — undefined/null OK
- `@Allow()` — hiç validasyon yok (kaçın!)

## Transform

```typescript
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsNumber()
  @Type(() => Number)  // "42" string → 42 number (query'den gelirken)
  age: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags: TagDto[];
}
```

## Conditional validation

```typescript
@ValidateIf((o) => o.paymentMethod === 'credit_card')
@IsCreditCard()
cardNumber?: string;
```

## Custom validator

```typescript
import { ValidatorConstraint, ValidatorConstraintInterface, registerDecorator } from 'class-validator';

@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && value.length >= 8;
  }
  defaultMessage() {
    return 'Password must contain lowercase, uppercase, number, min 8 chars';
  }
}

export function IsStrongPassword() {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: {},
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}

// Kullanım
@IsStrongPassword()
password: string;
```

## Error format

Global ValidationPipe default formatı:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than 8"],
  "error": "Bad Request"
}
```

Custom format için exception factory:
```typescript
new ValidationPipe({
  exceptionFactory: (errors) => new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    errors: errors.map((e) => ({
      field: e.property,
      constraints: Object.values(e.constraints || {}),
    })),
  }),
})
```

## Anti-pattern'ler

- `@Allow()` kullanma — validation bypass, saldırı vektörü
- `ValidationPipe` yok — decorator'lar etkisiz
- `whitelist: false` + extra field — unexpected field'lar geçer
- Custom pipe'ta DB sorgusu — service'in işi

## Aksiyon

- main.ts'te global ValidationPipe ZORUNLU
- Her DTO'da her field için validator decorator
- Transform decorator'ı email/trim için
- Enum field'larda `@IsEnum` — string match yerine
- Custom validator ayrı dosyada (`common/validators/`)
