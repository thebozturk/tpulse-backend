import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class ReviewReportDto {
  @ApiProperty({ enum: ReportStatus, example: ReportStatus.Actioned })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({
    description: 'status=Actioned ile birlikte raporlanan içeriği sil',
  })
  @IsOptional()
  @IsBoolean()
  deleteContent?: boolean;

  @ApiPropertyOptional({
    description: 'status=Actioned ile birlikte ilgili kullanıcıyı banla',
  })
  @IsOptional()
  @IsBoolean()
  banUser?: boolean;
}
