import { group } from 'k6';
import http from 'k6/http';

import { API, THRESHOLDS } from '../lib/config.js';
import { checkOk, pick, think } from '../lib/checks.js';
import { authHeaders, registerTestUser } from '../lib/auth.js';
import { discoverPool } from '../lib/data.js';
import { rampingOptions } from '../profiles.js';

// Auth + yazma akışı — login'li kullanıcı favori ekler/listeler.
// Favori ekleme idempotent (tekrar → 200 unchanged), DB'yi şişirmez.
export const options = rampingOptions(THRESHOLDS.write);

// FavouriteType (src/common/enums/favourite-type.enum.ts)
const FAV_TEAM = 2;
const FAV_PLAYER = 3;

export function setup() {
  const { token } = registerTestUser();
  const pool = discoverPool();
  return { token, pool };
}

export default function (data) {
  const { token, pool } = data;
  const opts = authHeaders(token);

  group('favourites read', () => {
    checkOk(http.get(`${API}/me/favourites`, opts), 'favourites list');
  });
  think();

  group('favourites write', () => {
    const teamId = pick(pool.teams);
    if (teamId) {
      const res = http.post(
        `${API}/me/favourites`,
        JSON.stringify({ type: FAV_TEAM, targetId: teamId }),
        opts,
      );
      // 201 (eklendi) veya 200 (zaten vardı) — ikisi de başarı
      checkOk(res, 'favourite team add');
    }

    const playerId = pick(pool.players);
    if (playerId) {
      const res = http.post(
        `${API}/me/favourites`,
        JSON.stringify({ type: FAV_PLAYER, targetId: playerId }),
        opts,
      );
      checkOk(res, 'favourite player add');
    }
  });
  think();
}
