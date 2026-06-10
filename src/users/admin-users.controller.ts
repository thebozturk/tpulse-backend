import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '../common/audit/audit-actions';
import { Audit } from '../common/audit/audit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PagedResult } from '../common/interfaces/response.interface';
import {
  ApiPagedResponse,
  ApiSingleResponse,
} from '../common/swagger/api-envelope.decorators';
import { SingleResponse } from '../common/interfaces/response.interface';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { AdminUpdateReputationDto } from './dto/admin-update-reputation.dto';
import { AdminUpdateRoleDto } from './dto/admin-update-role.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminUserContentItemDto } from './dto/admin-user-content-item.dto';
import { AdminUserContentQueryDto } from './dto/admin-user-content.query.dto';
import { AdminUserDetailResponseDto } from './dto/admin-user-detail.response.dto';
import { AdminUserListQueryDto } from './dto/admin-user-list.query.dto';
import { AdminVerifyUserDto } from './dto/admin-verify-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('api/admin/users')
@UseGuards(RolesGuard)
@Roles('Admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Kullanıcıları listele (status/role/q filtre, paged)',
  })
  @ApiPagedResponse(UserResponseDto)
  findAll(
    @Query() query: AdminUserListQueryDto,
  ): Promise<PagedResult<UserResponseDto>> {
    return this.users.adminFindAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kullanıcı detayı (moderasyon alanları)' })
  @ApiSingleResponse(AdminUserDetailResponseDto)
  async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<AdminUserDetailResponseDto>> {
    return { data: await this.users.getDetail(id) };
  }

  @Get(':id/content')
  @ApiOperation({
    summary: 'Kullanıcının içeriği (post/comment/transfer, paged)',
  })
  @ApiPagedResponse(AdminUserContentItemDto)
  getContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AdminUserContentQueryDto,
  ): Promise<PagedResult<AdminUserContentItemDto>> {
    return this.users.getContent(id, query);
  }

  @Patch(':id/status')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.UserStatus, 'User')
  @ApiOperation({ summary: 'Durum güncelle (ban/suspend/activate)' })
  @ApiSingleResponse(AdminUserDetailResponseDto)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserStatusDto,
  ): Promise<SingleResponse<AdminUserDetailResponseDto>> {
    return { data: await this.users.updateStatus(id, dto) };
  }

  @Patch(':id/role')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.UserRole, 'User')
  @ApiOperation({ summary: 'Rol güncelle (son admin korumalı)' })
  @ApiSingleResponse(AdminUserDetailResponseDto)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateRoleDto,
  ): Promise<SingleResponse<AdminUserDetailResponseDto>> {
    return { data: await this.users.updateRole(id, dto) };
  }

  @Patch(':id/verify')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.UserVerify, 'User')
  @ApiOperation({
    summary: 'Doğrulama rozeti ata/kaldır (Blue=onaylı kullanıcı, Gold=marka)',
  })
  @ApiSingleResponse(AdminUserDetailResponseDto)
  async setVerified(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminVerifyUserDto,
  ): Promise<SingleResponse<AdminUserDetailResponseDto>> {
    return { data: await this.users.setVerified(id, dto) };
  }

  @Patch(':id/reputation')
  @Throttle(ThrottlePolicies.write)
  @Audit(AuditAction.UserReputation, 'User')
  @ApiOperation({ summary: 'İtibar güncelle (delta veya value)' })
  @ApiSingleResponse(AdminUserDetailResponseDto)
  async updateReputation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateReputationDto,
  ): Promise<SingleResponse<AdminUserDetailResponseDto>> {
    return { data: await this.users.updateReputation(id, dto) };
  }
}
