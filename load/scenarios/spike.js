import http from 'k6/http';

import { API, THRESHOLDS } from '../lib/config.js';
import { checkOk, pick } from '../lib/checks.js';
import { discoverPool } from '../lib/data.js';

// Spike — ani yük: kısa sürede 0→peak→0. Sistem ani trafiği kaldırıp
// toparlanabiliyor mu? Geçici hata toleransı THRESHOLDS.spike'ta.
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 }, // normal
        { duration: '15s', target: 300 }, // ani spike
        { duration: '30s', target: 300 }, // peak'te tut
        { duration: '15s', target: 20 }, // düşür
        { duration: '20s', target: 0 }, // toparlan
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: THRESHOLDS.spike,
};

export function setup() {
  return discoverPool();
}

export default function (pool) {
  checkOk(http.get(`${API}/transfers/latest`), 'transfers latest');
  checkOk(http.get(`${API}/news?page=1&pageSize=20`), 'news');
  const teamId = pick(pool.teams);
  if (teamId) checkOk(http.get(`${API}/teams/${teamId}/detail`), 'team detail');
}
