# Security review — OWASP ASVS L1 (M7)

Scope: `apps/api`, `apps/worker`, `packages/db`, shop back office. Method: code reading of the modules named below plus targeted tests.
Status legend: ✅ in place · ⚠️ gap noted (owner / next step) · 🔧 fixed in this review.

## V1 Architecture / V2 Authentication
| # | Check | Status | Evidence |
|---|---|---|---|
| 2.1 | Passwords hashed with a memory-hard KDF | ✅ | argon2id (`@coreup/db` `hashPassword`), Better Auth credential account |
| 2.2 | Brute-force / credential-stuffing limits | ✅ | `rateLimit`: 20/min per IP on `/v1/auth/*` POSTs (`middleware/rate-limit.ts`) |
| 2.3 | MFA for privileged users | ✅ | 2FA for owner/platform (`modules/security`) |
| 2.4 | Self-serve signup cannot mass-create shops | 🔧 | `POST /onboarding/tenants` limited to 5 attempts / account / 24 h (`modules/onboarding/routes.ts`), tested |
| 2.5 | Account enumeration | ⚠️ | Better Auth magic-link answers identically for unknown emails (documented in wave-1 report); sign-up reveals "email exists" — accepted for invite flow |

## V3 Session / V4 Access control
| 4.1 | Every route declares permission + module or `public`/`noTenant` | ✅ | `defineRoute` enforces at registration; all M7 routes declare them |
| 4.2 | Tenant isolation (IDOR) | ✅ | RLS on all tenant tables; `tests/tenancy.spec.ts` probes every id route (13 new M7 routes covered in `tests/tenancy/kpi.fixtures.ts`) |
| 4.3 | Tables **without** RLS are filtered by tenant in code | 🔧 | `vacation_tests`, `invoices`, `tenants` have no RLS (platform tables). Every M7 query filters `tenant_id`; the 404-first rule is tested (billing `sync` looked up the invoice *after* the payments check → fixed so another shop's id is a 404 either way) |
| 4.4 | Resource lookup before config/permission-dependent side effects | 🔧 | same fix as above; receipt/certificate endpoints load the row first |
| 4.5 | Branch-scoped members cannot read shop-wide numbers | ✅ | `kpi` service: scoped members get only their branches, never the tenant total; heatmap checks the branch is in scope |
| 4.6 | Sensitive reads are audited | ✅ | `customer.exported`, `customer.erased`, `billing.*`, `vacation_test.*` audit rows (append-only DB triggers) |

## V5 Validation / V12 Files
| 5.1 | All input validated by zod at the route | ✅ | `defineRoute` request schemas; ids are uuids |
| 5.2 | Spreadsheet formula injection in CSV exports | 🔧 | KPI CSV and PDPA customer CSV prefix cells starting with `= + - @` with `'` (tested with a hostile branch name and note text) |
| 5.3 | HTML injection in generated PDFs | ✅ | every interpolated value goes through `escapeHtml` (`lib/documents.ts`); worker renders with JS disabled and all network blocked |
| 5.4 | Download links | ✅ | presigned S3 URLs, 5 min, attachment disposition; job ids are tenant+purpose+refId checked (`getPdfJob`) |

## V6 Cryptography / secrets
| 6.1 | PII encrypted at rest | ✅ | phone/email AES-GCM (`@coreup/db` crypto); erase nulls ciphertext *and* the lookup hash |
| 6.2 | Payment card data never reaches the server | ✅ | Omise.js tokenises in the browser; API only sees `tokn_…` |
| 6.3 | Provider secrets only from env | ✅ | `OMISE_SECRET_KEY` / `OMISE_WEBHOOK_SECRET` never logged (pino redaction covers tokens); payment routes 503 when unset |

## V7 Errors / logging, V8 Data protection
| 7.1 | Error bodies leak no internals | ✅ | `ErrorBody` with request id; provider errors reduced to a code/message |
| 8.1 | PDPA export / erase / retention | ✅ | `GET /customers/:id/export`, `POST /customers/:id/erase` (typed-name confirmation + reason), nightly `retention.run` honouring `tenants.data_retention_days`; aggregates and append-only ledgers kept |
| 8.2 | Export responses not cached | ✅ | `Cache-Control: no-store` |
| 8.3 | Anonymous survey data never exposed below threshold | ✅ | eNPS KPI withheld unless ≥ 5 respondents (`meetsAnonymityThreshold`) |

## V13 API / webhooks
| 13.1 | Webhook authenticity | ✅ | Omise: HMAC-SHA256 over `timestamp.body` with constant-time compare, 5-minute replay window, rotation (comma-separated signatures); the body is only a hint — the charge is re-fetched from Omise and must match invoice id, tenant id, currency and amount before anything is settled |
| 13.2 | Idempotency of money paths | ✅ | `/billing/checkout` requires `Idempotency-Key`; `settleInvoice` locks the invoice row (`for update`) and is a no-op when already paid, so webhook replays and `/sync` cannot double-apply |
| 13.3 | Rate limits | ✅ | public 30/min/IP, user 600/min, tenant 3000/min; webhooks exempt (signature is the gate) |

## Findings still open
1. ⚠️ `audit_logs` and `outbox_events` have `tenant_id` but no RLS (DDL §9, already noted by DbCore): a tenant-context query could read another shop's rows if a handler forgot the filter. Billing's `chargeIdOf` filters `tenant_id` explicitly; recommend RLS read-policy on `audit_logs` (needs a migration — owner: Main).
2. ⚠️ `vacation_tests` and `invoices` likewise lack RLS; recommend the same policy or moving reads behind `SECURITY DEFINER` functions.
3. ⚠️ Omise webhook timestamp format is validated only when parseable (ISO or epoch); confirm against the live dashboard format when keys are issued.
4. ⚠️ Dependency audit (`pnpm audit`) and secret scanning belong in CI — not run here.
5. ⚠️ No automated DAST; run OWASP ZAP baseline against staging before launch.
