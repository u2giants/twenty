#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/worksp/twenty/fork/backups"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
FILENAME="twenty_nightly_${TIMESTAMP}.dump"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

docker exec twenty-postgres pg_dump \
  -U twenty \
  -d twenty \
  -Fc \
  -f "/tmp/${FILENAME}"

docker cp "twenty-postgres:/tmp/${FILENAME}" "${BACKUP_DIR}/${FILENAME}"
docker exec twenty-postgres rm -f "/tmp/${FILENAME}"

echo "Backup saved: ${BACKUP_DIR}/${FILENAME}"

# Prune backups older than KEEP_DAYS (nightly_* only, preserve manual dumps)
find "$BACKUP_DIR" -name "twenty_nightly_*.dump" -mtime +"$KEEP_DAYS" -delete
