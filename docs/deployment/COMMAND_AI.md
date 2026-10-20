# Groq command understanding

Typed commands and speech transcripts use Groq's `qwen/qwen3.8-27b` model. It accepts Tamil, Tanglish, English and mixed-language commands, then returns a JSON extraction plan. Speech-to-text remains independently configured through Sarvam or local Whisper.

1. Create a Groq key at https://console.groq.com/keys on the Free plan.
2. Add it only to `server/.env` (or the production server environment):

```dotenv
GROQ_API_KEY=YOUR_SERVER_ONLY_KEY
COMMAND_AI_MODEL=qwen/qwen3.8-27b
COMMAND_AI_TIMEOUT_MS=25000
```

3. Restart the API and voice worker, then reload the app. Authenticated `GET /api/voice/config` exposes provider/model and key presence, never the key.

Groq's Free plan has rate and daily quotas. The app preserves the command and pending answers, shows a countdown, and disables further AI submissions/recording until the deadline. The API and worker each remember a configured-key/model cooldown after a provider rejection, using its retry/reset headers (60 seconds when unavailable). Instructions and recent context are compacted to reduce token usage; the full current command and pending input are retained. A quota failure after transcription stores `retryAt`; **Retry command** reuses that transcript. Provider quotas still apply and cannot be removed by app changes. There is no automatic paid-provider fallback or automatic retry. Review the [model documentation](https://console.groq.com/docs/model/qwen/qwen3.8-27b) and [current free-plan limits](https://console.groq.com/docs/rate-limits), as provider limits can change.

The service sends the original command, a bounded current-business catalog (names, aliases, IDs and product units), short recent context, and any selected purchase/sale IDs. API secrets and full financial ledgers are not sent. Keep the key out of mobile configuration, logs and source control.

Groq receives a strict JSON schema containing the supported intents and field types. Optional provider fields are required but nullable; nulls are removed before the server validates numeric/date fields, account roles, catalog IDs and source references. Duplicate saved names require account selection, and unknown names require clarification. It executes only predefined business-scoped reads and returns editable proposals. It never executes model-provided code, database filters or financial writes. Model extraction must be reviewed before confirming a transaction.

During development, `npm run dev -w server` watches and starts both the API and speech worker so typed and recorded commands use the same current extraction code. Use `dev:api` and `worker` only when running them deliberately in separate terminals. When transcription succeeds but understanding fails, the app preserves the transcript and offers **Retry command** to understand it again without another recording.

## Verification

`npm run check` covers structured extraction/validation and errors with controlled provider responses. `npm run test:integration` uses a temporary MongoDB replica and controlled Groq responses to verify isolation, lookups and zero automatic financial writes.

For a live check using fictional catalog entries, run from `server`:

```bash
RUN_GROQ_INTEGRATION=1 node --env-file=.env ../node_modules/vitest/vitest.mjs run tests/command-ai.integration.test.ts -t 'rate-limit screenshot|voice follow-up'
```

This makes two real requests: a mixed Tamil-English sale with missing details and a short follow-up reply. The complete suite has eight cases; select small groups with `-t` and respect provider reset periods to avoid exhausting the free token budget. These are smoke tests, not a general accuracy guarantee.
