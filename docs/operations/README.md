# Operations and recovery

## Monitoring

- Probe `/health/live` and `/health/ready` from your chosen monitor. Readiness performs a database ping; it does not assert that the speech model is healthy.
- Use `journalctl -u tamiltrade-api -u tamiltrade-voice` for structured events. Logs exclude request bodies, credentials, share tokens and transcripts. Speech service stdout/stderr is disabled because upstream logs can contain audio transcripts.
- Monitor CPU/RSS, free disk, audio-directory size, voice queue age/error rate, Atlas storage/connections, HTTP median/P95 latency and error rate. These are operational targets; no Oracle measurements are claimed yet.
- Keep the API responsive when speech is busy. If resource contention persists after benchmarking, isolate inference on another CPU service while preserving the queue/API contract.

## Backups

Create a separate read-only database backup credential and a root-owned `0640` mongodump config YAML readable by the backup user’s group with its `uri` (and password if required). Set `BACKUP_MONGO_CONFIG`, `BACKUP_AGE_RECIPIENT` and `BACKUP_DIRECTORY` in `/etc/tamiltrade/backup.env`. Keep the `age` private key **off the VM**. Install the backup service/timer only after verifying permissions and a manual encrypted backup.

The backup service calls `maintenance-backup.sh`: it records which API/worker services are running, stops them to pause app writes, runs the encrypted dump as the backup user, and resumes the previously active services through an exit trap, including on dump failure. This creates a brief maintenance window at the timer's scheduled time. Root owns this wrapper and the systemd unit; the backup credential itself remains read-only. Do not write through another database client during the dump. Copy encrypted archives and hashes to independent controlled storage; a backup remaining on the VM cannot recover a lost VM.

Restore only to an isolated `tamiltrade_restore` database using `infra/backup/restore.sh`, the offline age identity, and a separate scoped restore credential. Verify counts, invoice numbers, balances, stock movements and the core acceptance workflow. Record the restore duration and recovery point. Switch production only after reviewing the recovered state. Restoration has not been performed against your Atlas account.

## Account recovery

No mail delivery provider is configured and the UI does not pretend that a recovery email was sent. An administrator with verified server access can run:

```bash
npm run recover -w server -- owner@example.com
```

This emits one cryptographically random token, stores only its hash, and expires it after 15 minutes. Verify the account owner's identity and deliver the token privately. The app's recovery screen consumes it once; password changes revoke all sessions. Staff login and permission updates are controlled by the owner.

## Failure drills

| Failure                         | Expected action                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Atlas unavailable               | Readiness fails; financial requests show recoverable errors; no non-atomic fallback                         |
| API restarts after confirmation | Retry the same draft; existing record is returned                                                           |
| Worker dies                     | systemd restarts it; stale leased job becomes an error, audio is cleaned; re-record if needed               |
| Speech engine unavailable       | Jobs fail visibly; typed commands and manual trading remain available                                       |
| Disk full                       | Stop new uploads, free abandoned temporary files, verify health; never delete business records to free disk |
| Invoice link leaked             | Revoke or rotate that invoice's share token; old URLs stop working                                          |
| JWT secret compromised          | Replace secrets, revoke all sessions through a reviewed admin procedure, restart services, require sign-in  |
| Bad API deployment              | Activate the previous compatible release; verify health and acceptance workflow                             |
| VM lost                         | Rebuild pinned services, restore reviewed encrypted backup, update DNS/Atlas network access                 |

## Retention and deletion

Audio is temporary by default. Voice-job results expire after one day; conversation context after 30 minutes; expired sessions are removed by TTL. Confirmed financial records, invoice snapshots and audit trails are retained. Business deletion/export requires an owner-verified administrative procedure and a reviewed retention policy; a self-service deletion endpoint is not enabled.

Permissions should be reviewed before assigning genuine business access. Full server push delivery, SMTP/password recovery email, remote monitoring and independent backup storage remain account-specific integrations. Local payment notifications work only after device permission and explicit scheduling; balances in scheduled notification text are snapshots.
