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
    },
    redis: {
      connectionString: env.REDIS_CONNECTION_STRING,
    },
    cors: {
      allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    },
    swagger: {
      enabled: env.ENABLE_SWAGGER,
    },
    // İleride dolacak entegrasyonlar
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    google: {
      authClientId: env.GOOGLE_AUTH_CLIENT_ID,
    },
    apiFootball: {
      key: env.API_FOOTBALL_KEY,
    },
    smtp: {
      host: env.SMTP_HOST,
      username: env.SMTP_USERNAME,
      password: env.SMTP_PASSWORD,
    },
  };
};

export type AppConfiguration = ReturnType<typeof configuration>;
