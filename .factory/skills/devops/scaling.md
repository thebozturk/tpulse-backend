---
name: devops-scaling
keywords: "scaling, HPA, autoscale, horizontal, vertical"
description: "Scaling stratejisi — HPA, resource tune"
---

# Scaling

## Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef: { name: backend, kind: Deployment }
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Resource
      resource:
        name: memory
        target: { type: Utilization, averageUtilization: 80 }
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
    scaleDown:
      stabilizationWindowSeconds: 300  # down slow
```

CPU >70% → pod ekle. Memory >80% → pod ekle.

## Custom metric ile scale

```yaml
metrics:
  - type: External
    external:
      metric: { name: http_requests_per_second }
      target: { type: AverageValue, averageValue: "100" }
```

100 RPS/pod hedef.

## Vertical scaling

Resource limits:
```yaml
resources:
  requests: { cpu: 500m, memory: 512Mi }
  limits: { cpu: 1000m, memory: 1Gi }
```

VPA (Vertical Pod Autoscaler) — limit'leri otomatik tune.

## DB scaling

- Read replica (1 primary + 2-3 replica) — read-heavy
- Sharding (ultra large scale, complex)
- Connection pool tune (bkz. `performance/connection-pool.md`)

## Cache scaling

- Single Redis → Redis Cluster (>10GB data)
- Read-heavy: Redis replica

## Load test

Scale kararı veri-bazlı:
```bash
k6 run load-test.js
# Target RPS, monitor CPU/memory, p95 latency
```

## Aksiyon

1. HPA CPU + memory
2. minReplicas ≥ 3 (HA)
3. Resource requests + limits
4. Custom metric (RPS) gerekirse
5. DB read replica scale
6. Load test ile validate
