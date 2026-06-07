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
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      username: env.SMTP_USERNAME,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    bot: {
      apiKeyHash: env.BOT_API_KEY_HASH,
    },
  };
};

export type AppConfiguration = ReturnType<typeof configuration>;
