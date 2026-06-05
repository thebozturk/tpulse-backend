import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };

  beforeEach(async () => {
    healthCheckService = { check: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: PrismaHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: jest.fn() } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should delegate to HealthCheckService with database and redis indicators', async () => {
    // Arrange
    const expected = { status: 'ok' };
    healthCheckService.check.mockResolvedValue(expected);

    // Act
    const result = await controller.check();

    // Assert
    expect(result).toBe(expected);
    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
    const indicators = healthCheckService.check.mock.calls[0][0];
    expect(indicators).toHaveLength(2);
  });
});
