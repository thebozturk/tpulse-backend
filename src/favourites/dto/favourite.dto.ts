import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { FavouriteType } from '../../common/enums';

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
