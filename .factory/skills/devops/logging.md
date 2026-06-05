---
name: devops-logging
keywords: "log aggregation, loki, grafana, kibana"
description: "Log aggregation — Loki, ELK"
---

# Log Aggregation

## Loki + Grafana (önerilir)

Hafif, Prometheus-style query.

```yaml
services:
  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
    volumes: [loki-data:/loki]

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail.yml:/etc/promtail/promtail.yml
```

## promtail.yml

```yaml
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: [__meta_docker_container_name]
        target_label: container
```

Stdout log → Loki'ye.

## Grafana query

```logql
{container="backend"} |= "error"
{container="backend"} | json | level="error"
{container="backend"} | json | userId="123"
```

Filter, correlate.

## Retention

- Hot: 7 gün Loki
- Warm: 30 gün S3
- Cold: 1 yıl+ compliance için

## Alternatif: ELK

Elasticsearch + Logstash + Kibana. Daha güçlü ama kaynak yoğun.

## Aksiyon

- stdout/stderr JSON log
- Promtail → Loki scrape
- Grafana query
- Retention policy
