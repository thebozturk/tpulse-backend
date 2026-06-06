import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * BO-6 smoke: tüm back office uçları kimlik doğrulaması ister (global JwtAuthGuard).
 * Token olmadan 401 dönmeli — yetkisiz erişime kapalı olduğunu garanti eder.
 * Gerçek PostgreSQL + Redis gerektirir (docker compose up). `pnpm test:e2e`.
 */
describe('Back office auth gating (e2e)', () => {
  let app: INestApplication;

  const PROTECTED: Array<['get' | 'post', string]> = [
    ['get', '/api/admin/dashboard/overview'],
    ['get', '/api/admin/users'],
    ['get', '/api/admin/reports'],
    ['get', '/api/admin/audit-logs'],
    ['get', '/api/admin/currency-rates'],
    ['get', '/api/admin/notifications/broadcasts'],
    ['post', '/api/reports'],
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(PROTECTED)('%s %s token olmadan 401 döner', async (method, path) => {
    const agent = request(app.getHttpServer());
    const req = method === 'post' ? agent.post(path) : agent.get(path);
    await req.expect(401);
  });
});
