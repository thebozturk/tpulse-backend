import { z } from 'zod';

/**
 * Tüm environment değişkenlerinin tek doğrulama kaynağı.
 * Eksik/invalid env → boot'ta throw (uygulama açılmaz).
 * Kritik secret'larda fallback YOK (bkz. .claude/rules/config.md).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  // Kritik — zorunlu, fallback yok
  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunlu'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  REDIS_CONNECTION_STRING: z.string().min(1, 'REDIS_CONNECTION_STRING zorunlu'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  ENABLE_SWAGGER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // JWT & token (docs/04 §1)
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_ISSUER: z.string().default('TransferPulse'),
  JWT_AUDIENCE: z.string().default('TransferPulseApp'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(90),

  // Şifre sıfırlama (docs/04 §1)
  PASSWORD_RESET_TOKEN_MINUTES: z.coerce.number().int().positive().default(60),
  PASSWORD_RESET_URL_BASE: z
    .string()
    .default('http://localhost:3000/reset-password'),

  // E-posta doğrulama
  EMAIL_VERIFY_TOKEN_MINUTES: z.coerce.number().int().positive().default(1440), // 24 saat
  EMAIL_VERIFY_URL_BASE: z
    .string()
    .default('http://localhost:3000/verify-email'),

  // E-posta digest job'ları (cron — 6 alan, saniye dahil). Güvenlik için
  // varsayılan KAPALI; prod'da DIGEST_ENABLED=true ile açılır.
  DIGEST_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DIGEST_WEEKLY_CRON: z.string().default('0 0 9 * * 1'), // Pzt 09:00
  DIGEST_TRANSFER_ALERT_CRON: z.string().default('0 0 18 * * *'), // her gün 18:00

  // Resend — e-posta gönderimi. RESEND_API_KEY boşsa gönderim yapılmaz, log'a yazılır.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('TransferPulse <no-reply@transferpulse.app>'),

  // Storage — AWS S3 (lokal MinIO). Boşsa görsel upload pasif.
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  GOOGLE_AUTH_CLIENT_ID: z.string().optional(),
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z
    .string()
    .default('https://v3.football.api-sports.io'),
  API_FOOTBALL_LEAGUE_IDS: z.string().default(''),
  API_FOOTBALL_SEASON: z.coerce.number().int().default(2024),
  SYNC_CRON: z.string().optional(),
  DETECT_TRANSFERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MIRROR_IMAGES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // E-posta görselleri (logo vb.) absolute URL base'i. Şimdilik API public/'ten
  // serve edilir; S3 entegre olunca S3_PUBLIC_BASE_URL'e geçirilir.
  EMAIL_ASSET_BASE_URL: z.string().default('http://localhost:8080/public'),
  // Frontend kök URL'i — e-postalardaki CTA ve abonelikten çıkma linkleri için.
  APP_WEB_URL: z.string().default('http://localhost:3000'),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  // Bot ingestion — API key'in SHA-256 hex hash'i (düz key saklanmaz). Boşsa ingestion kapalı.
  BOT_API_KEY_HASH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation hatası:\n${issues}`);
  }
  return result.data;
}
