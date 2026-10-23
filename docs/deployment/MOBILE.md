# Native Android and iOS builds

The primary interface is React Native/Expo, not a web dashboard. Use custom development builds. SDK 58 versions are checked against `expo/bundledNativeModules.json` and `npx expo install --check`.

## Quick previews

To open the native app in a compatible Expo Go on an Android phone, run `cd mobile && npm run go` and scan the QR code from Expo Go. Keep the laptop and phone on the same Wi-Fi. No local Android SDK is required for this preview; native development/release builds remain the target for full device acceptance.

If the phone reports **Project is incompatible with this version of Expo Go**, this project requires **Expo SDK 58**. Update Expo Go on the phone. If the Play Store build still does not support SDK 58, open [Expo's official Android download page for SDK 58](https://expo.dev/go?sdkVersion=58&platform=android&device=true) on the phone and install the matching build if available. See [Expo's version mismatch guide](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). If no compatible build is available, use the browser preview below or a native development build; changing only `sdkVersion` in the config does not make an older Expo Go compatible.

Stop the previous Metro server with Ctrl+C on the laptop, then run:

```bash
cd /home/dell/Documents/TamilAIApp/mobile
nvm use 24
npm run go -- --clear
```

Scan the newly printed QR code from Expo Go on the phone. Use `npm run go` for this preview: `npm start` and the root `npm run dev:mobile` explicitly select a custom development client, which requires your own installed development build. If the terminal reports `runtime 'custom'` while trying to open Expo Go, restart using the command above.

For the laptop browser, run:

```bash
cd mobile
npm run web -- --clear
```

Open the URL printed by Expo (normally `http://localhost:8081`). If an older Metro server is running in another terminal, stop it with Ctrl+C first. The browser dependencies are installed and pinned alongside the native app. Browser support uses the same API and business records; it does not insert demonstration data.

For local development, set both `EXPO_PUBLIC_API_URL=auto` and `EXPO_PUBLIC_WEB_API_URL=auto` in `mobile/.env`, and `API_HOST=0.0.0.0` in `server/.env`. Restart the API, then start Expo with `npm run go -- --lan --clear` (or `npm start -- --lan --clear` for your custom development client). Keep the phone and computer on the same trusted Wi-Fi. Native development reads the Expo LAN hostname; browser development reads the page hostname. Both use API port 5000. An explicitly configured API URL overrides discovery.

`10.0.2.2` reaches the computer only from the Android emulator. On a physical phone, verify the computer's API in the phone browser at `http://<computer-Wi-Fi-IP>:5000/health/ready`; it should show `{"status":"ready"}`. If it cannot open, check that the API is running with LAN binding and that both devices can communicate on the Wi-Fi network. Guest networks may isolate devices. For a phone **browser** preview, also add the browser's origin (for example `http://192.168.1.92:8081`) to `CORS_ORIGINS`. Native requests do not require CORS.

Release builds require an explicit HTTPS API URL in the build environment; `auto` is only supported in development. Expo's JavaScript tunnel does not expose the Express API. With a tunnel, configure a separately reachable HTTPS API URL.

The browser preview keeps login credentials in memory, so a full page reload requires signing in again. Theme/language preferences can persist in the browser. Native sessions still use SecureStore. Browser date entry and invoice PDF downloads have dedicated implementations; biometric unlocking and scheduled device reminders require the native app. Browser microphone access requires a secure context (localhost or HTTPS), permission, and a supported recording codec.

## Development

If `expo run:android` reports `spawn adb ENOENT` or a missing SDK path, install Android Studio and finish its SDK setup first. In **SDK Manager**, install Android SDK Platform **37**, Build-Tools **37.0.0**, Platform-Tools, Command-line Tools (latest), and Android Emulator. The pinned React Native toolchain also declares NDK **27.1.12297006** and CMake **3.30.5**; review/install native build dependencies through SDK Manager if Gradle requests them. These versions come from the installed project toolchain, rather than a generic SDK example.

Use the SDK location shown by Android Studio. For its default Linux location, run in the terminal where you build:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
sdkmanager --licenses
adb --version
```

Review and accept SDK licenses yourself where you agree. Create/start a virtual device from Android Studio's **Device Manager**, or connect an Android phone with USB debugging enabled and authorize the computer. `adb devices` must list an available device before installation. If SDK Manager shows a different SDK directory, replace `ANDROID_HOME` accordingly. See [Android SDK Manager](https://developer.android.com/tools/sdkmanager).

```bash
nvm use
npm ci
cp mobile/.env.example mobile/.env
# Set EXPO_PUBLIC_API_URL to the accessible HTTPS Express API.
cd mobile
npx expo run:android
npx expo start --dev-client
```

Local Android builds require JDK/Android SDK versions supported by the pinned Expo SDK. iOS requires macOS, the supported Xcode version and Apple signing for physical installation. `npx expo run:ios` builds the iOS development client.

## Installable builds

### Local Wi-Fi preview APK

An installed release APK bundles the API URL when built. Changing `.env` or restarting Expo does not update an APK already on the phone. For a local preview, set `EXPO_PUBLIC_API_URL=http://<computer-Wi-Fi-IP>:5000` in `mobile/.env` (for example `http://192.168.1.92:5000`). Set `API_HOST=0.0.0.0` in `server/.env` and restart the API. Verify `/health/ready` from the phone browser first. Keep the phone and computer on the same trusted Wi-Fi.

The `with-lan-api` config plugin permits Android HTTP only to that configured private IPv4 host in release previews; HTTPS deployments have no HTTP exception. The debug resource keeps Metro development connections working. Regenerate Android configuration whenever the API host changes, then rebuild:

```bash
cd mobile
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

Install `mobile/android/app/build/outputs/apk/release/app-release.apk` on the phone. This generated project currently uses the local debug signing key for release previews; use your own signing configuration for distribution. An existing installation signed with a different key must be updated using that original signing key. `auto` requires Metro development metadata and cannot be used in an installed standalone release APK. To use the app away from this Wi-Fi, build against a deployed HTTPS API.

### Distribution builds

Use your own Expo account/project and signing credentials. The checked-in `eas.json` provides development, preview APK and production AAB profiles:

The `preview` profile is configured with Node 24 and the live Oracle HTTPS API
address in its public build environment. It creates an installable release APK
with the JavaScript bundle included, so running Metro or Expo Go is unnecessary
after installation. The `production` profile still requires its own explicit
API environment configuration before a Play Store build.

For the Oracle-connected Android APK, run from `mobile`:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Use your own Expo account, select Android during configuration, and allow EAS
to generate a new Android signing keystore for this app's first distribution
build. If a distribution keystore already exists for this package, retain it
for subsequent updates. Open the completed build's APK link on your phone and
install it. Connect the installed app to your existing business using a fresh
one-time phone connection code, then verify speech and records on mobile data
with the computer's Expo server stopped. Download an APK only after its EAS
build reports `FINISHED`.

Other build profiles:

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

EAS build availability, quotas and Apple developer requirements depend on your accounts. A mandatory paid AI service is not introduced by the app. You can use locally generated native projects and Gradle/Xcode instead of EAS hosting. Set `EXPO_PUBLIC_API_URL` in the chosen build environment; EAS cloud builds do not magically receive your ignored local `.env` file.

Expo public variables are bundled and visible. Include only the API URL. Never include Atlas, JWT, cloud, email or invoice signing secrets. The app bundles licensed Inter and Noto Sans Tamil fonts and uses dark mode by default, with a persisted light preference.

The exported Android Hermes bundle is a compile check, **not an APK** and not a substitute for physical-device tests. Test microphone permissions, a real Tamil recording, background interruption, an expired session, query reload, confirmation retries, PDF rendering and actual native sharing on Android. Verify iOS separately before shipping an iOS release.

### Android native build failure on 2026-10-23

The first EAS preview build failed in Skia's CMake compilation with the compiler
reporting `Killed`. Skia was an unused direct dependency: the microphone uses
SVG and Reanimated, and the charts do not depend on Skia. Removed Skia and its
otherwise unused packages from the mobile manifest and lockfile. No other
dependency versions changed. Mobile type checking and the production Android
Hermes export passed; Android autolinking no longer includes Skia. A fresh EAS
preview build verified the full native APK after this change.

The replacement build completed successfully (`FINISHED`) on 2026-10-23:
[EAS build d108b8b4-862f-403c-ab04-94bc24928cd3](https://expo.dev/accounts/sanjaybalajik/projects/tamiltrade-ai/builds/d108b8b4-862f-403c-ab04-94bc24928cd3).
[Download the preview APK](https://expo.dev/artifacts/eas/7GU1HeI4cGPbOGZlXh5-HFpIaGuNPXMlJKnKk2Nb4cg.apk).
It uses the existing Expo-managed Android signing credentials and Oracle API
configuration. The APK artifact returned HTTP 206 for a ranged download and
had the expected ZIP/APK file signature (105,263,704 bytes). Physical
installation subsequently revealed an immediate startup crash. A successful
cloud build does not establish that the installed app runs correctly.

### Standalone Android startup investigation on 2026-10-23

Both the original APK and a later preview APK from the newly linked Expo team
project closed on launch. Reproduced a JavaScript startup failure in
`mobile/services/api.ts`: React Native defines `window`, but an embedded release
bundle can have no `window.location`. Reading `window.location.hostname` during
module initialization then throws before the root layout can show an error.
Expo Go can mask this because its bundle is served from Metro and has a location.

Read the hostname only on web, with an optional location check. A regression
test imports the actual API module with `__DEV__ = false` and `window = {}`;
it failed with the hostname TypeError before the fix and passes afterward.
All 19 API startup/discovery tests, the mobile type check, and the production
Android Hermes export pass. Replacement preview build
[dc9499cb-5a25-4282-bb46-cfa7add98426](https://expo.dev/accounts/sanjaybalajiks-team/projects/sri-sai-ganesh-stores/builds/dc9499cb-5a25-4282-bb46-cfa7add98426)
completed successfully with the existing team project's signing credentials
and Oracle API environment. USB debugging on the connected OnePlus phone confirmed the same
fatal JavaScript error: `Cannot read property 'hostname' of undefined` in the
installed app's AndroidRuntime log.

[Download the corrected APK](https://expo.dev/artifacts/eas/y4S0j3N3ZJ8JZXUsodKWH2WFXdHArfhFchsgFQcN02o.apk).
Installed it with `adb install -r` successfully on the connected OnePlus Nord 5
(Android 16), retaining app data. Two cold launches succeeded. The app displayed
the **Connect your phone** screen; after the second launch its process remained
running in the foreground for at least 15 seconds with no AndroidRuntime or
ReactNativeJS errors. Phone connection and business workflows in this APK remain
to be tested after entering a fresh one-time connection code.
