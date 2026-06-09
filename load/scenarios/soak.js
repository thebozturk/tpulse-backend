import http from 'k6/http';

import { API, THRESHOLDS } from '../lib/config.js';
import { checkOk, pick, think } from '../lib/checks.js';
import { discoverPool } from '../lib/data.js';

// Soak — uzun süre sabit orta yük. Memory leak, connection pool tükenmesi,
// yavaş bozulma (latency trend yukarı) tespiti için. Süre SOAK_DURATION ile
// (default 30m); CI'da kısaltılabilir.
export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.SOAK_VUS || 30),
      duration: __ENV.SOAK_DURATION || '30m',
    },
  },
  thresholds: THRESHOLDS.soak,
};

export function setup() {
  return discoverPool();
}

export default function (pool) {
  checkOk(http.get(`${API}/transfers?page=1&pageSize=20`), 'transfers list');
  checkOk(http.get(`${API}/players?page=1&pageSize=20`), 'players list');
  const id = pick(pool.players);
  if (id) checkOk(http.get(`${API}/players/${id}/profile`), 'player profile');
  think();
}
