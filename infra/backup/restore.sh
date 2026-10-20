#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_MONGO_CONFIG:?Set path to chmod 600 mongorestore YAML config for an ISOLATED database}"
: "${RESTORE_AGE_IDENTITY:?Set path to age private identity}"
: "${1:?Pass encrypted archive path}"
[[ "${CONFIRM_ISOLATED_RESTORE:-}" == 'yes' ]] || { echo 'Set CONFIRM_ISOLATED_RESTORE=yes after checking the isolated destination.' >&2; exit 1; }
age --decrypt --identity "$RESTORE_AGE_IDENTITY" "$1" | mongorestore --config "$RESTORE_MONGO_CONFIG" --archive --gzip --stopOnError --nsFrom='tamiltrade_prod.*' --nsTo='tamiltrade_restore.*'
echo 'Restore completed. Verify records and accounting invariants before recovery cutover.'
