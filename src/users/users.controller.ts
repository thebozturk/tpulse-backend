import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlePolicies } from '../common/throttle/throttle-policies';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { PagedResult } from '../common/interfaces/response.interface';
import { ApiPagedResponse } from '../common/swagger/api-envelope.decorators';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

// JwtAuthGuard global; burada ek olarak RolesGuard + Admin. write throttle 120/dk.
@ApiTags('users')
@ApiBearerAuth()
@Controller('api/users')
@UseGuards(RolesGuard)
@Roles('Admin')
@Throttle(ThrottlePolicies.write)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kullanıcı oluştur (Admin)' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Çakışma' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kullanıcıyı getir' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404 })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.users.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Kullanıcıları listele (paged)' })
  @ApiPagedResponse(UserResponseDto)
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PagedResult<UserResponseDto>> {
    return this.users.findAll(query.page, query.pageSize);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Kullanıcı güncelle' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'id uyuşmazlığı' })
  @ApiResponse({ status: 404 })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kullanıcı sil' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.remove(id);
  }
}
