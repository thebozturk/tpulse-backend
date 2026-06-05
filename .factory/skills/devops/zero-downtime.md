---
name: devops-zero-downtime
keywords: "zero downtime, rolling deploy, blue green, canary"
description: "Zero-downtime deployment"
---

# Zero-Downtime Deploy

## Rolling update (Kubernetes default)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 1 extra pod during deploy
      maxUnavailable: 0   # her zaman min replica'yı koru
  replicas: 3
```

3 pod, 1 yeni oluşur → ready → eski pod terminate. Tekrar.

## Readiness probe zorunlu

Yeni pod'un traffic almadan önce ready olması gerekir:
```yaml
readinessProbe:
  httpGet: { path: /health/ready, port: 3000 }
  periodSeconds: 5
```

DB ready değilse readiness fail → traffic gitmez.

## Graceful shutdown

`preStop` + SIGTERM handling. Bkz. `resilience/graceful-shutdown.md`.

```yaml
terminationGracePeriodSeconds: 30
lifecycle:
  preStop:
    exec:
      command: ["sleep", "10"]
```

## Blue-Green

İki identical environment. Traffic switch'le.

```
Blue (v1) — active
Green (v2) — deployed ama traffic yok

Test green → traffic switch → blue standby
```

Advantages: instant rollback.
Disadvantages: 2x kaynak.

## Canary

Trafiğin %5'i yeni sürüme → monitor → kademeli %100.

```yaml
# Istio / Linkerd
route:
  - destination: { host: backend, subset: v1 }
    weight: 95
  - destination: { host: backend, subset: v2 }
    weight: 5
```

Problem varsa hemen %0 geri.

## Database compatibility

Deploy v2 önce v1 şemasını desteklemeli. Expand-contract migration (bkz. `mongodb/migrations.md`).

## Aksiyon

1. Rolling update default
2. Readiness probe
3. Graceful shutdown (SIGTERM)
4. terminationGracePeriodSeconds >= 30s
5. DB backward-compatible
6. Canary (advanced, ihtiyaca göre)
