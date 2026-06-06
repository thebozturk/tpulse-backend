import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { SeedResultDto } from '../integration/api-football/dto/seed-result.dto';
import { FootballDataSeeder } from '../integration/api-football/football-data.seeder';

@ApiTags('admin-seed')
@ApiBearerAuth()
@Controller('api/admin/seed')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AdminSeedController {
  constructor(private readonly seeder: FootballDataSeeder) {}

  @Post('football-data')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'leagues_with_players.json seed (idempotent)' })
  async seed(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<SeedResultDto>> {
    return { data: await this.seeder.seed(file.buffer) };
  }
}
