---
name: devops-monitoring
keywords: "prometheus, grafana, alertmanager, monitoring"
description: "Monitoring stack kurulumu"
---

# Monitoring

## Stack

- **Prometheus** — metric scrape + storage
- **Grafana** — dashboard
- **Alertmanager** — alert routing
- **Node Exporter** — host metric

## docker-compose (monitoring)

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes: [grafana-data:/var/lib/grafana]
    ports: ["3001:3000"]

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports: ["9093:9093"]
```

## prometheus.yml

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: backend
    static_configs:
      - targets: ['backend:3000']
    metrics_path: /metrics

  - job_name: node
    static_configs:
      - targets: ['node-exporter:9100']

rule_files:
  - '/etc/prometheus/alerts.yml'

alerting:
  alertmanagers:
    - static_configs: [{ targets: ['alertmanager:9093'] }]
```

## Grafana dashboard

JSON-based dashboard import. Backend template:
- Request rate, error rate, latency (RED)
- DB connection pool usage
- Memory, CPU, event loop lag
- Queue depth
- Business metric'ler

## Cloud alternatives

- Datadog (all-in-one)
- New Relic
- Managed Grafana (Grafana Cloud)

## Aksiyon

1. /metrics expose
2. Prometheus scrape
3. Grafana dashboard (pre-built)
4. Alertmanager → Slack/PagerDuty
5. 3+ gün metric retention
