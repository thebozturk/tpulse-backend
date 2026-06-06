import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserStatus,
} from '@prisma/client';
import { CommentsService } from '../comments/comments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { TransferCommentsService } from '../transfer-comments/transfer-comments.service';
import { UsersService } from '../users/users.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    report: Record<string, jest.Mock>;
    post: Record<string, jest.Mock>;
    comment: Record<string, jest.Mock>;
    transferComment: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };
  let users: { updateStatus: jest.Mock };
  let posts: { adminRemove: jest.Mock };
  let comments: { adminRemove: jest.Mock };
  let transferComments: { adminRemove: jest.Mock };

  const baseReport = {
    id: 'r1',
    reporterUserId: 'u1',
    targetType: ReportTargetType.Post,
    targetId: 'p1',
    reason: ReportReason.Hate,
    note: 'kötü',
    status: ReportStatus.Pending,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date(0),
  };

  beforeEach(async () => {
    prisma = {
      report: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn().mockResolvedValue(baseReport),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ ...baseReport, ...data })),
      },
      post: { count: jest.fn(), findUnique: jest.fn() },
      comment: { count: jest.fn(), findUnique: jest.fn() },
      transferComment: { count: jest.fn(), findUnique: jest.fn() },
      user: { count: jest.fn(), findUnique: jest.fn() },
    };
    users = { updateStatus: jest.fn().mockResolvedValue(undefined) };
    posts = { adminRemove: jest.fn().mockResolvedValue(undefined) };
    comments = { adminRemove: jest.fn().mockResolvedValue(undefined) };
    transferComments = { adminRemove: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: PostsService, useValue: posts },
        { provide: CommentsService, useValue: comments },
        { provide: TransferCommentsService, useValue: transferComments },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  const dto = {
    targetType: ReportTargetType.Post,
    targetId: 'p1',
    reason: ReportReason.Hate,
    note: 'kötü',
  };

  describe('create', () => {
    it('hedef yoksa 404', async () => {
      prisma.post.count.mockResolvedValue(0);
      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tekrar rapor 409', async () => {
      prisma.post.count.mockResolvedValue(1);
      prisma.report.findUnique.mockResolvedValue(baseReport);
      await expect(service.create('u1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('geçerli rapor oluşturur', async () => {
      prisma.post.count.mockResolvedValue(1);
      prisma.report.findUnique.mockResolvedValue(null);
      const res = await service.create('u1', dto);
      expect(res.id).toBe('r1');
      expect(prisma.report.create).toHaveBeenCalled();
    });
  });

  describe('review', () => {
    it('rapor yoksa 404', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(
        service.review('r1', 'admin', { status: ReportStatus.Reviewed }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Actioned + deleteContent → içeriği siler ve raporu günceller', async () => {
      prisma.report.findUnique.mockResolvedValue(baseReport);
      const res = await service.review('r1', 'admin', {
        status: ReportStatus.Actioned,
        deleteContent: true,
      });
      expect(posts.adminRemove).toHaveBeenCalledWith('p1');
      expect(res.status).toBe(ReportStatus.Actioned);
      expect(res.reviewedByUserId).toBe('admin');
    });

    it('Actioned + banUser → içerik sahibini banlar', async () => {
      prisma.report.findUnique.mockResolvedValue(baseReport);
      prisma.post.findUnique.mockResolvedValue({ ownerId: 'owner9' });
      await service.review('r1', 'admin', {
        status: ReportStatus.Actioned,
        banUser: true,
      });
      expect(users.updateStatus).toHaveBeenCalledWith('owner9', {
        status: UserStatus.Banned,
        reason: 'kötü',
      });
    });

    it('Dismissed → yan etki yok', async () => {
      prisma.report.findUnique.mockResolvedValue(baseReport);
      await service.review('r1', 'admin', { status: ReportStatus.Dismissed });
      expect(posts.adminRemove).not.toHaveBeenCalled();
      expect(users.updateStatus).not.toHaveBeenCalled();
    });
  });
});
