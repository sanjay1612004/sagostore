# Shri Sai Ganesh Stores

A Tamil-first Expo trading app for **Shri Sai Ganesh Stores** with an Express API, MongoDB transactions, configurable cloud or local speech recognition, and invoice PDF sharing.

The header uses the full store name and the supplied Ganesha lotus emblem with a transparent background. The sun/moon button beside the home profile button switches between dark and light appearance and saves the preference. Branding assets, including the transparent master logo, launcher icon, Android adaptive foreground and browser favicon, are in `mobile/assets/branding`; [asset notes](mobile/assets/branding/README.md) describe the source and background-removal prompts. Reload Expo Go for interface changes; the installed app's launcher name/icon require a new native build.

**Status:** the core source and local automated workflows are implemented. This is not yet a deployed or device-accepted production release. No Atlas project, Oracle VM, API domain, or physical phone was supplied. See [delivery status](docs/testing/STATUS.md) for tested behavior and remaining requirements.

## Start development

Use Node **24 LTS**. This workstation originally had Node 25, so validation uses a temporary Node 24 runtime. Expo SDK 58's own dependency map determines native versions; `package-lock.json` pins the installed graph.

```bash
nvm install
nvm use
npm ci
npm run setup:fonts
cp server/.env.example server/.env
cp mobile/.env.example mobile/.env
```

1. Follow [Atlas setup](docs/deployment/ATLAS.md) to create a separate development database. Set `MONGODB_URI` in `server/.env`.
2. Generate two different secrets with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Put them in the two JWT variables. Keep them out of mobile configuration.
3. Set `REGISTRATION_ENABLED=true` only while onboarding an owner. Disable it after setup on a single-business deployment.
4. For local development, keep `EXPO_PUBLIC_API_URL=auto` and `EXPO_PUBLIC_WEB_API_URL=auto` in `mobile/.env`, use Expo's LAN connection, and connect the phone and computer to the same trusted Wi-Fi. The app uses the Expo computer's address on port 5000. `10.0.2.2` is only for the Android emulator. For USB development with an explicit `http://127.0.0.1:5000` API URL, run `adb reverse tcp:5000 tcp:5000`. Release builds and Expo tunnels require an explicit reachable HTTPS API URL.
5. The development server template sets `API_HOST=0.0.0.0` to accept local phone connections. Production uses `API_HOST=127.0.0.1` behind Caddy and HTTPS. Android local HTTP requires Expo Go or the development build's cleartext network policy.

```bash
# Terminal 1: starts both the API and speech worker
npm run dev:server
# Terminal 2
npm run dev:mobile
```

`npm run dev:server` (or `npm run dev -w server`) starts and watches both backend services together. If you deliberately run them separately, use `npm run dev:api -w server` and `npm run worker -w server`. The speech worker must stay running for recordings; typed commands need only the API. Worker availability is checked by a heartbeat, and the app explains when processing is offline instead of waiting silently.

Create a native development build using `cd mobile && npx expo run:android`. iOS requires macOS and Xcode: `npx expo run:ios`. Expo Go is not the acceptance target. [Release build instructions](docs/deployment/MOBILE.md) cover APK/AAB and iOS signing.

For a quick phone preview use `cd mobile && npm run go -- --lan`. For a laptop browser preview use `cd mobile && npm run web -- --clear`. The browser API URL is `EXPO_PUBLIC_WEB_API_URL` in `mobile/.env`; `auto` uses the browser's hostname on port 5000 during development. Stop an older Metro process before restarting. See [preview behavior and platform limits](docs/deployment/MOBILE.md#quick-previews).

## Verify the core workflow

Create the owner account, then add a supplier, customer, and product. Configure the product's unit and weight; the core accounting is commodity-independent.

1. Purchase **50 units at ₹3,200**, transport **₹2,500**. Review and confirm. Landed cost is **₹1,62,500**.
2. Sell **20 units at ₹3,500** from that purchase lot. Review and confirm. Revenue is **₹70,000**, allocated cost **₹65,000**, gross trading profit **₹5,000** before operating expenses, assuming zero configured output tax.
3. Create an invoice draft from the sale, review and issue it. Share its actual PDF using the native share sheet, or open a WhatsApp message with a one-day revocable PDF link.
4. Record a **₹20,000** customer payment against that sale. The customer's remaining receivable is **₹50,000**.
5. Switch a new purchase and sale to **direct delivery** to track mill-to-customer goods without changing warehouse quantity.

The voice tab uses **Groq Qwen 3.8 27B** to understand Tamil, Tanglish and English, classify questions/actions and extract transaction fields. The phrase parser has been removed. Examples: `Ramesh baaki evlo?`, `ABC Mill la irundhu aimbathu mootai Sago vaanginen, oru mootai vilai 3200`, and `Vishalukku pathu mootai kuduthen, oru mootaiyoda vilai 3000`. Groq resolves names against the current business's catalog. Ambiguous names and missing products, source lots or prices require clarification. All proposed financial actions remain editable and need explicit confirmation.

For an incomplete transaction, the assistant asks one missing detail at a time and reads the question in the selected app language. Tap **Reply by voice**, answer in Tamil, Tanglish or English, then tap **Finish reply**. Answers update the same pending transaction; you can give several details in one reply. Source lots and outstanding transactions have numbered choices that you can select by voice. Once complete, use **Review & save**, check the details, then **Confirm & save**. Speech output uses the device's available voices; the question remains visible if speech output is unavailable. **Hear the question again**, **Start over** and manual editing remain available.

Set the server-only `GROQ_API_KEY` from the Groq Free plan. Optionally add `GEMINI_API_KEY` from an AI Studio project with billing disabled: when Groq reaches its quota, the app switches once to Gemini Flash-Lite and returns to Groq after its cooldown. Both providers' quotas still apply. Commands, relevant catalog names/aliases and recent context go to the provider used; results identify Gemini backup use. All results pass the same server validation and explicit confirmation. [AI setup](docs/deployment/COMMAND_AI.md) includes configuration, testing and limits.

For mixed-language recordings, [speech setup](docs/deployment/SPEECH.md) covers Sarvam Saaras v4 cloud recognition and the local Whisper alternative. Cloud mode requires a server-side Sarvam API key and sends recordings to that service. Extracted values remain editable; voice never directly writes financial records.

For saved entries, ask `Kishore transaction details kaattu`, `Kishore ku evlo mootai kuduthen, athoda vilai enna?`, or the equivalent Tamil question. Confirm an uncertain account match using the lookup button. Results show up to 20 posted transactions with quantity, unit price, total and paid/balance details. “Gave/sold” asks for sales; “bought/vaanginen” asks for purchases. A missing sale is reported as missing, with an option to view all transaction types for that account. Explicit ISO dates and today/yesterday are supported.

## Checks

The interface uses a restrained charcoal-and-emerald palette inspired by the supplied Stitch reference, with a matching light appearance. Home prioritizes today's figures, three daily transaction actions, outstanding balances and recent activity. Detailed reporting remains available under Reports. More groups existing tools into Business, Insights and Manage. The voice screen asks one missing detail at a time, with spoken replies or tappable saved choices, followed by explicit review. Optional form details stay collapsed; review shows nonzero charges and tax. Charcoal is the default for new preferences; existing appearance choices are preserved. Change it under **More → Appearance & language → Appearance**.

```bash
npm run check
npm run test:integration
cd mobile
npx expo install --check
npx expo export --platform android
```

Integration tests run a temporary MongoDB **replica set solely for testing**, with real database transactions and HTTP requests. Development and production applications use Atlas. No sample transactions are automatically inserted into a business.

## Project map

| Directory            | Responsibility                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `mobile/app`         | Native routes, business forms, voice recording and sharing       |
| `mobile/components`  | Theme-aware reusable native components and Skia microphone       |
| `packages/shared`    | Zod contracts and API types                                      |
| `server/src/modules` | Auth, trading, reporting, Groq extraction/validation, invoices   |
| `server/src/workers` | Bounded audio-processing worker                                  |
| `speech`             | Pinned CPU build, verified model download and benchmark tools    |
| `infra`              | Oracle/Caddy/systemd templates, deployment and encrypted backups |
| `docs`               | Architecture, API, setup, operations and acceptance status       |

Read [architecture](docs/architecture/README.md), [API contracts](docs/api/README.md), [Oracle deployment](docs/deployment/ORACLE.md), and [recovery procedures](docs/operations/README.md) before using genuine business records. Production tax invoices require the business's actual current compliance fields; the implementation does not assign HSN codes or infer GST treatment.
