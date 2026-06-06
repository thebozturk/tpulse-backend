/**
 * openapi.json üretir — DB/Redis bağlantısı AÇMADAN.
 *
 * NestJS "preview mode" (preview: true): provider/controller'lar instantiate
 * EDİLMEZ, lifecycle hook (onModuleInit, Mongoose connect, cron) ÇALIŞMAZ.
 * SwaggerModule.createDocument yine de metadata (decorator) taradığı için
 * tam OpenAPI spec'i üretir. Yan etki yok — /contract-publish için güvenli.
 *
 * Çalıştır:  pnpm openapi:gen   (package.json script'i)
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/config/swagger';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  const document = buildSwaggerDocument(app);
  const outPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');

  await app.close();

  const paths = Object.keys(document.paths ?? {}).length;
  const schemas = Object.keys(document.components?.schemas ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`openapi.json yazıldı → ${paths} path, ${schemas} schema`);
}

generate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('openapi üretimi başarısız:', err);
  process.exit(1);
});
