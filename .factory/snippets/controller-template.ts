// Template: Controller
// Kullanım: src/modules/<feature>/<feature>.controller.ts

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { XxxService } from './xxx.service';
import {
  CreateXxxDto, UpdateXxxDto, ListXxxQueryDto, XxxResponseDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';

@ApiTags('xxx')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('xxx')
export class XxxController {
  constructor(private readonly service: XxxService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create xxx', description: 'Create a new xxx resource' })
  @ApiResponse({ status: 201, type: XxxResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(@Body() dto: CreateXxxDto): Promise<XxxResponseDto> {
    return this.service.create(dto) as any;
  }

  @Get()
  @ApiOperation({ summary: 'List xxx' })
  @ApiResponse({ status: 200 })
  async list(@Query() query: ListXxxQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get xxx by id' })
  @ApiParam({ name: 'id', description: 'Resource ID (Mongo ObjectId)' })
  @ApiResponse({ status: 200, type: XxxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ObjectIdPipe) id: string): Promise<XxxResponseDto> {
    return this.service.findById(id) as any;
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update xxx' })
  @ApiResponse({ status: 200, type: XxxResponseDto })
  async update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateXxxDto,
  ): Promise<XxxResponseDto> {
    return this.service.update(id, dto) as any;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete xxx' })
  @ApiResponse({ status: 204 })
  async delete(@Param('id', ObjectIdPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
