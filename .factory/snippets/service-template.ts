// Template: Service
// Kullanım: src/modules/<feature>/<feature>.service.ts

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Xxx, XxxDocument } from './schemas/xxx.schema';
import { CreateXxxDto, UpdateXxxDto, ListXxxQueryDto } from './dto';

@Injectable()
export class XxxService {
  private readonly logger = new Logger(XxxService.name);

  constructor(
    @InjectModel(Xxx.name) private readonly xxxModel: Model<XxxDocument>,
  ) {}

  async create(dto: CreateXxxDto): Promise<Xxx> {
    const existing = await this.xxxModel.findOne({ email: dto.email }).lean();
    if (existing) {
      throw new ConflictException({
        code: 'XXX_ALREADY_EXISTS',
        message: 'Resource already exists',
      });
    }

    try {
      const created = await this.xxxModel.create(dto);
      this.logger.log({ id: created._id.toString() }, 'Xxx created');
      return created.toObject();
    } catch (err) {
      if (err.code === 11000) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Duplicate' });
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Xxx> {
    const xxx = await this.xxxModel.findById(id).lean();
    if (!xxx) {
      throw new NotFoundException({
        code: 'XXX_NOT_FOUND',
        message: 'Resource not found',
      });
    }
    return xxx;
  }

  async update(id: string, dto: UpdateXxxDto): Promise<Xxx> {
    const updated = await this.xxxModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .lean();
    if (!updated) {
      throw new NotFoundException({ code: 'XXX_NOT_FOUND' });
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.xxxModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException({ code: 'XXX_NOT_FOUND' });
    }
  }

  async list(query: ListXxxQueryDto): Promise<{ items: Xxx[]; nextCursor: string | null }> {
    const filter: any = {};
    if (query.status) filter.status = query.status;

    if (query.cursor) {
      const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
      filter._id = { $lt: new Types.ObjectId(decoded.id) };
    }

    const sortParts = (query.sort || '-createdAt').split(',');
    const sortObj: Record<string, 1 | -1> = {};
    for (const p of sortParts) {
      if (p.startsWith('-')) sortObj[p.substring(1)] = -1;
      else sortObj[p] = 1;
    }

    const items = await this.xxxModel
      .find(filter)
      .sort(sortObj)
      .limit(query.limit + 1)
      .lean();

    const hasNext = items.length > query.limit;
    if (hasNext) items.pop();

    const nextCursor = hasNext
      ? Buffer.from(JSON.stringify({ id: items[items.length - 1]._id })).toString('base64')
      : null;

    return { items, nextCursor };
  }
}
