import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Tek kaynak: hem /swagger UI'ı hem openapi.json export'u bu document'ı kullanır. */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TransferPulse API')
    .setDescription('TransferPulse backend (.NET → NestJS migration)')
    .setVersion('1.5.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** /swagger altında OpenAPI UI. ENABLE_SWAGGER flag'i ile main.ts'ten çağrılır. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('swagger', app, buildSwaggerDocument(app));
}
