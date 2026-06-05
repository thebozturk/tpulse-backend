---
name: security-audit-log
keywords: "audit, log, who, what, when, forensic, compliance"
description: "Audit log — sensitive op tracking"
---

# Audit Log

## Ne loglanır

**Sensitive operations:**
- Login / logout / failed login
- Password change / reset
- Email change
- Permission/role change
- Admin actions (user delete, refund, config change)
- Data export
- 2FA enable/disable
- API key create/revoke

**Loglanmaz:**
- Read-only normal queries (her GET'i logla → DB patlar)
- Health check'ler

## Schema

```typescript
@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ required: true, index: true })
  actor: string;          // User ID veya 'system'

  @Prop({ required: true, index: true })
  action: string;         // 'user.delete', 'payment.refund'

  @Prop({ required: true })
  target: string;         // Etkilenen entity (user ID, order ID)

  @Prop({ type: String })
  targetType?: string;    // 'User', 'Order', 'Config'

  @Prop({ type: Object })
  before?: any;           // Eski değer (rename, status change)

  @Prop({ type: Object })
  after?: any;            // Yeni değer

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  requestId?: string;     // Tracing

  @Prop({ enum: ['success', 'failure'], default: 'success' })
  outcome: string;

  @Prop()
  reason?: string;        // Failure ise neden
}

AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ target: 1, createdAt: -1 });
```

## Service

```typescript
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  async log(input: {
    actor: string;
    action: string;
    target: string;
    targetType?: string;
    before?: any;
    after?: any;
    outcome?: 'success' | 'failure';
    reason?: string;
    request?: Request;
  }): Promise<void> {
    await this.model.create({
      ...input,
      ip: input.request?.ip,
      userAgent: input.request?.headers['user-agent'],
      requestId: (input.request as any)?.requestId,
      outcome: input.outcome || 'success',
    });
  }
}
```

## Kullanım

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly userModel: Model<User>,
    private readonly audit: AuditService,
  ) {}

  async deleteUser(actorId: string, targetId: string, request: Request) {
    const target = await this.userModel.findById(targetId).lean();
    if (!target) throw new NotFoundException();

    await this.userModel.deleteOne({ _id: targetId });

    await this.audit.log({
      actor: actorId,
      action: 'user.delete',
      target: targetId,
      targetType: 'User',
      before: { email: target.email, status: target.status },
      request,
    });
  }
}
```

## Action naming

`<resource>.<verb>` format:
```
user.create
user.delete
user.role.assign
user.role.revoke
auth.login
auth.login.failed
auth.logout
auth.password.change
auth.password.reset
payment.refund
payment.create
config.update
api_key.create
api_key.revoke
```

Tutarlı naming → query/filter kolay.

## Failed actions da log

Login fail:
```typescript
async login(dto: LoginDto, request: Request) {
  const user = await this.userModel.findOne({ email: dto.email }).select('+password');

  if (!user || !await this.verifyPassword(user.password, dto.password)) {
    await this.audit.log({
      actor: dto.email,         // user ID henüz yok
      action: 'auth.login.failed',
      target: dto.email,
      outcome: 'failure',
      reason: 'invalid_credentials',
      request,
    });
    throw new UnauthorizedException('Invalid credentials');
  }

  // ...
}
```

Bu olmadan brute force, account takeover attempt'leri görünmez.

## Async write (performance)

Audit her sensitive op'ta yazılıyor. Sync ise main path yavaşlar:

```typescript
@Injectable()
export class AuditService {
  private queue: any[] = [];

  async log(input) {
    this.queue.push(input);
    if (this.queue.length >= 100) await this.flush();
  }

  private async flush() {
    const batch = this.queue.splice(0);
    await this.model.insertMany(batch);
  }

  // Cron her 5 saniyede flush
}
```

Ya da queue (Bull, BullMQ) ile background job.

**Trade-off:** Crash olursa son batch kaybolur. Critical event'ler (login, payment) sync, diğerleri async.

## Retention

Log'lar sonsuza kadar tutulmaz:
```typescript
// 1 yıl sonra sil (TTL index)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });
```

Compliance (HIPAA, GDPR) farklı süreler ister:
- HIPAA: 6 yıl
- PCI-DSS: 1 yıl
- SOX: 7 yıl
- GDPR: amaç bittiğinde sil

Kontrol et regulatory ihtiyaç.

## Immutable log

Audit log değiştirilemez olmalı:
- DB user'ın update permission'ı yok (sadece insert)
- Append-only collection
- Cloud: write-once S3 bucket'a backup

## Query / report

```typescript
// User'ın son 100 action'ı
await auditModel.find({ actor: userId })
  .sort({ createdAt: -1 })
  .limit(100)
  .lean();

// Failed login attempt'ler son 24 saat
await auditModel.find({
  action: 'auth.login.failed',
  createdAt: { $gte: new Date(Date.now() - 24*3600*1000) },
}).lean();

// Belirli user'a yapılan işlemler
await auditModel.find({ target: userId, targetType: 'User' })
  .sort({ createdAt: -1 })
  .lean();
```

## Admin UI (opsiyonel)

Audit log viewing:
```typescript
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  @Get()
  async list(@Query() filter: AuditFilterDto) {
    return this.audit.list(filter);
  }
}
```

Audit'in audit'i: admin'in audit log'u görüntülemesi de log'lanır.

## Anti-pattern'ler

### Sadece log dosyasına
```typescript
logger.info(`User ${id} deleted`);  // ❌ structured DB değil
```
Log dosyası rotated/silinir, query zor. DB'ye yaz.

### PII full payload
```typescript
audit.log({ before: user, after: updatedUser });
// ❌ password, ssn, token full obje
```
Sensitive field'ları redact:
```typescript
const sanitize = (u: User) => ({ id: u._id, email: u.email, status: u.status });
audit.log({ before: sanitize(user), after: sanitize(updatedUser) });
```

### Event yutma
```typescript
try {
  await this.audit.log({...});
} catch { /* ignore */ }
```
Audit fail = compliance fail. Log AT LEAST'i `logger.error`'a düş, alert.

### Read query'lerini logla
```typescript
audit.log({ action: 'user.read' });  // ❌ DB patlar
```
Sadece sensitive read (admin viewing all users vb.).

## Aksiyon

1. AuditLog schema (actor, action, target, before/after)
2. Sensitive op'larda `audit.log()` çağrısı
3. Failed events de logla (login fail vs.)
4. Action naming: `<resource>.<verb>`
5. Async write (queue) performance için
6. TTL index retention'a göre
7. Admin viewing UI (filter + pagination)
8. PII sanitize before log
