#!/usr/bin/env bash
set -euo pipefail
# Pauses all app financial writes for a consistent M0 logical dump.
active_services=()
for service in tamiltrade-api tamiltrade-voice; do
  if systemctl is-active --quiet "$service"; then active_services+=("$service"); fi
done
resume_services() {
  if ((${#active_services[@]})); then systemctl start "${active_services[@]}"; fi
}
trap resume_services EXIT
if ((${#active_services[@]})); then systemctl stop "${active_services[@]}"; fi
runuser -u tamiltrade-backup --preserve-environment -- /opt/tamiltrade/current/infra/backup/backup.sh
