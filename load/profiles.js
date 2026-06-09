// Ortak k6 options üreticileri — senaryolar executor + threshold'ları buradan kurar.
import { RAMP_STAGES, STAGE } from './lib/config.js';

// ramping-vus profili (STAGE env: baseline | stress). public-read / auth-write için.
export function rampingOptions(thresholds) {
  const stages = RAMP_STAGES[STAGE] || RAMP_STAGES.baseline;
  return {
    scenarios: {
      ramp: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages,
        gracefulRampDown: '10s',
      },
    },
    thresholds,
  };
}

// constant-vus profili (smoke / soak gibi sabit yük). vus + duration parametrik.
export function constantOptions(vus, duration, thresholds) {
  return {
    scenarios: {
      constant: {
        executor: 'constant-vus',
        vus,
        duration,
      },
    },
    thresholds,
  };
}

// JSON + terminal özet artifact'i — her senaryo handleSummary'de kullanır.
// (textSummary k6 built-in modülünden gelir.)
