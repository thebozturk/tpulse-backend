import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class LaunchCampaignDto {
  @ApiProperty({ maxLength: 200, example: 'TransferPulse yayında! 🚀' })
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    maxLength: 2000,
    example: 'Beklediğin an geldi — TransferPulse artık canlıda.',
  })
  @IsString()
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'Hemen keşfet' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'https://transferpulse.app/kesfet',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  ctaUrl?: string;
}
