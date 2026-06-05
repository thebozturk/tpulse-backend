// Template: Unit test
// Kullanım: src/modules/<feature>/<feature>.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { XxxService } from './xxx.service';
import { Xxx } from './schemas/xxx.schema';

describe('XxxService', () => {
  let service: XxxService;
  let model: jest.Mocked<Model<Xxx>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XxxService,
        {
          provide: getModelToken(Xxx.name),
          useValue: {
            findOne: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            create: jest.fn(),
            deleteOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(XxxService);
    model = module.get(getModelToken(Xxx.name));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const validDto = { email: 'a@b.com', password: 'secret123', name: 'A' };

    it('should create resource when email is unique', async () => {
      (model.findOne as jest.Mock).mockReturnValue({ lean: () => null });
      (model.create as jest.Mock).mockResolvedValue({
        toObject: () => ({ _id: '1', ...validDto }),
      });

      const result = await service.create(validDto as any);

      expect(result).toMatchObject({ email: 'a@b.com', name: 'A' });
      expect(model.create).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException when email already exists', async () => {
      (model.findOne as jest.Mock).mockReturnValue({ lean: () => ({ _id: '1' }) });

      await expect(service.create(validDto as any)).rejects.toThrow(ConflictException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('should handle duplicate key error (11000)', async () => {
      (model.findOne as jest.Mock).mockReturnValue({ lean: () => null });
      const err: any = new Error('E11000');
      err.code = 11000;
      (model.create as jest.Mock).mockRejectedValue(err);

      await expect(service.create(validDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return resource when found', async () => {
      const mock = { _id: '1', email: 'a@b.com' };
      (model.findById as jest.Mock).mockReturnValue({ lean: () => mock });

      const result = await service.findById('1');

      expect(result).toEqual(mock);
    });

    it('should throw NotFoundException when not found', async () => {
      (model.findById as jest.Mock).mockReturnValue({ lean: () => null });

      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete existing resource', async () => {
      (model.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      await expect(service.delete('1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when resource does not exist', async () => {
      (model.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      await expect(service.delete('x')).rejects.toThrow(NotFoundException);
    });
  });
});
