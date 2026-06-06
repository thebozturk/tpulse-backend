import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from './audit-actions';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: Record<string, jest.Mock> };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('log kaydı oluşturur', async () => {
    await service.log({
      actorUserId: 'a1',
      action: AuditAction.UserStatus,
      targetType: 'User',
      targetId: 't1',
      metadata: { x: 1 },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'a1',
          action: 'user.status',
          targetId: 't1',
        }),
      }),
    );
  });

  it('yazma hatası throw etmez (non-blocking)', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.log({ actorUserId: 'a1', action: AuditAction.PostDelete }),
    ).resolves.toBeUndefined();
  });

  it('list actor/action/tarih filtresini where e çevirir', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');
    await service.list({
      actor: 'a1',
      action: 'user.status',
      from,
      to,
      page: 1,
      pageSize: 20,
    });
    const where = prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where.actorUserId).toBe('a1');
    expect(where.action).toBe('user.status');
    expect(where.createdAt).toEqual({ gte: from, lte: to });
  });
});
