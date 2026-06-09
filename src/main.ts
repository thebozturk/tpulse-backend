import './tracing'; // MUTLAKA 1. import — diğer tüm modüllerden önce OTel patch'i
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupSwagger } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Güvenlik baseline (CLAUDE.md): helmet + global ValidationPipe + CORS whitelist.
  app.use(helmet());

  // Statik public/ — e-posta logoları vb. (EMAIL_ASSET_BASE_URL bu prefix'e işaret eder).
  // CORP: cross-origin — e-posta istemci proxy'leri (Gmail vb.) görseli çekebilsin diye.
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
    setHeaders: (res) =>
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  });

  // NOT: global prefix EKLENMEZ — controller route'ları zaten 'api/...' ile başlar.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS whitelist — sadece izinli origin'ler (config'ten).
  app.enableCors({
    origin: config.getOrThrow<string[]>('cors.allowedOrigins'),
    credentials: true,
  });
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  if (config.getOrThrow<boolean>('swagger.enabled')) {
    setupSwagger(app);
  }

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port);
}

void bootstrap();
