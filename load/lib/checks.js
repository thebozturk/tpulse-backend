import { check, sleep } from 'k6';

import { THINK_TIME } from './config.js';

// 2xx + JSON gövde doğrulaması. label metric'lerde okunabilir tag olur.
export function checkOk(res, label) {
  return check(res, {
    [`${label} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} gövde dolu`]: (r) => r.body && r.body.length > 0,
  });
}

// Belirli status bekleyen check (örn. 201 create, 401 yetkisiz)
export function checkStatus(res, label, expected) {
  return check(res, {
    [`${label} status ${expected}`]: (r) => r.status === expected,
  });
}

// Gerçekçi kullanıcı temposu — VU'lar arası rastgele bekleme
export function think() {
  const { min, max } = THINK_TIME;
  sleep(min + Math.random() * (max - min));
}

// Diziden rastgele eleman (id havuzundan seçim için)
export function pick(arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
