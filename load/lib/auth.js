import http from 'k6/http';

import { API } from './config.js';

// Yük testi kullanıcısı oluşturur ve accessToken döner. setup()'ta çağrılır;
// token VU'lara paylaşılır (auth-write senaryosu için). uniq → her run farklı
// kullanıcı (register çakışmasını önler). VU/iter'a bağlı değil — Math.random
// k6'da mevcut.
export function registerTestUser() {
  const uniq = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const payload = {
    username: `loadtest_${uniq}`,
    email: `loadtest_${uniq}@example.com`,
    password: 'LoadTest123',
    nickname: `LoadTest ${uniq}`,
  };

  const res = http.post(`${API}/auth/register`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Test kullanıcısı register başarısız: ${res.status} ${res.body}`,
    );
  }

  const body = res.json();
  return { token: body.accessToken, email: payload.email };
}

// Authorization header'ı — VU isteklerinde kullanılır
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}
