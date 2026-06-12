/* eslint-disable no-console */
/**
 * Onarım: kupa-tipi sync kulüp takımlarının leagueId'sini ezmiş olabilir
 * (Galatasaray → UEFA Champions League). Her lig-tipi katalog ligi için
 * takımları API'den çekip (lig başına 1 istek) leagueId'yi domestik lige geri yazar.
 * Milli takımlar (yalnız kupada) dokunulmaz.
 *
 *   ts-node --transpile-only scripts/repair-team-leagues.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

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
    if (process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if (!/^["']/.test(val)) val = val.replace(/\s+#.*$/, '');
    process.env[m[1]] = val.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { configuration } from '../src/config/configuration';
import { AxiosFootballDataClient } from '../src/integration/api-football/axios-football-data.client';
import { LEAGUE_CATALOG } from '../src/integration/api-football/league-catalog';

async function main() {
  const config = new ConfigService(configuration());
  const client = new AxiosFootballDataClient(
    new HttpService(axios.create()),
    config,
  );
  const prisma = new PrismaClient();
  await prisma.$connect();

  const index = new Map(
    (await client.getLeaguesIndex()).map((m) => [m.externalId, m]),
  );

  let reassigned = 0;
  let processed = 0;
  for (const entry of LEAGUE_CATALOG) {
    const meta = index.get(entry.externalId);
    if (!meta || meta.type !== 'League' || meta.currentSeason === null)
      continue;

    const league = await prisma.league.findUnique({
      where: { externalId: entry.externalId },
      select: { id: true },
    });
    if (!league) continue;

    const teams = await client.getTeamsByLeague(
      entry.externalId,
      meta.currentSeason,
    );
    const extIds = teams.map((t) => t.externalId);
    if (!extIds.length) continue;

    const { count } = await prisma.team.updateMany({
      where: { externalId: { in: extIds }, leagueId: { not: league.id } },
      data: { leagueId: league.id },
    });
    reassigned += count;
    processed++;
    if (count > 0) {
      console.log(`[repair] ${entry.label}: ${count} takım geri alındı`);
    }
  }

  console.log(
    `[repair] bitti: ${processed} lig işlendi, ${reassigned} takım domestik lige geri yazıldı`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[repair] HATA:', e);
  process.exit(1);
});
