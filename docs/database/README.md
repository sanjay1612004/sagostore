# MongoDB collections

| Collection      | Purpose / principal indexes                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `businesses`    | Configurable identity, invoice prefix, specific-lot valuation, write serialization counter             |
| `users`         | Unique normalized email; business, role and permissions; Argon2id hash excluded from normal reads      |
| `sessions`      | Hashed rotating refresh token; user index; expiry TTL; immediate revocation                            |
| `recoveries`    | Hashed one-time administrator-issued recovery token; 15-minute expiry                                  |
| `contacts`      | Business + kind + name; customer/supplier aliases and credit limits                                    |
| `products`      | Unique business + name; configurable unit and integer gram weight                                      |
| `records`       | Immutable posted input and calculated amounts; business/date, contact/status and product/kind indexes  |
| `drafts`        | Unique business + user + idempotency key; pending/confirmed/cancelled state and explicit expiry checks |
| `movements`     | Append-only lot quantity movements and reversal entries                                                |
| `audits`        | Actor, action, entity and reason; business/time index                                                  |
| `counters`      | Unique business/year for atomic invoice numbering                                                      |
| `invoices`      | Unique business/sale and issued business/number; immutable snapshot; hashed expiring share token       |
| `voicejobs`     | Unique business/user/upload key; status/time queue; one-day TTL                                        |
| `conversations` | Unique business/user; expiring scoped context and bounded message history                              |

All financial writes use MongoDB sessions against a replica set. Index creation completes before the API begins listening. Never use an unreplicated standalone server for tests that claim transaction coverage.

Draft expiry is enforced in application code. Confirmed drafts are retained to keep retries idempotent; do not add a TTL that removes a confirmed draft while a client may retry. Audio paths are excluded from normal job reads and never returned to mobile. Business/customer details on an issued invoice come from the stored snapshot rather than live profile documents.

M0 is a capacity-constrained starting point. Monitor collection size, indexes, queue latency and data retention. Audio files and model binaries live on the VM, not in Atlas. Encrypted backup archives need an independent storage destination; the free cluster is not itself a backup strategy.
