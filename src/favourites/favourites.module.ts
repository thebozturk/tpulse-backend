import { Module } from '@nestjs/common';
import { FAVOURITE_REPOSITORY } from './favourite.repository';
import { FavouritesService } from './favourites.service';
import { MeFavouritesController } from './me-favourites.controller';
import { PrismaFavouriteRepository } from './prisma-favourite.repository';

@Module({
  controllers: [MeFavouritesController],
  providers: [
    FavouritesService,
    { provide: FAVOURITE_REPOSITORY, useClass: PrismaFavouriteRepository },
  ],
  exports: [FavouritesService],
})
export class FavouritesModule {}
