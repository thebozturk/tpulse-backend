import { validateEnv } from './env.validation';

/**
 * Validate edilmiş env'i namespace'li config nesnesine dönüştürür.
 * ConfigModule.load'a verilir; validateEnv burada çalışır → eksik env'de boot fail.
 * Erişim: configService.get('jwt.secret'), get('app.port') vb.
 */
export const configuration = () => {
  const env = validateEnv(process.env);

  return {
    app: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
    },
    database: {
      url: env.DATABASE_URL,
    },
    jwt: {
      secret: env.JWT_SECRET,
      accessExpiry: env.JWT_ACCESS_EXPIRY,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      refreshExpiryDays: env.JWT_REFRESH_EXPIRY_DAYS,
    },
    passwordReset: {
      tokenMinutes: env.PASSWORD_RESET_TOKEN_MINUTES,
      urlBase: env.PASSWORD_RESET_URL_BASE,
    },
    emailVerify: {
      tokenMinutes: env.EMAIL_VERIFY_TOKEN_MINUTES,
      urlBase: env.EMAIL_VERIFY_URL_BASE,
    },
    digests: {
      enabled: env.DIGEST_ENABLED,
      weeklyCron: env.DIGEST_WEEKLY_CRON,
      transferAlertCron: env.DIGEST_TRANSFER_ALERT_CRON,
    },
    redis: {
      connectionString: env.REDIS_CONNECTION_STRING,
    },
    idempotency: {
      ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
    },
    cors: {
      allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    },
    swagger: {
      enabled: env.ENABLE_SWAGGER,
    },
    // Yük testi — true ise rate limit bypass (LoadAwareThrottlerGuard). Sadece non-prod.
    loadTest: {
      enabled: env.LOAD_TEST_MODE,
    },
    // Storage — AWS S3 (lokal MinIO)
    s3: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
    google: {
      authClientId: env.GOOGLE_AUTH_CLIENT_ID,
    },
    apiFootball: {
      key: env.API_FOOTBALL_KEY,
      baseUrl: env.API_FOOTBALL_BASE_URL,
      leagueIds: env.API_FOOTBALL_LEAGUE_IDS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number),
      season: env.API_FOOTBALL_SEASON,
      syncCron: env.SYNC_CRON,
      detectTransfers: env.DETECT_TRANSFERS,
      mirrorImages: env.MIRROR_IMAGES,
    },
    resend: {
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    },
    email: {
      // Template'lerdeki logo/görsel URL'lerinin base'i (bkz. main.ts useStaticAssets).
      assetBaseUrl: env.EMAIL_ASSET_BASE_URL,
      // Frontend kök URL'i — CTA ve abonelikten çıkma linkleri.
      webUrl: env.APP_WEB_URL,
    },
    bot: {
      apiKeyHash: env.BOT_API_KEY_HASH,
    },
  };
};

export type AppConfiguration = ReturnType<typeof configuration>;
