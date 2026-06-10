import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWaitlistDto {
  @ApiProperty({ example: 'meraklı@kullanici.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiPropertyOptional({
    example: 'landing',
    maxLength: 60,
    description: 'Kaydın geldiği yer (ör. landing, footer).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  source?: string;

  /**
   * Honeypot — gerçek kullanıcı bu alanı görmez ve boş bırakır. Bot doldurursa
   * kayıt sessizce yok sayılır. Swagger'da gizli (botlara ipucu vermemek için).
   */
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
