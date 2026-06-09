import http from 'k6/http';

import { API, BASE_URL, THRESHOLDS } from '../lib/config.js';
import { checkOk, pick, think } from '../lib/checks.js';
import { discoverPool } from '../lib/data.js';
import { constantOptions } from '../profiles.js';

// CI gate — düşük yük, kısa süre. Kritik endpoint'lerin yük altında ayakta
// olduğunu doğrular. Threshold ihlali → exit≠0 → pipeline kırılır.
export const options = constantOptions(5, '1m', THRESHOLDS.smoke);

export function setup() {
  // Warm-up: health hazır mı
  checkOk(http.get(`${BASE_URL}/health`), 'health');
  return discoverPool();
}

export default function (pool) {
  checkOk(http.get(`${API}/news?page=1&pageSize=10`), 'news');
  checkOk(http.get(`${API}/transfers/latest`), 'transfers latest');
  checkOk(http.get(`${API}/players?page=1&pageSize=10`), 'players');
  checkOk(http.get(`${API}/teams?page=1&pageSize=10`), 'teams');
  checkOk(http.get(`${API}/leagues`), 'leagues');
  checkOk(http.get(`${API}/search?q=fc`), 'search');

  const teamId = pick(pool.teams);
  if (teamId) checkOk(http.get(`${API}/teams/${teamId}/detail`), 'team detail');

  think();
}
