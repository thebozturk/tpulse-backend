/* eslint-disable no-console */
/**
 * Headless sync runner — AppModule (Redis/BullMQ) gerektirmeden
 * FootballDataSyncService'i doğrudan kurar ve çalıştırır.
 *
 *   ts-node --transpile-only scripts/run-sync.ts 203 204        # belirli ligler
 *   ts-node --transpile-only scripts/run-sync.ts                # tüm katalog
 *
 * DATABASE_URL'e yazar (migration uygulanmış olmalı). Kotayı tüketir.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// .env yükle (dotenv'siz; shell'de zaten set edilmiş değişkenleri EZMEZ → override mümkün).
function loadEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    let val = m[2];
    if (!/^["']/.test(val)) val = val.replace(/\s+#.*$/, ''); // inline comment
    val = val.trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}
loadEnv();

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { configuration } from '../src/config/configuration';
import { AxiosFootballDataClient } from '../src/integration/api-football/axios-football-data.client';
import { FootballDataSyncService } from '../src/integration/api-football/football-data.sync.service';
import { CATALOG_LEAGUE_IDS } from '../src/integration/api-football/league-catalog';

async function main() {
  const ids = process.argv
    .slice(2)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  const leagueExternalIds = ids.length ? ids : [...CATALOG_LEAGUE_IDS];

  const config = new ConfigService(configuration());
  const http = new HttpService(axios.create());
  const prisma = new PrismaClient();
  await prisma.$connect();

  const client = new AxiosFootballDataClient(http, config);
  const mirror = { mirror: async () => '' } as never; // mirrorImages=false → çağrılmaz
  const cache = { invalidateTags: async () => undefined } as never;

  const service = new FootballDataSyncService(
    prisma as never,
    client,
    config,
    mirror,
    cache,
  );

  console.log(
    `[run-sync] ${leagueExternalIds.length} lig: ${leagueExternalIds.join(',')}`,
  );
  const started = Date.now();
  const { runId, remaining } = await service.syncAll({ leagueExternalIds });
  const secs = Math.round((Date.now() - started) / 1000);

  const run = await prisma.syncRun.findUnique({ where: { id: runId } });
  console.log(`[run-sync] bitti ${secs}s  SyncRun=${runId}`);
  console.log(
    `[run-sync] leagues=${run?.leaguesInserted}+${run?.leaguesUpdated} teams=${run?.teamsInserted}+${run?.teamsUpdated} players=${run?.playersInserted}+${run?.playersUpdated} markedFree=${run?.playersMarkedFree} transfers=${run?.transfersCreated} errors=${run?.errorCount} status=${run?.status}`,
  );
  if (remaining.length) {
    console.log(
      `[run-sync] QUOTA: ${remaining.length} lig kaldı: ${remaining.join(',')}`,
    );
  }

  const [players, stats] = await Promise.all([
    prisma.player.count(),
    prisma.playerStatistic.count(),
  ]);
  console.log(
    `[run-sync] DB toplam: player=${players} playerStatistic=${stats}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[run-sync] HATA:', e);
  process.exit(1);
});
