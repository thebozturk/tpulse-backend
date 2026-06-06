import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** /swagger altında OpenAPI UI. ENABLE_SWAGGER flag'i ile main.ts'ten çağrılır. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('TransferPulse API')
    .setDescription('TransferPulse backend (.NET → NestJS migration)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);
}
