# Phone unlock and one-time connection

The Android/iOS app has no email/password login form. A new phone connects once to an existing business account using a connection code. On subsequent openings and after leaving the app, it requires the phone's fingerprint, face unlock, or screen-lock PIN/pattern/password. Cancelling verification keeps business screens hidden. A phone without a screen lock must set one in the phone's Settings first. The app never asks you to type your phone PIN into its own form.

## Connect a phone

On an already connected device, open **Settings → Connect another phone → Create connection code**. Enter that code in the new phone's **Connect your phone** screen, then complete the system unlock prompt. Codes give the new phone the issuing account's business, role and current permissions; they do not create a new business or owner.

For the first phone, or when no connected device is available, the trusted server administrator can run this from the repository root with the existing account's email:

```bash
npm run connect:phone -w server -- owner@example.com
```

The command reads the server's `.env`, finds the active account, and prints a one-time code. Deliver it privately after checking the recipient's identity. Codes expire after 10 minutes, are stored only as SHA-256 hashes, and are atomically consumed once. Do not put codes or account credentials in mobile environment variables, tickets, or logs. Auth endpoints are rate limited and send `Cache-Control: no-store`.

Existing signed-in phones migrate after successful system unlock. They do not need to enter the account password or a code again while their existing session is valid. Expired/revoked sessions need a new connection code.

## Sessions and disconnection

The phone retains a rotating refresh credential in SecureStore; access tokens remain in memory and expire after 10 minutes. iOS storage uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The phone connection is long-lived (a maximum 3,650-day inactivity window renewed with each successful refresh), preventing the former 30-day account-password prompt. It can still be revoked immediately: every authenticated API request checks the server session and the user's current active status/permissions. The local OS unlock does not identify a business by itself and is not a replacement for server authentication.

Use **Settings → Connected devices → Disconnect** to revoke another device, or **Disconnect this phone** for the current phone. Server session revocation also invalidates pending codes created by that session. Password recovery and staff account changes revoke that account's sessions and pending connection codes. Disconnecting a device does not delete business records.

The browser retains account sign-in and in-memory credentials. It can be used to administer device connections; native device unlock is not available in the browser. Account creation and password recovery remain browser/admin workflows.

## Development and verification

Restart the API and reload Expo Go after updating. No new native package was added; existing `expo-local-authentication` and `expo-secure-store` supply device unlock/storage. Android Expo Go can exercise the phone flow. iOS Face ID needs a development/release build; it is not supported in Expo Go. See [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) and [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

Automated tests cover PIN-only devices, biometrics, cancellation/failure, background locking, one OS prompt at a time, no refresh before native unlock, credential/cache cleanup, code expiry/replay/concurrent consumption, tenant/role isolation, issuer revocation, migration, refresh beyond 30 days, and account recovery. Run `npm test`, `npm run test:integration`, and `npm run typecheck`. A physical phone still needs acceptance checks: cold launch, cancel/retry, PIN fallback, background/resume without losing an open form, reboot, offline retry and remote device disconnection.
