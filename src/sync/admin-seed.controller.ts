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
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SingleResponse } from '../common/interfaces/response.interface';
import { SeedResultDto } from '../integration/api-football/dto/seed-result.dto';
import { FootballDataSeeder } from '../integration/api-football/football-data.seeder';
import { ApiSingleResponse } from '../common/swagger/api-envelope.decorators';

@ApiTags('admin-seed')
@ApiBearerAuth()
@Controller('api/admin/seed')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class AdminSeedController {
  constructor(private readonly seeder: FootballDataSeeder) {}

  @Post('football-data')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'leagues_with_players.json seed (idempotent)' })
  @ApiSingleResponse(SeedResultDto)
  async seed(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SingleResponse<SeedResultDto>> {
    return { data: await this.seeder.seed(file.buffer) };
  }
}
