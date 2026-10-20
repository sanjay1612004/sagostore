# API contracts

JSON errors use `{ "error": { "code": "…", "message": "…", "fields": [{"field":"unitPrice","message":"…"}] } }`. HTTP 401 requires session refresh/sign-in, 403 means insufficient permission, 409 means stale/conflicting state, and 422 means invalid business input. Lists use `{items,total,page,limit}` unless stated otherwise. Page size is capped at 100; the native lists paginate.

All `/api` requests require `Authorization: Bearer ACCESS_TOKEN`. Mutations never accept a business ID from clients. Request schemas live in `packages/shared/src/index.ts`.

Voice requests have separate per-IP one-minute budgets: 20 commands/uploads/cancellations and 120 valid job-status reads. Both remain subject to the global API limit. HTTP 429 returns a JSON error and `Retry-After`; CORS exposes this header to browser clients. The voice screen polls every second only while focused, displays the transcript during the understanding stage, honors `Retry-After` with a minimum one-minute pause for 429, retries transient failures at most three times, and stops polling on terminal job states or unrecoverable errors.

The worker publishes a heartbeat every five seconds; it is considered online when seen within 20 seconds. Authenticated voice configuration includes `worker: {online,lastSeenAt}` independently of provider key readiness. Queued job responses include `queue: {workerOnline,waitedSeconds}`. Offline queues are polled every five seconds and shown as safely queued with a cancellation option. New uploads receive `503 VOICE_WORKER_OFFLINE` while processing is offline, preserving the device recording for retry; accepted idempotent uploads still return their existing job. A healthy-but-busy queue is distinguished from an offline worker. Development startup now launches the API and worker together with `npm run dev -w server`.

| Method / route                                        | Behavior                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /auth/register`                                 | Transactionally create owner/business when registration is enabled             |
| `POST /auth/login`                                    | Argon2id login and device session                                              |
| `POST /auth/refresh`                                  | `{refreshToken}` → rotated credentials                                         |
| `POST /auth/recover`                                  | `{token,password}` consumes administrator-issued one-time token                |
| `GET /auth/me`, `POST /auth/logout`                   | Inspect account / revoke current session                                       |
| `GET /auth/sessions`, `DELETE /auth/sessions/:id`     | Inspect / revoke own devices                                                   |
| `GET, POST /auth/staff`, `PATCH /auth/staff/:id`      | Owner staff management; changes revoke staff sessions                          |
| `GET, PATCH /api/business`                            | Read business / owner update                                                   |
| `GET, POST /api/contacts`                             | Paginated contacts; `kind`, literal escaped `search`                           |
| `GET, PATCH /api/contacts/:id`                        | Scoped contact read/update                                                     |
| `GET /api/contacts/:id/ledger`                        | Paginated transaction-derived ledger and full balance                          |
| `GET, POST /api/products`                             | Configurable trading units and weights                                         |
| `GET /api/records`                                    | Paginated activity; `kind`, `contactId`, `from`, `to` filters                  |
| `GET /api/records/:id`                                | Calculated transaction and confirmation input                                  |
| `POST /api/drafts`                                    | Validate/preview input; **UUID Idempotency-Key header required**               |
| `PATCH /api/drafts/:id`                               | Cancel old pending preview and create revised preview with new UUID key        |
| `POST /api/drafts/:id/confirm`                        | `{confirm:true}`; atomic idempotent financial commit                           |
| `DELETE /api/drafts/:id`                              | Cancel pending preview                                                         |
| `POST /api/records/:id/reverse`                       | Owner reversal with `{reason}`; preserves original record                      |
| `GET /api/inventory`                                  | Paginated lots; optional `productId`; warehouse/direct quantities distinct     |
| `GET /api/inventory/products`                         | Product stock totals and low-stock thresholds                                  |
| `GET /api/inventory/:id/movements`                    | Paginated lot movements                                                        |
| `GET /api/dashboard`                                  | Actual current-month metrics and daily trend; reports permission               |
| `GET /api/prices`                                     | Latest 200 actual purchase prices; optional `productId`                        |
| `GET /api/reminders`                                  | Up to 100 due/overdue balances                                                 |
| `GET /api/audit`                                      | Owner-only paginated audit history                                             |
| `POST /api/voice/text`                                | `{text}` → intent, editable input, missing fields, candidates, verified answer |
| `POST /api/voice/jobs`                                | Authenticated multipart `audio`; UUID Idempotency-Key; 202 job ID              |
| `GET, DELETE /api/voice/jobs/:id`                     | Own processing status/result or cancellation                                   |
| `GET /api/voice/history`, `DELETE /api/voice/context` | Own recent conversation / clear context                                        |
| `GET, POST /api/invoices`                             | Paginated invoices / create draft `{saleId}`                                   |
| `POST /api/invoices/:id/issue`                        | `{confirm:true}`; atomic number and immutable snapshot                         |
| `GET /api/invoices/:id/pdf`                           | Authenticated real PDF                                                         |
| `POST, DELETE /api/invoices/:id/share`                | Create/rotate one-day token / revoke links                                     |
| `POST /api/invoices/:id/cancel`                       | Owner cancellation with reason; does not reverse sale                          |
| `GET /share/:token`                                   | Public bearer capability; issued/unexpired/unrevoked PDF only                  |
| `GET /health/live`, `GET /health/ready`               | Process liveness / database readiness                                          |

## Purchase preview example

```json
{
  "kind": "purchase",
  "contactId": "SUPPLIER_OBJECT_ID",
  "productId": "PRODUCT_OBJECT_ID",
  "quantity": 50,
  "unitPrice": "3200",
  "transport": "2500",
  "date": "2026-10-16",
  "delivery": "warehouse"
}
```

Money inputs are nonnegative rupee strings with no more than two decimals. Calculated totals, costs and balances are integer paise. `taxBps` is integer hundredths of a percent; no tax is inferred. Sale `sourceId` selects a purchase lot. Payment `sourceId` selects the exact sale/purchase being settled. New business data must be created through its authenticated endpoints; example IDs are documentation only.

Transaction-detail questions return `GET_TRANSACTION_DETAILS` with `answer.records` (latest 20 posted entries, scoped by business and selected account). Each summary includes record ID, kind, date, quantity, unit-price rupee string, total paise and paid paise. `POST /api/voice/text` accepts optional `contactId` only for this lookup intent, allowing the user to select an uncertain candidate. The ID must belong to the current business, and reports permission is required. Questions do not create drafts or financial records. Parsed purchase/sale direction, a recognized product and explicit ISO date/today/yesterday constrain the lookup; an uncertain product requires clarification.

Commands and recording transcripts use Groq structured extraction and server validation. Results identify `understanding.provider = "groq"`. `GET /api/voice/config` includes `understanding: {provider,model,ready}` without credentials. Missing AI configuration, rejected key/model, free quota exhaustion, timeout and malformed output return safe `AI_*` errors; no legacy phrase-parser fallback is used. See [AI setup](../deployment/COMMAND_AI.md) for free-tier and data-processing terms.

Provider HTTP 429 becomes `AI_RATE_LIMIT` with `Retry-After`: the maximum applicable provider wait/reset duration, or 60 seconds when absent. Each API/worker process remembers that configured-key/model cooldown and rejects new AI calls locally until it expires. Other processes or applications using the same organization can still consume its quota. A failed recording retains its transcript and, when available, an absolute `retryAt` deadline. The voice screen disables AI submission and recording during the countdown, preserves pending answers, and retries the transcript through the text endpoint without repeating transcription. There is no automatic retry loop. The model receives compact instructions, at most two shortened recent messages, and the complete current command and pending input; UI-only question metadata is omitted.

Incomplete write commands also return `followUp: {id,field,question,questionTamil,choices:[{value,label}]}` and `summary` with resolved account/product/source labels. The same expiring per-user conversation stores the pending input, question and displayed source IDs. Both typed replies and recording transcripts use that context; Groq extracts `UPDATE_PENDING_DRAFT` changes and the server merges validated fields. A spoken source option is resolved only against eligible, business-scoped posted transactions. Changing the product, delivery or payment account clears incompatible allocations. Collecting answers creates no financial record or preview. The completed input still goes through `POST /api/drafts` and explicit confirmation. Cancel/start-over and successful confirmation clear the pending follow-up.

For a schema-valid write proposal with an invalid account/product/source reference, the server removes the rejected reference and asks for that field while preserving valid quantities and prices. Each reference category can be cleared at most once; validation runs locally without another model request. No rejected ID is retained and the proposal cannot be previewed until the user resolves it. Null optional input/query containers are treated as empty, and null candidate/clarification lists as empty lists. Malformed JSON, incompatible reports and unsafe query references still fail validation. Failure logs include only the validation category, never the command or raw provider response.

Sales-total questions return `GET_DAILY_SALES`. Its `query.date` or `query.from`/`query.to` selects ISO dates; the default is today in Asia/Kolkata. The server sums posted sales for the authenticated business, optionally scoped by a validated account/product, and returns `answer.salesTotal` in paise, `salesCount`, date bounds and display text. Totals include output tax and exclude payments, purchases and reversed records. A provider's misplaced `input.date` is moved to the read filter when consistent; conflicting dates are rejected.
