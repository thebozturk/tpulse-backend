/**
 * OpenTelemetry init (docs/04 §8). Bu dosya main.ts'te EN ÜST satırda import
 * edilir — instrumentation'lar http/express/pg/ioredis modüllerini require
 * anında patch'ler, bu yüzden Nest lifecycle'ından (ConfigService/zod) önce,
 * doğrudan process.env okunarak çalışır.
 *
 * OTEL_EXPORTER_OTLP_ENDPOINT set değilse → tam no-op (SDK başlamaz).
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const DEFAULT_SERVICE_NAME = 'TransferPulse.Api';

export function telemetryEnabled(env: NodeJS.ProcessEnv): boolean {
  return !!env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
}

export function resolveServiceName(env: NodeJS.ProcessEnv): string {
  return env.OTEL_SERVICE_NAME?.trim() || DEFAULT_SERVICE_NAME;
}

export function startTelemetry(
  env: NodeJS.ProcessEnv = process.env,
): NodeSDK | null {
  if (!telemetryEnabled(env)) {
    return null;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: resolveServiceName(env),
      [ATTR_SERVICE_VERSION]: env.npm_package_version ?? '0.0.1',
    }),
    // Exporter'lar OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS env'lerini otomatik okur.
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  // eslint-disable-next-line no-console
  console.log(
    `[otel] telemetry başladı: ${resolveServiceName(env)} → ${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
  );

  const shutdown = (): void => {
    void sdk.shutdown().finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  return sdk;
}

// Side-effect: import-first garantisi (main.ts 1. satır).
startTelemetry();
