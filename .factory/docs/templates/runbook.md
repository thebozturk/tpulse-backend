# Runbook: <INCIDENT_NAME>

**Last updated:** <DATE>
**Severity:** P1 / P2 / P3
**Owner:** <TEAM>

## Symptoms

How do you know this incident is happening?

- Alert: `<alert_name>` in Prometheus/Alertmanager
- User reports: `<description>`
- Dashboard: `<metric>` > threshold
- Log pattern: `<error message>`

## Impact

- Users affected: `<%>` of traffic
- Features impacted: `<list>`
- Business cost: revenue / SLA breach / compliance

## Diagnosis

Step-by-step investigation:

### 1. Check service health
```bash
curl https://api.acme.com/health/ready
```

Expected: `200 OK`
If 503 → service degraded, check readiness probe details.

### 2. Check metrics

Grafana dashboard: `<link>`

Key metrics:
- Error rate: `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))`
- p99 latency: `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))`
- DB connection pool: `mongodb_connections_active`

### 3. Check logs

```bash
# Loki
{container="backend"} |= "error" | json | line_format "{{.time}} {{.msg}} {{.error}}"

# kubectl
kubectl logs deployment/backend --tail=100 -f | grep -i error
```

Look for:
- Pattern X: upstream timeout
- Pattern Y: DB connection error
- Pattern Z: OOM kill

### 4. Check dependencies

- MongoDB: `mongosh --eval 'rs.status()'` — primary OK?
- Redis: `redis-cli ping` → PONG?
- External API: `curl https://external-api.com/health`

## Resolution

### Quick fix (restore service)

```bash
# 1. Rollback last deploy
kubectl rollout undo deployment/backend

# 2. Scale up (if load)
kubectl scale deployment/backend --replicas=10

# 3. Failover to standby (DB)
# (specific to your setup)
```

### Root cause fixes

- If OOM: increase memory limit in deployment.yaml
- If DB connection exhausted: check pool settings, increase maxPoolSize
- If external API down: circuit breaker should have caught it — check state

## Verification

After applying fix:

1. Error rate returns to baseline (<0.1%)
2. p99 latency <500ms
3. User reports stop
4. Health check 200

Monitor for 30 minutes post-fix.

## Postmortem

Within 24 hours:

1. Write postmortem doc: `docs/postmortems/YYYY-MM-DD-<incident>.md`
2. Root cause analysis (5 whys)
3. Action items: what to prevent recurrence
4. Update this runbook

## Related

- Alert definition: `monitoring/alerts.yml`
- Dashboard: `<link>`
- Previous incidents: `docs/postmortems/`
- Architecture: `docs/architecture.md`

## Contact

Primary on-call: `<rotation_name>` (PagerDuty)
Escalation: `<senior_engineer>` / `<team_lead>`
