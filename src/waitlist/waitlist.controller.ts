import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ApiActionResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('waitlist')
@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(ThrottlePolicies.waitlist)
  @ApiOperation({ summary: 'Landing page e-posta kaydı (idempotent)' })
  @ApiResponse({ status: 400, description: 'Geçersiz e-posta' })
  @ApiActionResponse()
  async subscribe(
    @Body() dto: CreateWaitlistDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.waitlist.subscribe(dto);
    return { success: true, message: 'Kayıt alındı' };
  }
}
