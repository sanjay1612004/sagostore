#!/usr/bin/env bash
set -euo pipefail
umask 077
# Root-only environment file; mongo credentials never appear in CLI arguments.
: "${BACKUP_MONGO_CONFIG:?Set path to chmod 600 mongodump YAML config}"
: "${BACKUP_AGE_RECIPIENT:?Set age public recipient key}"
: "${BACKUP_DIRECTORY:?Set encrypted backup directory}"
command -v mongodump >/dev/null
command -v age >/dev/null
mkdir -p "$BACKUP_DIRECTORY"
backup_path="$BACKUP_DIRECTORY/tamiltrade-$(date -u +%Y%m%dT%H%M%SZ).archive.age"
mongodump --config "$BACKUP_MONGO_CONFIG" --archive --gzip | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$backup_path.partial"
mv "$backup_path.partial" "$backup_path"
sha256sum "$backup_path" > "$backup_path.sha256"
echo 'Encrypted database backup completed. Copy it to your separately controlled backup destination.'
