#!/usr/bin/env bash
set -euo pipefail
# Releases must be installed and validated on the VM before activation.
: "${1:?Usage: activate.sh /opt/tamiltrade/releases/RELEASE_ID}"
release_path="$(realpath "$1")"
[[ "$release_path" == /opt/tamiltrade/releases/* && -f "$release_path/server/dist/server/src/server.js" ]] || { echo 'Not a built release.' >&2; exit 1; }
previous_path="$(readlink -f /opt/tamiltrade/current || true)"
ln -sfn "$release_path" /opt/tamiltrade/current.next
mv -Tf /opt/tamiltrade/current.next /opt/tamiltrade/current
sudo systemctl restart tamiltrade-api tamiltrade-voice
for attempt in {1..10}; do
  if curl --silent --fail --max-time 3 http://127.0.0.1:5000/health/ready >/dev/null; then echo 'Release activated; API ready.'; exit 0; fi
  sleep 2
done
if [[ -n "$previous_path" ]]; then
  ln -sfn "$previous_path" /opt/tamiltrade/current
  sudo systemctl restart tamiltrade-api tamiltrade-voice
fi
echo 'Release failed readiness; previous release restored where available.' >&2
exit 1
