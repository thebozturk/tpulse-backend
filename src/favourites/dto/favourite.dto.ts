import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { FavouriteType } from '../../common/enums';

/** Favori ekleme sonucu: yeni eklendiyse `success`, zaten varsa `unchanged`. */
export class FavouriteAddResponseDto {
  @ApiPropertyOptional({ description: 'Yeni eklendi (201)' }) success?: boolean;
  @ApiPropertyOptional({ description: 'Zaten favoride (200)' })
  unchanged?: boolean;
}

export class FavouriteDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: FavouriteType }) type: number;
  @ApiProperty() targetId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() imageUrl?: string;
  @ApiProperty() createdAt: Date;
}

export class AddFavouriteDto {
  @ApiProperty({ enum: FavouriteType })
  @IsEnum(FavouriteType)
  type: FavouriteType;

  @ApiProperty()
  @IsUUID()
  targetId: string;
}

export class SetFavouritesDto {
  @ApiProperty({ type: [AddFavouriteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddFavouriteDto)
  favourites: AddFavouriteDto[];
}
