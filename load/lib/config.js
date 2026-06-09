// k6 ortak konfigürasyon — TEK kaynak. Senaryolar BASE_URL, threshold ve stage
// tanımlarını buradan okur (magic number yok).
//
// Env:
//   BASE_URL  hedef API kökü (default http://localhost:8080)
//   STAGE     baseline | stress  (ramping-vus profili seçer)

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(
  /\/$/,
  '',
);

export const API = `${BASE_URL}/api`;

export const STAGE = __ENV.STAGE || 'baseline';

// SLO threshold'ları — k6 `thresholds`'a verilir. İhlal → k6 exit≠0 → CI kırılır.
export const THRESHOLDS = {
  // Genel read SLO'su
  read: {
    http_req_failed: ['rate<0.01'], // <%1 hata
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
    checks: ['rate>0.99'],
  },
  // Yazma akışı — daha gevşek (DB write maliyeti)
  write: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
  // Smoke (CI gate) — düşük yük, sıkı doğruluk
  smoke: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
  // Spike — ani yükte geçici hata toleransı + toparlanma
  spike: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
  // Soak — uzun süre stabil kalmalı
  soak: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600'],
    checks: ['rate>0.99'],
  },
};

// ramping-vus stage'leri — STAGE env'ine göre profiles.js seçer
export const RAMP_STAGES = {
  baseline: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 0 },
  ],
};

// Düşünme süresi (saniye) — gerçekçi kullanıcı temposu için sleep aralığı
export const THINK_TIME = { min: 0.3, max: 1.2 };
