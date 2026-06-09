import { group } from 'k6';
import http from 'k6/http';

import { API, THRESHOLDS } from '../lib/config.js';
import { checkOk, pick, think } from '../lib/checks.js';
import { discoverPool } from '../lib/data.js';
import { rampingOptions } from '../profiles.js';

// Public read karışımı — en çok trafik alan GET endpoint'leri.
// STAGE=baseline|stress ile yük profili seçilir.
export const options = rampingOptions(THRESHOLDS.read);

const SEARCH_TERMS = ['real', 'united', 'city', 'fc', 'inter'];

export function setup() {
  return discoverPool();
}

export default function (pool) {
  group('news', () => {
    checkOk(http.get(`${API}/news?page=1&pageSize=20`), 'news list');
    const id = pick(pool.news);
    if (id) checkOk(http.get(`${API}/news/${id}`), 'news detail');
  });
  think();

  group('transfers', () => {
    checkOk(http.get(`${API}/transfers?page=1&pageSize=20`), 'transfers list');
    checkOk(http.get(`${API}/transfers/latest`), 'transfers latest');
    checkOk(http.get(`${API}/transfers/top-expensive`), 'transfers top');
  });
  think();

  group('players', () => {
    checkOk(http.get(`${API}/players?page=1&pageSize=20`), 'players list');
    const term = pick(SEARCH_TERMS);
    checkOk(http.get(`${API}/players/search?q=${term}`), 'players search');
    const id = pick(pool.players);
    if (id) checkOk(http.get(`${API}/players/${id}/profile`), 'player profile');
  });
  think();

  group('teams', () => {
    checkOk(http.get(`${API}/teams?page=1&pageSize=20`), 'teams list');
    const id = pick(pool.teams);
    if (id) checkOk(http.get(`${API}/teams/${id}/detail`), 'team detail');
  });
  think();

  group('leagues', () => {
    checkOk(http.get(`${API}/leagues`), 'leagues list');
    const id = pick(pool.leagues);
    if (id)
      checkOk(
        http.get(`${API}/leagues/${id}/transfers/latest`),
        'league transfers',
      );
  });
  think();

  group('search', () => {
    const term = pick(SEARCH_TERMS);
    checkOk(http.get(`${API}/search?q=${term}`), 'global search');
  });
  think();
}
