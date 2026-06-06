import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationEventType } from '../../common/enums';

export class NotificationDto {
  @ApiProperty() id: string;
  @ApiProperty() eventType: number;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiPropertyOptional() transferId?: string;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: Date;
}

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly: boolean = false;
}

export class PreferenceDto {
  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class SetPreferencesDto {
  @ApiProperty({ type: [PreferenceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceDto)
  preferences: PreferenceDto[];
}
