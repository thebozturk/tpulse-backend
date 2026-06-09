import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ApiActionResponse } from '../common/swagger/api-envelope.decorators';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { EmailService } from './email.service';

@ApiTags('email')
@Controller('api/email')
@Throttle(ThrottlePolicies.write)
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Post('unsubscribe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Digest/pazarlama e-postalarından çık (imzalı token)',
  })
  @ApiResponse({ status: 400, description: 'Geçersiz abonelik tokenı' })
  @ApiActionResponse()
  async unsubscribe(
    @Body() dto: UnsubscribeDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.email.unsubscribe(dto.token);
    return { success: true, message: 'E-posta aboneliğinden çıkıldı' };
  }
}
