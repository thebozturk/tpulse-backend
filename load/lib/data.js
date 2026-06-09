import http from 'k6/http';

import { API } from './config.js';

// setup() aşamasında list endpoint'lerinden GERÇEK id'leri toplar.
// Hardcoded id YOK — ortam (seed) değişse de senaryolar kırılmaz.
//
// Response shape: { data: [...], meta }. data dizi ya da { items: [...] } olabilir.

function extractItems(body) {
  if (!body) return [];
  const data = body.data !== undefined ? body.data : body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

// path: API'ye göreli (örn. '/players'). idField: çekilecek alan (default 'id').
function discoverIds(path, idField = 'id', limit = 50) {
  const res = http.get(`${API}${path}?page=1&pageSize=${limit}`);
  if (res.status !== 200) {
    console.warn(`discover ${path} → ${res.status} (id havuzu boş kalabilir)`);
    return [];
  }
  let body;
  try {
    body = res.json();
  } catch (e) {
    return [];
  }
  return extractItems(body)
    .map((item) => item && item[idField])
    .filter((v) => v !== undefined && v !== null);
}

// Tüm senaryolar için id havuzları — setup()'ta bir kez çağrılır, VU'lara dağıtılır.
export function discoverPool() {
  return {
    players: discoverIds('/players'),
    teams: discoverIds('/teams'),
    leagues: discoverIds('/leagues'),
    news: discoverIds('/news', 'id'),
    transfers: discoverIds('/transfers', 'id'),
  };
}
