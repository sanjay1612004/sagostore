# Oracle deployment record — 2026-10-22–2026-10-23

Status: backend deployed over public HTTPS; API, Atlas, and cloud voice worker
are online. Mobile configuration points to Oracle. The user confirmed the
Expo phone checks are working; installed-APK acceptance and backup setup remain.

## VM

- Name: `tamiltrade-backend`; Phoenix, AD-1.
- Public IPv4: `132.226.103.170`; private IPv4: `10.0.0.48`.
- Ubuntu 22.04 ARM64; `VM.Standard.A1.Flex`, 1 OCPU, 6 GB RAM.
- VCN: `tamiltrade-vcn`; subnet: `tamiltrade-public-subnet`.
- SSH connection succeeded after the internet gateway route was added.
- API address: `https://tamiltrade-132-226-103-170.sslip.io`.
  This uses external sslip.io DNS and depends on keeping the same public IP.

## Completed on the VM

- Installed Node.js 24.22.1 (official ARM64 archive, SHA-256 verified),
  npm 11.19.1, FFmpeg 4.4.2, Caddy 2.11.7, and build prerequisites.
- Created non-login service user `tamiltrade`, protected environment directory
  `/etc/tamiltrade`, and audio/invoice directories under `/var/lib/tamiltrade`.
- Uploaded tracked working-tree source (including pending speech changes) to
  `/opt/tamiltrade/releases/20261022-initial`. Local credentials, recordings,
  node_modules, Git metadata, and workstation binaries were excluded.
- Installed locked dependencies and licensed invoice fonts on ARM64.
- `npm run check` passed: all workspace type checks, 269 unit tests across
  18 files, and the shared/server build. Two route segment accesses now use
  `.at(1)` so type checking also works without the local generated Expo cache.
- Installed and validated API and voice systemd unit definitions.
- After explicit user approval, securely transferred the existing Atlas
  credentials and configured Sarvam/Groq/Gemini keys to
  `/etc/tamiltrade/server.env` (`root:tamiltrade`, mode `0640`). Secret values
  were not logged. Created fresh distinct JWT secrets and disabled registration.
- Confirmed Atlas connectivity from Oracle and zero pending voice jobs during
  the preflight. User chose to retain the existing `tamiltrade_dev` database
  and records. No further Atlas access-list change was required for connectivity.
- Activated `/opt/tamiltrade/current`, enabled and started `tamiltrade-api`.
  `http://127.0.0.1:5000/health/ready` returned `{"status":"ready"}`.
- Verified native ARM64 password hashing and audio/invoice directory permissions.
- Prepared `/etc/caddy/Caddyfile` and the Caddy service drop-in setting
  `API_DOMAIN`; Caddy configuration validated and was loaded on continuation.
  Caddy is active and listening on TCP 80 and 443.
- Allowed TCP 80/443 in the VM's existing iptables rules and persisted them.
  Existing Oracle instance-service rules and SSH access were retained.

## Go-live verification — 2026-10-23

- User added the correct stateful OCI ingress rules for TCP 80 and 443.
- Retried Caddy certificate issuance after opening the ports. Let's Encrypt
  issued a certificate; public HTTPS passed normal CA and hostname validation.
- Public `/health/ready` returned HTTP 200 and `{"status":"ready"}`.
  HTTP redirects to HTTPS. Unauthenticated `/api/voice/config` returns HTTP 401.
- Confirmed zero pending recordings and no local API/voice-worker processes
  before enabling and starting `tamiltrade-voice` on Oracle.
- API, voice worker, and Caddy are enabled at boot. The worker heartbeat was
  current and reported online; speech provider is Sarvam.
- Groq accepted its configured key (HTTP 200) and listed the selected command
  model. A one-second generated silent WAV was accepted by Sarvam and returned
  `NO_SPEECH`, as expected. No user's recording or financial command was used.
  This checks provider access; real Tamil/name recognition needs a phone test.
- Restarted API and worker and verified readiness, service activation, and boot
  enablement. Rebooted the VM and confirmed automatic recovery: public HTTPS
  returned ready, all three services were active/enabled, and the worker
  heartbeat was current after boot.
- Updated ignored `mobile/.env` with the Oracle HTTPS address for native and
  web; retained the previous values in ignored `mobile/.env.before-oracle`.
- Started Expo Go in watch mode on LAN port 8081 with a cleared cache. Android
  manifest and bundle both returned HTTP 200, and the bundle includes the
  Oracle address. Current Expo URL: `exp://10.253.141.72:8081` (LAN-specific).
  QR image: ignored `data/deployment/expo-go-qr.png`.

## Phone connection

Keep the computer and phone on the same Wi-Fi while loading this Expo bundle.
The backend itself runs on Oracle. Existing local-session tokens may need a
fresh phone connection because the cloud deployment uses fresh JWT secrets.
Connection codes expire after ten minutes; do not save them in this document.
A fresh code was generated for the sole active owner after the reboot check;
the code was delivered only in the private conversation. The database stores
its hash and the normal device-connection audit event.

For later administrative code generation, run from the release's `server`
directory on Oracle, substituting the existing account's email:

```bash
sudo -u tamiltrade /usr/bin/node --env-file=/etc/tamiltrade/server.env \
  --import tsx scripts/connect-phone.ts owner@example.com
```

## Follow-up

1. The user reported on 2026-10-23 that the requested app checks were working
   in Expo, including voice and existing records. Repeat acceptance with the
   installed APK, including mobile data with the Expo server stopped.
   The corrected [Android preview build](https://expo.dev/accounts/sanjaybalajik/projects/tamiltrade-ai/builds/d108b8b4-862f-403c-ab04-94bc24928cd3)
   finished successfully on 2026-10-23; see [mobile build notes](MOBILE.md).
2. Configure encrypted database backups, a separately controlled backup
   destination, and an isolated restore check. Backups are not configured yet.

No financial transactions were created during deployment checks. Normal API
index initialization and worker heartbeat/lease updates use the existing
database. Physical phone acceptance above is user-reported. No installed-APK
or backup/restore test is claimed.
