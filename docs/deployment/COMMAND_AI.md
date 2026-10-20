# Command understanding with quota fallback

Typed commands and speech transcripts use Groq's `qwen/qwen3.8-27b` model first. An optional Gemini `gemini-3.5-flash-lite` backup handles commands when Groq reports an exhausted quota. Both accept Tamil, Tanglish, English and mixed-language commands, then return a JSON extraction plan. Speech-to-text remains independently configured through Sarvam or local Whisper.

1. Create a Groq key at https://console.groq.com/keys on the Free plan.
2. Add it only to `server/.env` (or the production server environment):

```dotenv
GROQ_API_KEY=YOUR_SERVER_ONLY_KEY
COMMAND_AI_MODEL=qwen/qwen3.8-27b
COMMAND_AI_TIMEOUT_MS=25000
# Optional backup: use an AI Studio project with billing disabled.
GEMINI_API_KEY=YOUR_SERVER_ONLY_GEMINI_KEY
GEMINI_FALLBACK_ENABLED=true
GEMINI_COMMAND_AI_MODEL=gemini-3.5-flash-lite
```

3. Create the optional backup key at https://aistudio.google.com/api-keys. Keep Gemini billing disabled and Groq on its Free plan; provider account billing determines whether requests incur charges. Model selection alone cannot enforce free billing. Omit `GEMINI_API_KEY` or set `GEMINI_FALLBACK_ENABLED=false` to disable switching.
4. Restart the API and voice worker, then reload the app. Authenticated `GET /api/voice/config` exposes primary/backup provider, model, enabled status and key presence, never credentials. Command results identify the provider actually used; the app labels results understood by the backup.

Both providers have rate and daily quotas. A Groq HTTP 429 (or a still-active quota cooldown) switches once to the configured Gemini backup using the same full current command, catalog and pending answers. Later commands skip Groq during its cooldown and return to it after that deadline. Switching does not occur for bad credentials, invalid AI output, safety refusals, network failures or timeouts. There is at most one call per provider for a command, sharing the existing 25-second timeout budget.

If both quotas are exhausted, the app preserves the command and pending answers, shows a countdown to the earliest provider retry time, and disables AI submissions/recording until then. The API and worker each remember provider/key/model cooldowns using retry/reset metadata (60 seconds when unavailable); these are process-local and are not an account quota meter. Instructions and recent context are compacted to reduce token usage; the full current command and pending input are retained. A quota failure after transcription stores `retryAt`; **Retry command** reuses that transcript. Switching cannot bypass either provider's quotas, and the service never changes billing plans. Review [Groq free-plan limits](https://console.groq.com/docs/rate-limits), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [your Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits), as availability can change.

The service sends the original command, a bounded current-business catalog (names, aliases, IDs and product units), short recent context, and any selected purchase/sale IDs to Groq, and to Google when Gemini backup is used. API secrets and full financial ledgers are not sent as model input. Keep keys out of mobile configuration, logs and source control. Google's free-tier data-use terms apply to backup requests; see its pricing page.

Both providers receive the same JSON schema containing the supported intents and field types. Optional provider fields are required but nullable; nulls are removed before the server validates numeric/date fields, account roles, catalog IDs and source references. Duplicate saved names require account selection, and unknown names require clarification. It executes only predefined business-scoped reads and returns editable proposals. It never executes model-provided code, database filters or financial writes. Model extraction must be reviewed before confirming a transaction.

During development, `npm run dev -w server` watches and starts both the API and speech worker so typed and recorded commands use the same current extraction code. Use `dev:api` and `worker` only when running them deliberately in separate terminals. When transcription succeeds but understanding fails, the app preserves the transcript and offers **Retry command** to understand it again without another recording.

## Verification

`npm run check` covers structured extraction/validation, quota switching, cooldowns, fallback errors and provenance with controlled provider responses. `npm run test:integration` uses a temporary MongoDB replica and controlled provider responses to verify isolation, lookups and zero automatic financial writes, including an HTTP command that switches from Groq to Gemini.

For a live check using fictional catalog entries, run from `server`:

```bash
RUN_GROQ_INTEGRATION=1 node --env-file=.env ../node_modules/vitest/vitest.mjs run tests/command-ai.integration.test.ts -t 'rate-limit screenshot|voice follow-up'
```

This makes two real requests: a mixed Tamil-English sale with missing details and a short follow-up reply. The complete suite has eight cases; select small groups with `-t` and respect provider reset periods to avoid exhausting the free token budget. These are smoke tests, not a general accuracy guarantee.
