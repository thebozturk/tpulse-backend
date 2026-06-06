import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FavouriteType } from '../common/enums';
import { FAVOURITE_REPOSITORY } from './favourite.repository';
import { FavouritesService } from './favourites.service';

describe('FavouritesService', () => {
  let service: FavouritesService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      exists: jest.fn(),
      targetExists: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      remove: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        FavouritesService,
        { provide: FAVOURITE_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(FavouritesService);
  });

  it('add returns unchanged when already favourited', async () => {
    repo.exists.mockResolvedValue(true);
    expect(await service.add('u', FavouriteType.Player, 'p')).toBe('unchanged');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('add throws 404 when target missing', async () => {
    repo.exists.mockResolvedValue(false);
    repo.targetExists.mockResolvedValue(false);
    await expect(
      service.add('u', FavouriteType.Player, 'ghost'),
    ).rejects.toThrow(NotFoundException);
  });

  it('add creates when new and target exists', async () => {
    repo.exists.mockResolvedValue(false);
    repo.targetExists.mockResolvedValue(true);
    expect(await service.add('u', FavouriteType.Team, 't')).toBe('added');
    expect(repo.create).toHaveBeenCalledWith('u', FavouriteType.Team, 't');
  });

  it('remove throws 404 when favourite not found', async () => {
    repo.remove.mockResolvedValue(false);
    await expect(service.remove('u', 'f1')).rejects.toThrow(NotFoundException);
  });
});
