import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../common/redis/cache.service';
import { passthroughCache } from '../common/redis/cache.test-util';
import { OutboxService } from '../messaging/outbox.service';
import { RumourWriteService } from './rumour-write.service';
import { TRANSFER_REPOSITORY } from './transfer.repository';

const dto = {
  playerId: 'p',
  fromTeamId: 'f',
  toTeamId: 't',
};

// $transaction çağrısını aynen çalıştıran, sabit bir tx sentinel'i geçen mock.
const tx = { __tx: true };
const prismaMock = {
  $transaction: jest.fn(<T>(fn: (client: typeof tx) => Promise<T>) => fn(tx)),
};

describe('RumourWriteService', () => {
  let service: RumourWriteService;
  let repo: Record<string, jest.Mock>;
  let outbox: { enqueue: jest.Mock };

  beforeEach(async () => {
    repo = {
      createRumour: jest.fn().mockResolvedValue({ id: 'r1' }),
      getRumourMeta: jest.fn(),
      updateRumour: jest.fn(),
      softDelete: jest.fn(),
      confirmRumour: jest.fn(),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        RumourWriteService,
        { provide: TRANSFER_REPOSITORY, useValue: repo },
        { provide: OutboxService, useValue: outbox },
        { provide: CacheService, useValue: passthroughCache() },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(RumourWriteService);
  });

  it('create makes rumour and enqueues notification atomically', async () => {
    expect(await service.create(dto, 'u1')).toEqual({ id: 'r1' });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(repo.createRumour).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: 'u1', feeCurrency: 'EUR' }),
      tx,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'notification.generate',
      { transferId: 'r1' },
      tx,
    );
  });

  it('update throws 404 when not a (live) rumour', async () => {
    repo.getRumourMeta.mockResolvedValue(null);
    await expect(
      service.update('r1', { userId: 'u', role: 'Reporter' } as AuthUser, dto),
    ).rejects.toThrow(NotFoundException);
  });

  it('update throws 403 for non-author non-admin', async () => {
    repo.getRumourMeta.mockResolvedValue({
      createdByUserId: 'owner',
      isRumour: true,
    });
    await expect(
      service.update('r1', { userId: 'u', role: 'Reporter' } as AuthUser, dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update allows admin to edit other author', async () => {
    repo.getRumourMeta.mockResolvedValue({
      createdByUserId: 'owner',
      isRumour: true,
    });
    await service.update('r1', { userId: 'u', role: 'Admin' } as AuthUser, dto);
    expect(repo.updateRumour).toHaveBeenCalled();
  });

  it('confirm converts and notifies (Transfer event)', async () => {
    repo.getRumourMeta.mockResolvedValue({
      createdByUserId: 'owner',
      isRumour: true,
    });
    const res = await service.confirm('r1', {
      feeAmount: 100,
      feeCurrency: 'EUR',
      transferDate: new Date(0),
    });
    expect(res).toEqual({ transferId: 'r1' });
    expect(repo.confirmRumour).toHaveBeenCalledWith(
      'r1',
      expect.anything(),
      tx,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'notification.generate',
      { transferId: 'r1' },
      tx,
    );
  });
});
