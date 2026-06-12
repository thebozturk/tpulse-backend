import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AxiosFootballDataClient } from './axios-football-data.client';
import { QuotaExhaustedError } from './football-data.client';

function makeClient(headers: Record<string, string> = {}) {
  const get = jest.fn();
  const http = { get } as unknown as HttpService;
  const config = {
    getOrThrow: jest.fn(() => 'http://api.test'),
    get: jest.fn((k: string) => {
      if (k === 'apiFootball.key') return 'k';
      if (k === 'apiFootball.maxRpm') return 600_000; // throttle ~0ms
      if (k === 'apiFootball.dailyReserve') return 50;
      return undefined;
    }),
  } as unknown as ConfigService;
  const client = new AxiosFootballDataClient(http, config);
  const reply = (response: unknown[]) => of({ data: { response }, headers });
  return { client, get, reply };
}

describe('AxiosFootballDataClient', () => {
  it('getLeaguesIndex current sezon ve type türetir', async () => {
    const { client, get } = makeClient();
    get.mockReturnValue(
      of({
        data: {
          response: [
            {
              league: { id: 39, name: 'PL', logo: 'l', type: 'League' },
              country: { name: 'England', flag: 'f' },
              seasons: [
                { year: 2024, current: false },
                { year: 2025, current: true },
              ],
            },
            {
              league: { id: 2, name: 'UCL', logo: 'l', type: 'Cup' },
              country: { name: 'World', flag: 'f' },
              seasons: [{ year: 2025, current: false }],
            },
          ],
        },
        headers: {},
      }),
    );

    const idx = await client.getLeaguesIndex();

    expect(idx[0]).toMatchObject({
      externalId: 39,
      currentSeason: 2025,
      type: 'League',
    });
    // current yoksa en güncel yıl fallback
    expect(idx[1]).toMatchObject({
      externalId: 2,
      currentSeason: 2025,
      type: 'Cup',
    });
  });

  it('getPlayersByTeam stats parse eder, lig/sezon olmayan girdiyi atar', async () => {
    const { client, get } = makeClient();
    get.mockReturnValue(
      of({
        data: {
          response: [
            {
              player: {
                id: 1,
                firstname: 'B',
                lastname: 'S',
                nationality: 'England',
                birth: {},
              },
              statistics: [
                {
                  team: { id: 42 },
                  league: { id: 39, season: 2025 },
                  games: { appearences: 10, rating: '7.456', captain: true },
                  goals: { total: 5, assists: 2 },
                  penalty: { commited: 1 },
                },
                { team: { id: 42 }, league: { id: null, season: null } }, // atılmalı
              ],
            },
          ],
          paging: { current: 1, total: 1 },
        },
        headers: {},
      }),
    );

    const { items } = await client.getPlayersByTeam(42, 2025, 1);

    expect(items).toHaveLength(1);
    expect(items[0].statistics).toHaveLength(1); // null lig girdisi atıldı
    const st = items[0].statistics[0];
    expect(st).toMatchObject({
      leagueExternalId: 39,
      season: 2025,
      appearances: 10,
      goalsTotal: 5,
      goalsAssists: 2,
      captain: true,
      penaltyCommitted: 1, // API 'commited' → 'penaltyCommitted'
    });
    expect(st.rating).toBeCloseTo(7.46); // Decimal(4,2)
  });

  it('günlük kota rezerv altına inince QuotaExhaustedError fırlatır', async () => {
    const { client, get } = makeClient({
      'x-ratelimit-requests-remaining': '40', // reserve=50 → tükendi sayılır
    });
    get.mockReturnValue(
      of({
        data: {
          response: [
            {
              league: { id: 39, name: 'PL', logo: 'l', type: 'League' },
              country: { name: 'England', flag: 'f' },
              seasons: [{ year: 2025, current: true }],
            },
          ],
        },
        headers: { 'x-ratelimit-requests-remaining': '40' },
      }),
    );

    // İlk çağrı geçer ama header'dan kalan=40 okunur
    await client.getLeague(39);
    // Sonraki çağrı rezerv altı → fırlatır
    await expect(client.getLeague(39)).rejects.toBeInstanceOf(
      QuotaExhaustedError,
    );
  });
});
