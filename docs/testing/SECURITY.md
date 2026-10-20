# Security validation and unresolved dependencies

The integration suite exercises unauthenticated and cross-business access, source/reference isolation, missing confirmation, duplicate confirmation, conflicting idempotency keys, cancelled/confirmed draft recovery, concurrent overpayment, staff mutation restrictions, malicious audio containers, refresh-token rotation/replay, and secure invoice link revocation.

Passwords use Argon2id. Financial mutations revalidate roles and business references on the server. Audio filenames are generated locally and never interpreted as shell arguments; subprocesses use `shell:false`. MIME, byte size, container signature, actual stream/duration and inference timeouts are checked at separate stages. Temporary audio is removed, and transcripts/secrets/share tokens are excluded from API logs.

The initial npm audit found two critical test-runner-related findings. Vitest was upgraded to the patched 4.1.12 line and those critical findings were removed. The full native tooling graph still reports high/moderate advisories, including `braces`, `node-forge`, and an older UUID dependency under Expo's Xcode tooling. The registry's suggested force fixes include incompatible Expo/React Native downgrades; those were not applied.

The separate backend production check, `npm audit --workspace server --omit=dev`, reported **0 vulnerabilities** on the validation date. The full workspace audit remained at **29 findings (21 high, 8 moderate, 0 critical)**. This describes the checked dependency graphs, not a guarantee of application security.

Do not interpret a successful bundle or tests as a clean dependency audit. Re-run `npm audit` before release, review advisory reachability and use compatible upstream patches or reviewed source fixes. The status report deliberately leaves production security acceptance open. Do not run development tooling as a publicly accessible production service.

No external penetration test, deployed rate-limit test, statutory invoice review, infrastructure recovery drill or physical-device security assessment has occurred. Record these alongside the exact release lockfile before production acceptance.
