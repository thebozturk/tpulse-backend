import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Response } from 'express';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { ListResponse } from '../common/interfaces/response.interface';
import {
  AddFavouriteDto,
  FavouriteDto,
  SetFavouritesDto,
} from './dto/favourite.dto';
import { FavouritesService } from './favourites.service';

@ApiTags('me-favourites')
@ApiBearerAuth()
@Controller('api/me/favourites')
@Throttle(ThrottlePolicies.write)
export class MeFavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Get()
  @ApiOperation({ summary: 'Favorilerim (çözülmüş)' })
  async list(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<FavouriteDto>> {
    return { items: await this.favourites.getForUser(user.userId) };
  }

  @Post()
  @ApiOperation({ summary: 'Favori ekle (201 / 200 unchanged / 404)' })
  async add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddFavouriteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success?: boolean; unchanged?: boolean }> {
    const outcome = await this.favourites.add(
      user.userId,
      dto.type,
      dto.targetId,
    );
    if (outcome === 'unchanged') {
      res.status(HttpStatus.OK);
      return { unchanged: true };
    }
    res.status(HttpStatus.CREATED);
    return { success: true };
  }

  @Put()
  @ApiOperation({ summary: 'Favori setini değiştir' })
  async set(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetFavouritesDto,
  ): Promise<ListResponse<FavouriteDto>> {
    return { items: await this.favourites.set(user.userId, dto.favourites) };
  }

  @Delete(':favouriteId')
  @ApiOperation({ summary: 'Favori sil' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('favouriteId', ParseUUIDPipe) favouriteId: string,
  ): Promise<{ success: boolean }> {
    await this.favourites.remove(user.userId, favouriteId);
    return { success: true };
  }
}
