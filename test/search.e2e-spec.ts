import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

/**
 * SEARCH normalize (e2e): aksan/Türkçe karakter duyarsız arama.
 * 'ozil' (ASCII) yazınca 'Mesut Özil' bulunmalı; 'calhanoglu' → 'Çalhanoğlu'.
 * f_unaccent(lower(...)) migration'ının uçtan uca çalıştığını garanti eder.
 * Gerçek PostgreSQL gerektirir (docker compose up). `pnpm test:e2e`.
 */
describe('Search unaccent normalization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Çakışmayı önlemek için benzersiz marker'lı seed verisi.
  const TAG = 'e2e-unaccent-test';
  const ids = { league: '', team: '', player: '' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const league = await prisma.league.create({
      data: {
        name: `${TAG}-league`,
        country: 'Türkiye',
        countryLogo: 'x',
        leagueLogo: 'x',
      },
    });
    ids.league = league.id;

    const team = await prisma.team.create({
      data: { name: `${TAG}-team`, leagueId: league.id },
    });
    ids.team = team.id;

    const player = await prisma.player.create({
      data: {
        firstName: 'Mesut',
        lastName: 'Özil',
        nationality: 'Türkiye',
        teamId: team.id,
      },
    });
    ids.player = player.id;
  });

  afterAll(async () => {
    // FK onDelete: Restrict — ters sırada temizle.
    if (ids.player) await prisma.player.delete({ where: { id: ids.player } });
    if (ids.team) await prisma.team.delete({ where: { id: ids.team } });
    if (ids.league) await prisma.league.delete({ where: { id: ids.league } });
    await app.close();
  });

  it("ASCII 'ozil' sorgusu aksanlı 'Özil'i bulur", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'ozil' })
      .expect(200);

    const names = res.body.data.players.map((p: { name: string }) => p.name);
    expect(names).toContain('Mesut Özil');
  });

  it('paged player search de aksan duyarsız çalışır', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/players/search')
      .query({ query: 'ozil' })
      .expect(200);

    // PagedResult zarfı: { items, page, pageSize, totalCount, totalPages }
    const found = res.body.items.some(
      (p: { lastName?: string }) => p.lastName === 'Özil',
    );
    expect(found).toBe(true);
  });
});
