import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FavouriteTargets,
  FAVOURITE_REPOSITORY,
  IFavouriteRepository,
} from './favourite.repository';
import { AddFavouriteDto, FavouriteDto } from './dto/favourite.dto';

export type AddOutcome = 'added' | 'unchanged';

@Injectable()
export class FavouritesService {
  constructor(
    @Inject(FAVOURITE_REPOSITORY) private readonly repo: IFavouriteRepository,
  ) {}

  getForUser(userId: string): Promise<FavouriteDto[]> {
    return this.repo.getForUserResolved(userId);
  }

  async add(
    userId: string,
    type: number,
    targetId: string,
  ): Promise<AddOutcome> {
    if (await this.repo.exists(userId, type, targetId)) {
      return 'unchanged';
    }
    if (!(await this.repo.targetExists(type, targetId))) {
      throw new NotFoundException('Hedef bulunamadı');
    }
    await this.repo.create(userId, type, targetId);
    return 'added';
  }

  async remove(userId: string, favouriteId: string): Promise<void> {
    if (!(await this.repo.remove(userId, favouriteId))) {
      throw new NotFoundException('Favori bulunamadı');
    }
  }

  async set(userId: string, items: AddFavouriteDto[]): Promise<FavouriteDto[]> {
    await this.repo.replaceSet(
      userId,
      items.map((i) => ({ type: i.type, targetId: i.targetId })),
    );
    return this.repo.getForUserResolved(userId);
  }

  getTargets(userId: string): Promise<FavouriteTargets> {
    return this.repo.getTargets(userId);
  }
}
