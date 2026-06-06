export const FAVOURITE_REPOSITORY = Symbol('FAVOURITE_REPOSITORY');

export interface ResolvedFavourite {
  id: string;
  type: number;
  targetId: string;
  name: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface FavouriteTargets {
  playerIds: string[];
  teamIds: string[];
  reporterUserIds: string[];
}

export interface FavouriteInput {
  type: number;
  targetId: string;
}

export interface IFavouriteRepository {
  getForUserResolved(userId: string): Promise<ResolvedFavourite[]>;
  exists(userId: string, type: number, targetId: string): Promise<boolean>;
  targetExists(type: number, targetId: string): Promise<boolean>;
  create(
    userId: string,
    type: number,
    targetId: string,
  ): Promise<{ id: string }>;
  remove(userId: string, favouriteId: string): Promise<boolean>;
  replaceSet(userId: string, items: FavouriteInput[]): Promise<void>;
  getTargets(userId: string): Promise<FavouriteTargets>;
}
