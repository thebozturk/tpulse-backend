---
name: observability-health
keywords: "health, terminus, liveness, readiness"
description: "@nestjs/terminus health check setup"
---

# Health Check (Observability angle)

Detail: `resilience/health-checks.md`

## Quick recap

```typescript
@Get('health/ready')
@Public()
@SkipThrottle()
@HealthCheck()
ready() {
  return this.health.check([
    () => this.mongoose.pingCheck('mongodb'),
    () => this.memory.checkHeap('heap', 250 * 1024 * 1024),
  ]);
}
```

## Monitoring tarafı

Healthcheck endpoint'i monitoring'e bağlanır:
- Uptime monitoring (UptimeRobot, Pingdom) — `/health/live`
- Internal health dashboard — `/health/ready` detail

Status değişikliği → Slack/PagerDuty alert.
