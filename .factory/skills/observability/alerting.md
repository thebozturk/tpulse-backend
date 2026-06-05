---
name: observability-alerting
keywords: "alert, SLO, error budget, pagerduty, slack"
description: "Alerting strategy — SLO ile"
---

# Alerting

## SLO (Service Level Objective)

Hedef: kullanıcı için ölçülebilir kalite.

Örnek:
- 99.9% uptime (43m downtime/ay OK)
- p95 latency < 500ms
- Error rate < 0.1%

## Error budget

99.9% SLO → 0.1% "hata bütçesi". 30 günde:
- Total: 43,200 dakika
- Budget: 43.2 dakika downtime

Budget tükendiyse → deploy durdur, stabilization sprint.

## Alert kuralları

### Page (yatakdan kaldıran)
- Service down (5dk error rate >50%)
- p99 latency >5s sustained 5dk
- Database unreachable

### Ticket (saatlerce var)
- Error rate >1% sustained 30dk
- Disk >80%
- Memory >90%

### Info (sadece bilgi)
- Deploy notification
- Cron job failure (retry yapacak)

## Prometheus alert

```yaml
# alerts.yml
groups:
  - name: backend
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.01
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Error rate >1%"

      - alert: DBDown
        expr: up{job="mongodb"} == 0
        for: 1m
        labels:
          severity: critical
```

Alertmanager → PagerDuty → human.

## Anti-pattern'ler

### Alert fatigue
Çok alert → ignored. Sadece actionable.

### No runbook
Alert geldi, ne yapılır bilinmiyor. Her alert'ın runbook'u var (docs/runbooks/).

## Aksiyon

1. SLO tanımla
2. Error budget track
3. Page vs ticket kategorize
4. Prometheus alert rules
5. Runbook her alert için
