import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NOTIFICATION_REPOSITORY } from './notification.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      markRead: jest.fn(),
      getTransfer: jest.fn(),
      findFavouriteUserIds: jest.fn(),
      getOptedOutUserIds: jest.fn(),
      createNotification: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NOTIFICATION_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('markRead throws 404 when not found', async () => {
    repo.markRead.mockResolvedValue(false);
    await expect(service.markRead('u', 'n')).rejects.toThrow(NotFoundException);
  });

  it('generateForTransfer excludes creator + opted-out, dedups via repo', async () => {
    repo.getTransfer.mockResolvedValue({
      id: 'tr',
      playerId: 'p',
      fromTeamId: 'f',
      toTeamId: 't',
      createdByUserId: 'creator',
      isRumour: false,
      playerName: 'Saka',
      fromTeamName: 'Ars',
      toTeamName: 'Che',
      fromLeagueId: 'l1',
      toLeagueId: 'l1',
    });
    // creator dahil döner; servis creator'ı eler
    repo.findFavouriteUserIds.mockResolvedValue(['u1', 'u2', 'creator']);
    repo.getOptedOutUserIds.mockResolvedValue(new Set(['u2'])); // u2 opt-out
    repo.createNotification.mockResolvedValue(true);

    const count = await service.generateForTransfer('tr');

    expect(count).toBe(1); // sadece u1
    expect(repo.createNotification).toHaveBeenCalledTimes(1);
    expect(repo.createNotification.mock.calls[0][0]).toBe('u1');
  });

  it('generateForTransfer returns 0 when transfer missing', async () => {
    repo.getTransfer.mockResolvedValue(null);
    expect(await service.generateForTransfer('x')).toBe(0);
  });
});
