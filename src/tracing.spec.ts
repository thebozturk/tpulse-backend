import {
  resolveServiceName,
  startTelemetry,
  telemetryEnabled,
} from './tracing';

describe('tracing (OpenTelemetry gating)', () => {
  describe('telemetryEnabled', () => {
    it('endpoint yoksa false', () => {
      expect(telemetryEnabled({})).toBe(false);
    });

    it('boş/whitespace endpoint → false', () => {
      expect(telemetryEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: '   ' })).toBe(
        false,
      );
    });

    it('geçerli endpoint → true', () => {
      expect(
        telemetryEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://x:4318' }),
      ).toBe(true);
    });
  });

  describe('resolveServiceName', () => {
    it('default TransferPulse.Api', () => {
      expect(resolveServiceName({})).toBe('TransferPulse.Api');
    });

    it('OTEL_SERVICE_NAME override', () => {
      expect(resolveServiceName({ OTEL_SERVICE_NAME: 'custom-svc' })).toBe(
        'custom-svc',
      );
    });

    it('boş OTEL_SERVICE_NAME → default', () => {
      expect(resolveServiceName({ OTEL_SERVICE_NAME: '  ' })).toBe(
        'TransferPulse.Api',
      );
    });
  });

  describe('startTelemetry', () => {
    it('endpoint yoksa null döner (no-op, SDK başlamaz)', () => {
      expect(startTelemetry({})).toBeNull();
    });
  });
});
