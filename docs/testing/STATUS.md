# Delivery and acceptance status

Implementation and local validation date: **16 October 2026**. This report separates source implementation from deployment and real-device acceptance. No entire phase is declared production-complete.

**Latest change, 19 October:** Groq Qwen 3.8 27B now interprets commands and transcripts. The rule parser and its obsolete tests were removed; the earlier parser follow-ups below are historical. See [Groq setup and free-tier limits](../deployment/COMMAND_AI.md).

**Form UX follow-up, 19 October:** Transaction forms now use visible, editable defaults, single-choice preselection only after complete option loading, collapsed optional details, direct payment entry and return-to-form contact/product creation. AI-supplied values are preserved; every financial write still requires review and explicit confirmation. See [smart defaults and validation evidence](../ux/SMART_DEFAULTS.md).

## Local evidence

| Check                                                        | Result                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Strict TypeScript across mobile, server and shared contracts | Passed                                                                                            |
| Financial and Tamil parsing unit tests                       | **21 passed**                                                                                     |
| Real MongoDB replica-set + Express integration tests         | **16 passed**                                                                                     |
| Real CPU Whisper / FFmpeg / background-worker integration    | **2 passed**                                                                                      |
| Express production compilation                               | Passed                                                                                            |
| Expo Android Hermes bundle export                            | Passed on Expo 58.0.12 / Router 58.0.21; four chosen font weights bundled                         |
| Expo iOS Hermes bundle export                                | Passed; native signing/device acceptance remains pending                                          |
| Invoice rendering                                            | Real PDF generated, rasterized and visually inspected; embedded Tamil text verified by extraction |
| Cloud deployment / Atlas live connection                     | Not run: infrastructure is not yet available                                                      |
| Physical Android / iPhone acceptance and installable release | Not run: device, native toolchain/signing and deployment configuration are not available          |

The speech tests use the upstream public English `jfk.wav` fixture. One confirms English transcription with the **multilingual** model. The other uploads that WAV through the actual API and worker with the app's `ta` language setting, verifies a transcript/parsed result, zero financial writes, and audio cleanup. These are pipeline tests, **not Tamil recognition accuracy measurements**. No synthetic transcript is represented as a trader's recording.

## Browser preview follow-up

The Metro web 500 was traced to a missing `react-native-web/dist/index` import. Expo-compatible `react-native-web`, `react-dom` and `@expo/metro-runtime` are now explicit dependencies. Browser-specific storage, date entry, SVG voice rendering, recording upload/cleanup and PDF downloads complement the native implementations.

Headless Chrome verified the login screen, empty-form validation and onboarding with no failed resources or JavaScript errors. Additional checks used a separate temporary MongoDB replica set and real Express endpoints to verify owner registration, live dashboard data, a typed stock query, browser date input, invoice issue and an actual `%PDF` download. They also verified that login credentials are absent from browser persistent storage and that reload returns to sign-in. No test accounts or financial records were written to the configured Atlas database.

The web production export and Android Hermes export both passed after these compatibility changes. The browser preview's in-memory session behavior and native-only biometric/reminder limits are documented in [MOBILE.md](../deployment/MOBILE.md#quick-previews). Microphone permissions/codecs and complete iOS behavior still require device/browser-specific acceptance.

## Phase-by-phase source delivery

| Phase                | Created source / working local coverage                                                                                                                                 | Acceptance still needed                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation         | Workspace, strict TS, Expo native routes, premium themes/components, licensed fonts, owner setup, Argon2id/JWT/rotating sessions, server-scoped permissions             | Actual Atlas setup, physical UI/accessibility assessment, full bilingual forms                                         |
| 2 Trading            | Customers/suppliers/aliases, configurable products/units, purchase/sale previews, explicit confirmation, specific-lot warehouse/direct delivery, ledgers and reversals  | Physical trader workflow; reservations, damage and partial-return accounting extension                                 |
| 3 Voice              | Expo Audio permission/record/upload states, real bounded MongoDB queue, persistent CPU whisper.cpp, FFprobe/FFmpeg, deterministic Tamil parsing, editable manual review | Real Tamil Base-vs-Small corpus, Oracle ARM64 latency and interrupted-device recordings                                |
| 4 Financial          | Exact paise calculations, landed cost allocation, payments, concurrent overpayment protection, outstanding balances, expenses, dashboard and monthly profit             | Reviewed historical data, advance payments, broader period/customer/product profitability views                        |
| 5 Invoices           | Draft/issue, atomic annual numbering, immutable snapshots, A4 table/amount words/Tamil PDF, native share code, expiring/revocable links                                 | Actual native WhatsApp/PDF sharing; multi-line invoices, credit notes and reviewed statutory GST/HSN fields            |
| 6 Intelligence       | Aliases and uncertain-match clarification, scoped expiring context, pending corrections, verified balances/stock/profit/price queries                                   | Wider colloquial/Tanglish/date grammar, supplier quotations, full comparison insights, optional TTS                    |
| 7 Oracle             | ARM64-compatible pinned build scripts, environment templates, Caddy, single worker/model services, deployment activation/rollback, encrypted maintenance-window backups | Provision eligible VM, domain/TLS, production Atlas connection, external backup destination and operational drills     |
| 8 Production quality | Local compilation, accounting/security/integration tests, queue limits, safe logs, paginated native lists, Android bundle validation                                    | Physical Android/iOS release tests, benchmarks, restore/reboot/TLS/rollback drills and remaining dependency advisories |

The app's menus expose implemented interactions. Unimplemented scope is listed here instead of being represented by success toasts, fake records or disconnected screens. Public registration is configurable; owner recovery uses an administrator-issued token rather than a nonexistent email integration.

## Browser warnings and voice polling follow-up

Removed a literal space rendered directly inside the transaction form's card. Browser selection and confirmation modals now use an HTML modal dialog with an inert background, keyboard focus containment, Escape dismissal and focus restoration; native platforms retain React Native Modal. Voice status polling has its own bounded server budget, respects the server's retry delay, stops on unrecoverable errors, and cancels pending requests/retries when the voice tab loses focus. Successful uploads no longer retain a retry reference to a deleted recording.

Validation: 40 backend unit/integration tests passed, including three regression tests using production voice rate limits. Strict mobile/server typechecks and an Android Hermes bundle export passed. Chrome checks against an isolated database passed account setup, typed commands, transaction dates, modal Tab/Escape focus behavior, invoice issuance and real PDF download, plus a real browser audio upload followed by an injected 429 to verify polling backs off and stops on navigation. No JavaScript exceptions, unexpected text-node warnings or aria-hidden focus warnings occurred in that run. Browser test records were confined to the isolated database. The local speech server and worker were also started, and two existing queued development jobs completed; no financial confirmations were performed.

## Reproduce checks

### Voice-screen background and composer (19 October 2026)

The voice screen now follows the supplied charcoal/blue-glow reference: an ambient SVG background, centered heading, compact blue microphone, rounded multiline composer with a send button, and three working command suggestions. The large microphone card is removed so the composer is visible above navigation at the supplied 1,325×654 desktop size. The dark appearance is labeled Charcoal blue; light appearance has a softer blue backdrop. Native and web share the same SVG microphone implementation.

Validation: mobile typecheck and Android Hermes export passed (3,788 modules). Isolated browser checks at 1,325×654, 390×844 and 320×740 found no horizontal overflow or console errors. English and Tamil headings fit, the microphone target remains about 69×69 px, and Tab reaches the send control. Suggestions fill the command field; lookup/account selection and quota-error text preservation passed with controlled responses. No speech recordings or live business writes were performed by these UI checks; physical-device visual acceptance remains pending.

### Visual refresh (19 October 2026)

The app now has violet/blue primary colors, mint/amber/coral financial summaries, a responsive dashboard, gradient revenue cards, clearer action tiles, a refreshed voice screen and consistent navigation, contact cards, toolkit tiles and sign-in styling. Fresh light is the default for new preferences; saved light/dark choices are respected, and the dark palette is now midnight violet.

Validation: workspace TypeScript checks and the Android Hermes export passed (4,045 bundled modules). Isolated Chrome checks used fictional API responses at 1,440 px, 390 px and 320 px widths, including light/dark themes, empty/populated dashboards, activity, contacts, voice, toolkit and sign-in. No console errors or horizontal page overflow occurred. Keyboard focus reached the command input. A sales-only staff fixture verified that report data and unavailable purchase actions stay hidden. The checks used an isolated browser profile and did not add data to the user's business. Physical-device visual acceptance remains pending.

### Groq replacement (19 October 2026)

Groq structured extraction is the only command-understanding path for typed input and speech transcripts. The server validates the model's intent, fields, entity roles and scoped references, then runs predefined business reads or returns an editable proposal. Provider failure never falls back to a phrase parser. Full financial writes still require explicit draft review and confirmation.

Validation: 116 unit tests, 20 isolated HTTP/database integration tests, and the server build passed. The exact daily-sales question was checked live against fictional catalog entries, including previous-account/purchase context. Sales-report regressions cover a misplaced read date, empty sales, dated/ranged totals including tax and business isolation. The strict-schema change was previously checked live with the English Kishore lookup and fictional supplier/pending-purchase context; mobile typechecks passed for its transcript retry change. Earlier live Groq examples covered a Tamil transaction question, a Tanglish sale, and a mixed Tamil-English purchase. These examples do not establish general model accuracy.

Queue follow-up: a stalled development worker was recovered and the waiting recording completed in 2.2 seconds of processing; this is a single observation, not a latency benchmark. The worker now bounds database waits, reconnects after network timeouts and can reacquire its own lease. The UI polls once per second and shows transcripts during understanding. Validation passed: 116 unit tests, 21 isolated integration tests (including exclusive lease recovery), mobile/server typechecks and the server build. The development queue was confirmed empty after recovery.

Groq Free-plan quotas and its data-processing terms apply. Sarvam speech fees remain separate; local Whisper is still available. No real user financial records are created by these checks.

### Tanglish follow-up (19 October 2026)

The typed-command and recorded-transcript parser now recognizes common Tanglish spellings, spoken number words and mixed Tamil/English unit prices. Regression cases include the reported sale phrasing, `Vishalukku pathu mootai kuduthen, oru mootaiyoda vilai 3000`, preserving quantity 10 and rate 3000 while asking for missing product/source details. Cross-script account names are suggestions unless an exact saved name or alias matches. Wider untested spellings, dates and colloquial grammar still require review.

Strict workspace typechecks, production compilation, 122 unit regression tests and 18 isolated MongoDB/HTTP integration tests passed. The HTTP coverage verifies Tanglish purchases/sales create neither financial records nor drafts and that a Tanglish profit follow-up retains the selected sale. No new speech accuracy claim is made by these text-parser checks.

### Transaction question follow-up (19 October 2026)

Questions such as “கிஷோருக்கு எவ்வளோ மூட்டை கொடுத்தேன் அதோட விலை என்ன details கொடு” now perform a saved-transaction lookup rather than a new entry. Tamil, Tanglish and English query tests preserve purchase/sale direction and explicit dates. Uncertain account matches have a selection button. Results list quantity, unit price, total, paid amount and balance, with links to the original records; a missing sale offers an explicit lookup across all transaction types.

Validation: 129 unit tests and 19 isolated database/HTTP integration tests passed, including selected-account business isolation, date filtering and zero financial writes or draft creation during queries. An isolated Chrome run with intercepted test responses verified Tamil input, account selection and detail rendering without console errors. This browser run used test responses and did not read or modify the user's business records. The parser still covers tested phrases rather than unrestricted conversation.

```bash
nvm use
npm ci
npm run setup:fonts
npm run check
npm run test:integration
cd mobile
npx expo install --check
npx expo export --platform android
```

For real speech tests, first build/download/start the speech engine as documented, install FFmpeg/FFprobe, then run from the root:

```bash
RUN_SPEECH_INTEGRATION=1 npm run test:speech
```

Use `FFMPEG_PATH` and `FFPROBE_PATH` for nonstandard executable locations. These tests start a separate temporary MongoDB replica and never connect to a production database. The downloaded engine/model and build tools are local artifacts, not committed assets.

## Manual acceptance checklist

1. Configure a separate Atlas dev project and HTTPS API, install the Android development build, create the owner and disable public registration afterward.
2. Verify Tamil shaping, mixed text, large numbers, light/dark preferences, font scaling, small-screen layout, safe areas and reduced motion.
3. Add a supplier, customer and product. Confirm the 50-unit purchase / 20-unit sale / ₹20,000 payment scenario from README. Verify stock 30, receivable ₹50,000 and gross trading profit ₹5,000 before operating expenses.
4. Confirm a direct-delivery purchase/sale and verify warehouse quantity is unchanged.
5. Record the real Tamil purchase command. Inspect transcription, account, quantity, unit rate and transport; correct an extraction error; confirm once; retry after a simulated lost response and verify only one record exists.
6. Try ambiguous accounts/prices, denied microphone permission, oversized/long audio, background interruption, queue congestion and a stopped speech server. Verify typed/manual fallback and no automatic money write.
7. Issue an invoice, inspect its actual PDF, open native sharing and manually send through WhatsApp. Revoke its link and verify the old link no longer opens. Edit the live customer profile and confirm the issued snapshot stays unchanged.
8. Test staff permissions, revoked sessions, expired access/refresh tokens, duplicate payments, insufficient stock, reversal dependencies and credit limits.
9. Schedule a local payment reminder and verify its delivery on the target OS. Check its snapshot amount against the ledger before collecting.
10. Deploy to Oracle, test HTTPS from the phone, reboot the VM, restart/kill services, simulate Atlas interruption, take/restore an encrypted backup and activate/roll back a release. Record actual results and timings.

Only after these checks and remaining scope are addressed should this be described as the complete production application requested in the master prompt.
