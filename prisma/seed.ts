/**
 * Dev seed — tüm projede içerik üretir.
 *
 *  1) leagues_with_players.json (ham API-Football) → normalize → FootballDataSeeder
 *     ile lig/takım/oyuncu (mevcut upsert + pozisyon mantığı yeniden kullanılır).
 *  2) Kullanıcı, transfer, söylenti, haber, gönderi, yorum, beğeni, oy, favori,
 *     bildirim, transfer dönemi, döviz kuru — örnek içerik.
 *
 * Çalıştır:  pnpm db:seed   (idempotent: önce domain tabloları temizlenir)
 * NOT: yalnız development. Production'da çalıştırma.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FootballDataSeeder } from '../src/integration/api-football/football-data.seeder';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import {
  FavouriteType,
  NotificationEventType,
  PostType,
  PostVoteChoice,
} from '../src/common/enums';

const prisma = new PrismaClient();

// ─── Yardımcılar ────────────────────────────────────────────────────────
const rand = (n: number): number => Math.floor(Math.random() * n);
const pick = <T>(arr: T[]): T => arr[rand(arr.length)];
const sample = <T>(arr: T[], k: number): T[] =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, k);
const daysAgo = (d: number): Date => new Date(Date.now() - d * 86_400_000);
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(
      /[çğıöşü]/g,
      (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c,
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);

// ─── 1) Ham JSON'u seeder'ın beklediği şekle çevir ──────────────────────
interface RawPlayer {
  id: number;
  name: string;
  firstname?: string | null;
  lastname?: string | null;
  nationality?: string | null;
  height?: string | null;
  weight?: string | null;
  photo?: string | null;
  birth?: { date?: string | null };
  position?: string | null;
}
interface RawTeam {
  id: number;
  name: string;
  logo?: string;
  founded?: number;
  venue?: { name?: string; city?: string; capacity?: number };
  players?: RawPlayer[];
}
interface RawLeague {
  id: number;
  name: string;
  logo?: string;
  country?: { name?: string; code?: string; flag?: string };
  teams?: RawTeam[];
}

function toSeederShape(raw: RawLeague[]): unknown {
  return {
    leagues: raw.map((lg) => ({
      externalId: lg.id,
      name: lg.name.slice(0, 30),
      country: (lg.country?.name ?? 'Unknown').slice(0, 30),
      countryLogo: lg.country?.flag ?? '',
      leagueLogo: lg.logo ?? '',
      leagueCode: lg.country?.code?.slice(0, 10),
      teams: (lg.teams ?? []).map((t) => ({
        externalId: t.id,
        name: t.name.slice(0, 50),
        logo: t.logo,
        founded: t.founded,
        venueName: t.venue?.name?.slice(0, 100),
        venueCity: t.venue?.city?.slice(0, 100),
        venueCapacity: t.venue?.capacity,
        players: (t.players ?? []).map((p) => ({
          externalId: p.id,
          firstName: (p.firstname ?? p.name ?? 'N/A').slice(0, 32),
          lastName: (p.lastname ?? p.name ?? 'N/A').slice(0, 32),
          nationality: (p.nationality ?? 'Unknown').slice(0, 32),
          birthDate: p.birth?.date ?? undefined,
          height: p.height ? parseInt(p.height, 10) || undefined : undefined,
          weight: p.weight ? parseInt(p.weight, 10) || undefined : undefined,
          photo: p.photo ?? undefined,
          // 'Forward' → 'Attacker' (positionCode yalnız 4 değeri tanır)
          position: p.position === 'Forward' ? 'Attacker' : p.position,
        })),
      })),
    })),
  };
}

// ─── Temizlik (FK-güvenli sıra) ─────────────────────────────────────────
async function wipe(): Promise<void> {
  await prisma.transferCommentLike.deleteMany();
  await prisma.transferComment.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.postVote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.userFavourite.deleteMany();
  await prisma.news.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
  await prisma.position.deleteMany();
  await prisma.transferPeriod.deleteMany();
  await prisma.currencyRate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  console.log('🌱 Seed başlıyor...');
  await wipe();
  console.log('  ✓ domain tabloları temizlendi');

  // 1) Lig / takım / oyuncu — mevcut seeder'ı yeniden kullan
  const rawPath = resolve(process.cwd(), 'leagues_with_players.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8')) as RawLeague[];
  const seeder = new FootballDataSeeder(prisma as unknown as PrismaService);
  const fb = await seeder.seed(
    Buffer.from(JSON.stringify(toSeederShape(raw)), 'utf-8'),
  );
  console.log(
    `  ✓ futbol verisi: ${fb.leaguesInserted} lig, ${fb.teamsInserted} takım, ${fb.playersInserted} oyuncu, ${fb.positionsCreated} pozisyon`,
  );

  const players = await prisma.player.findMany({
    select: {
      id: true,
      teamId: true,
      firstName: true,
      lastName: true,
      photo: true,
    },
  });
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, leagueId: true },
  });
  const leagues = await prisma.league.findMany({ select: { id: true } });

  // 2) Kullanıcılar
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const userDefs = [
    {
      username: 'admin',
      email: 'admin@transferpulse.dev',
      nickname: 'Admin',
      role: 'Admin',
    },
    {
      username: 'ahmet',
      email: 'ahmet@transferpulse.dev',
      nickname: 'Ahmet Y.',
      role: 'User',
    },
    {
      username: 'mehmet',
      email: 'mehmet@transferpulse.dev',
      nickname: 'Mehmet K.',
      role: 'User',
    },
    {
      username: 'elif',
      email: 'elif@transferpulse.dev',
      nickname: 'Elif D.',
      role: 'User',
    },
    {
      username: 'zeynep',
      email: 'zeynep@transferpulse.dev',
      nickname: 'Zeynep A.',
      role: 'User',
    },
    {
      username: 'can',
      email: 'can@transferpulse.dev',
      nickname: 'Can T.',
      role: 'User',
    },
  ];
  const users = await Promise.all(
    userDefs.map((u, i) =>
      prisma.user.create({
        data: {
          username: u.username,
          email: u.email,
          nickname: u.nickname,
          role: u.role,
          passwordHash,
          isMailConfirm: true,
          reputationScore: rand(500),
          favouriteTeam: pick(teams).name,
          profilePic: `https://i.pravatar.cc/150?img=${i + 1}`,
        },
      }),
    ),
  );
  const admin = users[0];
  console.log(`  ✓ ${users.length} kullanıcı (şifre: Password123!)`);

  // 3) Döviz kurları (EUR baz)
  const today = new Date();
  await prisma.currencyRate.createMany({
    data: [
      {
        currencyCode: 'USD',
        baseCurrencyCode: 'EUR',
        rate: '1.08',
        rateDate: today,
      },
      {
        currencyCode: 'GBP',
        baseCurrencyCode: 'EUR',
        rate: '0.85',
        rateDate: today,
      },
      {
        currencyCode: 'TRY',
        baseCurrencyCode: 'EUR',
        rate: '35.50',
        rateDate: today,
      },
    ],
  });

  // 4) Transfer dönemleri
  await prisma.transferPeriod.createMany({
    data: [
      {
        name: '2024 Yaz Dönemi',
        periodType: 'Summer',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-09-02'),
      },
      {
        name: '2025 Kış Dönemi',
        periodType: 'Winter',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-02-03'),
      },
    ],
  });

  // 5) Transferler (gerçek) + 6) söylentiler
  const currencies = ['EUR', 'GBP', 'USD'];
  const transferIds: string[] = [];
  const rumourTransferIds: string[] = [];
  for (const p of sample(players, 40)) {
    const fromTeam = pick(teams.filter((t) => t.id !== p.teamId));
    if (!fromTeam) continue;
    const isRumour = Math.random() < 0.3;
    const tr = await prisma.transfer.create({
      data: {
        playerId: p.id,
        fromTeamId: fromTeam.id,
        toTeamId: p.teamId,
        transferDate: daysAgo(rand(300)),
        feeAmount: (rand(120) + 1) * 500_000,
        feeCurrency: pick(currencies),
        createdByUserId: admin.id,
        isRumour,
        source: Math.random() < 0.5 ? 'ApiSports' : 'Manual',
      },
    });
    transferIds.push(tr.id);
    if (isRumour) rumourTransferIds.push(tr.id);
  }
  console.log(
    `  ✓ ${transferIds.length} transfer (${rumourTransferIds.length} söylenti)`,
  );

  // 7) Haberler
  const sources = [
    'Fabrizio Romano',
    'Sky Sports',
    'BBC Sport',
    'Sporx',
    'A Spor',
    "L'Équipe",
  ];
  let newsCount = 0;
  for (const p of sample(players, 25)) {
    const title = `${p.firstName} ${p.lastName} için transfer iddiası`;
    await prisma.news.create({
      data: {
        title,
        slug: `${slugify(title)}-${newsCount}`,
        content: `${p.firstName} ${p.lastName} ile ilgili son gelişmeler kulisleri hareketlendirdi. Kaynaklara göre görüşmeler sürüyor.`,
        playerId: p.id,
        toTeamId: p.teamId,
        fromTeamId: pick(teams).id,
        sourceName: pick(sources),
        sourceUrl: 'https://example.com/haber',
        imageUrl: p.photo,
        publishDate: daysAgo(rand(60)),
      },
    });
    newsCount++;
  }
  console.log(`  ✓ ${newsCount} haber`);

  // 8) Gönderiler + 9) beğeni/oy + 10) yorum
  const postTypes = [PostType.Transfer, PostType.Team, PostType.Player];
  const contents = [
    'Bu transfer kesinlikle olur, kaynaklarım sağlam! 🔥',
    'Bence bu fiyata değmez, abartılıyor.',
    'Tarihi bir imza olabilir, heyecanlıyım.',
    'Sezon ortası bu hamle takımı uçurur.',
    'Sakatlık geçmişi beni endişelendiriyor.',
    'Scout raporları çok olumlu, takip ediyorum.',
  ];
  let postCount = 0;
  let commentCount = 0;
  for (let i = 0; i < 25; i++) {
    const owner = pick(users);
    const player = pick(players);
    const votingEnabled = Math.random() < 0.5;
    // post_type_shape_chk: tip başına alan seti zorunlu.
    const postType = pick(postTypes);
    const shape: {
      playerId?: string;
      teamId?: string;
      fromTeamId?: string;
      toTeamId?: string;
    } = {};
    if (postType === PostType.Transfer) {
      const fromT = pick(teams.filter((t) => t.id !== player.teamId));
      shape.playerId = player.id;
      shape.fromTeamId = fromT.id;
      shape.toTeamId = player.teamId;
    } else if (postType === PostType.Team) {
      shape.teamId = pick(teams).id;
    } else {
      shape.playerId = player.id;
    }
    const post = await prisma.post.create({
      data: {
        ownerId: owner.id,
        content: pick(contents),
        postType,
        ...shape,
        isVotingEnabled: votingEnabled,
        createdAtUtc: daysAgo(rand(45)),
      },
    });
    postCount++;

    // Beğeniler (unique userId)
    const likers = sample(users, rand(users.length));
    for (const u of likers) {
      await prisma.postLike.create({ data: { postId: post.id, userId: u.id } });
    }

    // Oylar (voting açıksa)
    let agree = 0;
    let disagree = 0;
    if (votingEnabled) {
      for (const u of sample(users, rand(users.length))) {
        const choice =
          Math.random() < 0.6 ? PostVoteChoice.Agree : PostVoteChoice.Disagree;
        await prisma.postVote.create({
          data: { postId: post.id, userId: u.id, choice },
        });
        if (choice === PostVoteChoice.Agree) agree++;
        else disagree++;
      }
    }

    // Yorumlar (+ bir alt yanıt)
    let postComments = 0;
    for (const u of sample(users, 1 + rand(3))) {
      const c = await prisma.comment.create({
        data: {
          ownerId: u.id,
          postId: post.id,
          content: pick(contents),
          createdAtUtc: daysAgo(rand(40)),
        },
      });
      postComments++;
      commentCount++;
      if (Math.random() < 0.4) {
        await prisma.comment.create({
          data: {
            ownerId: pick(users).id,
            postId: post.id,
            parentId: c.id,
            content: 'Katılıyorum 👍',
            createdAtUtc: daysAgo(rand(35)),
          },
        });
        postComments++;
        commentCount++;
      }
      // Yorum beğenileri
      for (const lu of sample(users, rand(3))) {
        await prisma.commentLike
          .create({ data: { commentId: c.id, userId: lu.id } })
          .catch(() => undefined);
      }
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        likeCount: likers.length,
        agreeCount: agree,
        disagreeCount: disagree,
        commentCount: postComments,
      },
    });
  }
  console.log(`  ✓ ${postCount} gönderi, ${commentCount} yorum (+ beğeni/oy)`);

  // 11) Transfer yorumları
  let tcCount = 0;
  for (const tid of sample(transferIds, Math.min(20, transferIds.length))) {
    for (const u of sample(users, 1 + rand(3))) {
      const tc = await prisma.transferComment.create({
        data: {
          transferId: tid,
          ownerId: u.id,
          content: pick(contents),
          createdAtUtc: daysAgo(rand(30)),
        },
      });
      tcCount++;
      for (const lu of sample(users, rand(3))) {
        await prisma.transferCommentLike
          .create({ data: { transferCommentId: tc.id, userId: lu.id } })
          .catch(() => undefined);
      }
    }
  }
  console.log(`  ✓ ${tcCount} transfer yorumu`);

  // 12) Favoriler
  let favCount = 0;
  for (const u of users) {
    const favs: { type: number; targetId: string }[] = [
      ...sample(leagues, 1).map((l) => ({
        type: FavouriteType.League,
        targetId: l.id,
      })),
      ...sample(teams, 2).map((t) => ({
        type: FavouriteType.Team,
        targetId: t.id,
      })),
      ...sample(players, 3).map((p) => ({
        type: FavouriteType.Player,
        targetId: p.id,
      })),
    ];
    for (const f of favs) {
      await prisma.userFavourite
        .create({ data: { userId: u.id, ...f } })
        .catch(() => undefined);
      favCount++;
    }
  }
  console.log(`  ✓ ${favCount} favori`);

  // 13) Bildirimler + 14) bildirim tercihleri
  let notifCount = 0;
  for (const u of users) {
    await prisma.notificationPreference.createMany({
      data: [
        {
          userId: u.id,
          eventType: NotificationEventType.Rumour,
          enabled: true,
        },
        {
          userId: u.id,
          eventType: NotificationEventType.Transfer,
          enabled: true,
        },
      ],
      skipDuplicates: true,
    });
    for (const tid of sample(transferIds, 3)) {
      const isRumour = rumourTransferIds.includes(tid);
      await prisma.notification
        .create({
          data: {
            userId: u.id,
            transferId: tid,
            eventType: isRumour
              ? NotificationEventType.Rumour
              : NotificationEventType.Transfer,
            title: isRumour
              ? 'Yeni transfer söylentisi'
              : 'Transfer gerçekleşti',
            body: 'Takip ettiğin oyuncu/takımla ilgili yeni bir gelişme var.',
            isRead: Math.random() < 0.5,
            createdAt: daysAgo(rand(20)),
          },
        })
        .then(() => notifCount++)
        .catch(() => undefined);
    }
  }
  console.log(`  ✓ ${notifCount} bildirim`);

  console.log('✅ Seed tamamlandı.');
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
