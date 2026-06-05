---
name: devops-backup
keywords: "backup, mongodump, restore, retention"
description: "DB backup + retention"
---

# Backup

## MongoDB backup

### mongodump
```bash
mongodump --uri="$DATABASE_URL" --archive=backup.archive --gzip
```

Compressed archive. Restore:
```bash
mongorestore --uri="$DATABASE_URL" --archive=backup.archive --gzip
```

## Otomatik daily backup

```yaml
# k8s CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongo-backup
spec:
  schedule: "0 2 * * *"  # her gün 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: mongo:7.0
              command:
                - /bin/sh
                - -c
                - |
                  mongodump --uri=$DATABASE_URL --archive=/tmp/backup.gz --gzip
                  aws s3 cp /tmp/backup.gz s3://acme-backup/$(date +%Y%m%d).gz
              env:
                - name: DATABASE_URL
                  valueFrom: { secretKeyRef: { name: backup-secrets, key: uri } }
          restartPolicy: OnFailure
```

## Retention

```
Son 7 gün: daily
Son 4 hafta: weekly
Son 12 ay: monthly
1+ yıl: yearly (compliance)
```

S3 lifecycle policy:
```json
{
  "Rules": [
    {
      "Status": "Enabled",
      "Expiration": { "Days": 365 },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ]
    }
  ]
}
```

## Encryption

```bash
mongodump --uri=... --archive | \
  openssl enc -aes-256-cbc -pass file:./backup-key > backup.enc
```

## Restore drill

Quarterly test: backup'tan staging'e restore, integrity check.

"Backup var ama restore edilemedi" klasik hatası.

## Aksiyon

1. Daily mongodump + S3 upload
2. Encryption at-rest
3. Retention policy
4. Quarterly restore drill
5. Offsite copy (farklı region)
