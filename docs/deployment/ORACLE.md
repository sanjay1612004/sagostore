# Oracle Ampere A1 deployment

These are general instructions and templates. See [the deployment record](ORACLE-STATUS.md) for the actual Oracle VM, live API address, verification, and remaining acceptance checks. Verify the **Always Free-eligible** designation and your tenancy's current limits in Oracle Console before creating resources. Oracle's current public Free Tier page lists 2 Ampere cores / 12 GB for the free allocation; older examples quoting 4 / 24 should not be treated as your entitlement. Capacity can be unavailable.

References: [Oracle Free Tier](https://www.oracle.com/cloud/free/), [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## VM and networking

1. In your home region create an eligible `VM.Standard.A1.Flex` Ubuntu LTS ARM64 VM within your actual free quota. Start with 2 OCPUs and 12 GB **only if the console confirms eligibility**. Keep the boot volume within free storage limits. Enable cost budgets/alerts in the account.
2. Create a reserved public IP and point your API domain's A record at it. Allow incoming TCP 80 and 443 in the OCI security list/NSG and host firewall. Restrict SSH TCP 22 to your administrative IP.
3. Keep ports 5000, 8080 and MongoDB ports private. The API and speech server bind to loopback. Atlas remains the database; install no production `mongod` on the VM.
4. Add the reserved VM egress IP to Atlas network access and use a database-scoped production account.

## Install and build

On the VM, use the official Node distribution/package instructions to install Node 24 LTS as `/usr/bin/node`. Install `build-essential`, CMake 3.20+, Git, FFmpeg and Caddy from supported repositories. Install MongoDB Database Tools and `age` for encrypted backups. Confirm ARM64 with `uname -m`; compile whisper.cpp on that VM rather than copying this workstation's x86 binaries.

Create a non-login `tamiltrade` service user, `/opt/tamiltrade/releases`, `/var/lib/tamiltrade/audio`, `/var/lib/tamiltrade/invoices`, and `/etc/tamiltrade`. Keep source/model paths owned by your deploy user; give the service user write access only to `/var/lib/tamiltrade`. Create a separate least-privileged backup user.

Upload the **source, lockfile, font licenses and infra templates**, excluding `node_modules`, `.env`, audio, tests' data and workstation binaries. In a versioned release directory:

```bash
npm ci
npm run setup:fonts
npm run check
# Copy fonts before pruning development/mobile dependencies if you choose to prune.
```

Build speech using [SPEECH.md](SPEECH.md); place its pinned checkout at `/opt/tamiltrade/whisper.cpp` and verified models at `/opt/tamiltrade/models`.

Copy `infra/oracle/server.env.example` to `/etc/tamiltrade/server.env`, supply real secrets, Atlas URI and domain, then set mode `0640` with root/service-group access. The two JWT secrets must be different and must not contain template values. Use absolute production audio/font/model paths. Environment files must never be served by Caddy or copied into the mobile build.

Create `/opt/tamiltrade/current` as a symlink to the built release. Copy the three service templates from `infra/systemd` to `/etc/systemd/system/`; confirm the `/usr/bin/node` path on your VM. Set `API_DOMAIN=api.your-domain.example` in the Caddy service environment and install the supplied Caddyfile. Validate configuration before restarting Caddy. Caddy obtains and renews TLS certificates when DNS and ports 80/443 are correct.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tamiltrade-speech tamiltrade-api tamiltrade-voice
sudo systemctl restart caddy
curl --fail https://api.your-domain.example/health/ready
```

Temporarily enable `REGISTRATION_ENABLED=true`, create the actual owner through the mobile app, then disable registration and restart the API. Staff accounts are owner-managed. Test the full workflow with designated acceptance records before using genuine balances.

## Resource and availability checks

Exactly one voice worker is configured. The persistent speech service uses two inference threads, a single processor, no GPU and no cross-recording audio context. CPU/memory limits are starting limits, not benchmarked Oracle guarantees. API readiness depends on Atlas, independently of speech readiness. Monitor voice job errors and queue delay; a busy or unavailable engine never triggers financial writes.

Set up encrypted backups and a restore drill before relying on records. Configure boot startup, check time synchronization, keep sufficient disk space for model upgrades and temporary audio, and verify reboot recovery. Free instances can be reclaimed or capacity-constrained; keep source, manifests, configuration and encrypted backups recoverable elsewhere.

## Deployment and rollback

Prepare and validate a release before running `infra/deployment/activate.sh /opt/tamiltrade/releases/RELEASE_ID`. It switches the symlink, restarts API/worker and polls readiness; it restores the previous release when readiness fails. This script does not provision resources or silently change database schemas. Index changes must remain compatible with the previous release if rollback is required.

Record deployment, TLS renewal, VM reboot, and rollback drill results in the deployment record or acceptance report. Do not infer completion from the template commands alone.
