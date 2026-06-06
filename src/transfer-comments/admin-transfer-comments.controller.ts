import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '../common/audit/audit-actions';
import { Audit } from '../common/audit/audit.decorator';
import { SuccessResponseDto } from '../common/dto/common-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { TransferCommentsService } from './transfer-comments.service';

@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('api/admin/transfer-comments')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AdminTransferCommentsController {
  constructor(private readonly transferComments: TransferCommentsService) {}

  @Delete(':id')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.TransferCommentDelete, 'TransferComment')
  @ApiOperation({ summary: 'Transfer yorumu sil (admin, owner-bypass)' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 404 })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.transferComments.adminRemove(id);
    return { success: true };
  }
}
