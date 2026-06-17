# DESIGN.md — Pricing Catalog Service

> **Status:** Final

---

## 1. Data Model

### 1.1 Overview


| Entity | Purpose |
|--------|---------|
| `PricingCatalogVersion` | Per `(craftsmanId, trade)`. `DRAFT` (mutable) or `PUBLISHED` (immutable, audit-readonly). `effectiveFrom`, `publishedByUserId` (JWT), optional `effectiveUntil`. |
| `CatalogPosition` | Line item: `key`, label, `unit`, `netPrice` (cents), `vatRate`, optional min/max quantity, `attributes` (jsonb). |
| `PositionSurcharge` | Per position: `key`, label; **either** `flatAmount` (cents) **or** `percentageRate` (exactly one, DB `CHECK`). |
| `CatalogDiscount` | Per version (0..n): `key`, label; **either** `flatAmount` or `percentageRate` (exactly one); optional `cap` (cents, only when %). `appliesTo`: `'subtotal'` or `{ positionKeys }`. |

`PricingCatalogVersion` 1→n `CatalogPosition` 1→n `PositionSurcharge`; 1→n `CatalogDiscount`. Children writable/deletable only under a `DRAFT` parent; `PUBLISHED` trees are read-only.

Flat vs. percentage on surcharges and discounts: two nullable columns (`flat_amount`, `percentage_rate`); Postgres `CHECK` enforces XOR. DTO/service validates before write and returns `400` on violation.

`pricingSchema` lives in **`TradeConfig.metadata.pricingSchema`** (`{ fields: [...] }`) — no extra column. Read via `GET /trades/:trade`, updated via `PATCH /trades/:trade` (ADMIN).

### 1.2 Trade-Specific Attributes (Variability)

**Storage representation:** `jsonb` column `attributes` on `CatalogPosition`, validated against `TradeConfig.metadata.pricingSchema`.

**Why this choice:**

- Matches the sandbox: `TradeConfig` already has a `metadata` jsonb bag; admin-portal and tests already expect `metadata.pricingSchema`.
- Trade schemas evolve independently — a rigid column-per-attribute model would require migrations per trade.
- The challenge requires a pure-function validator anyway; jsonb keeps storage simple while validation enforces structure at write time.

**Validation:** Pure function `validatePositionAttributes(schema, attributes) → ValidationResult`. Runs on every draft write (PATCH), not only on publish. Supports `string | number | boolean | enum`, numeric min/max, required fields, enum lists, and `dependsOn` conditional requirements.

### 1.3 Active Published Versions (`effectiveFrom`)

**Problem:** At most one `PUBLISHED` version per `(craftsmanId, trade)` may be active at any point in time.

**Chosen approach:** Postgres **exclusion constraint** on `(craftsman_id, trade, active_range)` using `tstzrange(effective_from, effective_until, '[)')`. Open-ended active versions use `effective_until = NULL` (treated as infinity in the range). On publish of a new version, the previously active version gets `effective_until = newVersion.effectiveFrom`.

**Rationale:**

- Structural guarantee — overlapping active intervals are impossible at the DB level, not just in application code.
- Audit history stays intact: old published versions remain readable with a closed interval.
- `POST /craftsmen/:id/trades/:trade/quote?at=<ISO>` (optional) can resolve the active version by range containment without extra logic.

---

## 2. Money Representation

### 2.1 Storage (DB)

All monetary amounts stored as **integer minor units (cents)**.

| Location | Type | Example |
|----------|------|---------|
| `CatalogPosition.netPrice` | `integer` | `1999` = €19.99 |
| `PositionSurcharge.flatAmount` | `integer` | `500` = €5.00 |
| `CatalogDiscount.flatAmount` / `cap` | `integer` | `1000` = €10.00 cap |
| `vatRate`, `percentageRate` | `numeric(8,6)` | `0.190000` = 19% VAT |

`PositionSurcharge` and `CatalogDiscount`: `flat_amount` XOR `percentage_rate` (see §1.1). `cap` only when `percentage_rate` is set.

### 2.2 Arithmetic (Calculator)

Money in DB and final quote totals: **integer cents**. Intermediate steps (surcharges, discounts) use fractional cents as `number` — no rounding until VAT groups and quote totals (see §3.2).

**Why integer cents:**

- No float in storage; aligns with payment-system conventions.
- Fractional cents only in calculator memory until the rounding boundary.
- Percentage math on fractional cents is deferred to VAT/total rounding only.

### 2.3 API Response Shape


| Field | Format | Where formatted |
|-------|--------|-----------------|
| Line items `net` / `gross` | `number` (fractional cents allowed) | Backend — unrounded breakdown |
| VAT breakdown, quote totals | `number` (integer cents) | Backend — rounded half-up |
| Partner-portal display | formatted euros | Frontend (`Intl.NumberFormat` / i18n) |


---

## 3. Quote Evaluation

### 3.1 Evaluation Order (Contract)

Follows the challenge suggestion:

1. `lineNet = quantity × netPrice` (integer cents)
2. Per-line surcharges: sum flat amounts; chain percentage surcharges **multiplicatively** on the running line net
3. Catalog discounts in declaration order on the applicable subtotal. A percentage discount with a cap applies the cap **before** stacking with the next discount
4. Group remaining net by `vatRate`; compute VAT per group; sum to totals

**Deviation from challenge suggestion:** None.

### 3.2 Rounding Rule

**Rule:** Keep **full fractional precision** on every line through surcharges and discounts. **Round half-up to integer cents** only for:

1. per-`vatRate` VAT groups (`netTotal`, `vatAmount`, `grossTotal`), and  
2. quote-level totals.

Line items in the response may show fractional cents; authoritative money is in the VAT breakdown and totals.

**Concrete example (single line — fractional line, rounded totals):**

```
Position: netPrice = 333¢, quantity = 3, surcharge = 7.5%
→ lineNet = 999¢
→ lineNetAfterSurcharges = 1073.925¢
→ after 10% catalog discount: netAfterDiscounts = 966.5325¢  (line item stays fractional)

VAT group 19% (first rounding):
→ netTotal = round(966.5325) = 967¢
→ vatAmount = round(966.5325 × 0.19) = 184¢
→ grossTotal = 1151¢

Multi-line: sum fractional line nets per `vatRate` bucket first, then round once per group for VAT/totals.
```

### 3.3 Mixed VAT Rates

Lines grouped by `vatRate`. Response includes per-rate breakdown: `{ vatRate, netTotal, vatAmount, grossTotal }` plus quote-level totals.

---

## 4. Publish Concurrency

**Chosen strategy:** `SELECT … FOR UPDATE` on the `craftsman_trade_assignments` row for `(craftsman_id, trade)` inside the publish transaction.

**Implementation (sketch):**

1. Begin transaction.
2. `SELECT * FROM craftsman_trade_assignments WHERE craftsman_id = ? AND trade = ? FOR UPDATE`
3. Validate draft, close previous active published version (`effective_until = draft.effectiveFrom`).
4. Set draft status to `PUBLISHED`, set `publishedByUserId`.
5. Commit.

Concurrent publish attempts on the same `(craftsmanId, trade)` serialize on the assignment row; the second transaction sees the updated state and either fails validation (draft already published / superseded) or operates on the correct predecessor.

### Rejected Alternatives


| Alternative                         | Why rejected                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Postgres advisory lock              | Works, but magic lock keys are opaque in logs/migrations and easy to mis-key; `FOR UPDATE` ties locking to real domain data                                                                      |
| Partial unique index on `PUBLISHED` | Good for "at most one published without intervals", but we use `tstzrange` exclusion for active intervals — a partial unique index does not cover overlap detection and would duplicate concerns |


---

## 5. Admin Schema Patch (`PATCH /trades/:trade`)

**Chosen:** Reject with `409 Conflict` + list of affected positions (version id, position key, validation errors).

**Rejected:** Accept patch and mark published versions as `SCHEMA_DRIFTED`.

**Rationale:**

- Published catalogs are immutable by contract — silently marking drift leaves stale data in an "official" published state.
- `409` forces the admin to understand impact before changing a live schema; craftsmen can fix drafts, and published versions stay audit-clean.
- Simpler mental model for the partner portal: a published catalog always matches the current schema.

---

## 6. Scaling Toward the Pricing Engine

The versioned catalog model and deterministic quote calculator are the foundation for the full pricing engine and offer generator. Internal planners will select positions and quantities; the engine returns the same breakdown contract the partner portal already consumes — PDF export and customer comparison tables become presentation layers on top. Per-trade `pricingSchema` in `TradeConfig.metadata` scales attribute variability without per-trade migrations. Publish intervals with `effectiveFrom` / `effectiveUntil` preserve audit history and enable time-bounded replay once time-travel quoting is added.

**Natural next steps:** admin schema editor UI, partner UI for surcharges/discounts and quantity bounds, catalog version history view, then offer assembly and document export.

---

## 7. Scope Cuts

Prioritized backend correctness and the partner-portal end-to-end loop over breadth. Skipped with intent:

| Cut | Rationale |
|-----|-----------|
| **Admin-portal schema editor** (§3.3) | Backend `PATCH /trades/:trade` with `409` conflict response is done; structured editor UI deferred to protect partner-portal quality. |
| **All §3.4 optional items** (idempotency, Terraform/ECS, time-travel quote) | No penalty for skipping; time spent on calculator tests and publish concurrency instead. |
| **Partner UI for surcharges, discounts, min/max quantity** | Backend and quote flow support them; UI covers positions + schema-driven attributes only. Existing surcharges/discounts on seeded or copied drafts are preserved on save. |
| **Catalog version history view** | Explicitly out of scope per challenge brief; published versions remain readable via API. |

---

## 8. AI Usage

**Tool:** Cursor (architecture sparring + code generation).

**Where AI was used:** Architecture decisions (data model, money representation, rounding, publish locking, schema-conflict policy) were discussed iteratively with Cursor before implementation. Given the 12-hour scope, essentially all implementation code was AI-generated — backend (entities, migrations, services, calculator, validator, tests) and frontend (partner-portal catalog page, forms, i18n).

**Where human judgment dominated:** Final architecture choices and trade-offs (e.g. `409` over `SCHEMA_DRIFTED`, exclusion constraint over advisory locks, fractional-cents-until-VAT rounding) were mine after sparring. The backend was reviewed line-by-line before every commit; smaller cosmetic refactors were skipped to stay pragmatic.

**Validation:**

- **Unit tests** across pricing-service (calculator invariants, validator failure modes, endpoint happy/error paths, concurrent publish) and partner-portal data-mapping tests.
- **Manual curl tests** against a running stack after each backend chunk — primary integration check alongside unit tests.
- **Database inspection** (published intervals, draft immutability, constraint behaviour) before committing backend changes.
- Frontend: less line-by-line review ("vibe-coded"); validated via browser smoke tests and the mapping unit tests.

---

## 9. Runbook

Full detail in `README.md`. Short version:

```bash
# Stack (migrations + seed run automatically in containers)
docker compose up --build
# → auth :3001, pricing :3000, partner :4200, admin :4201

# Host dev (faster hot-reload): Postgres in Docker, services on host
docker compose up -d postgres
yarn install && nvm use
yarn nx run auth-service:migration:run && yarn nx run pricing-service:migration:run
yarn nx run auth-service:seed && yarn nx run pricing-service:seed
yarn nx serve auth-service    # :3001
yarn nx serve pricing-service # :3000
yarn nx serve partner-portal  # :4200

# Tests
yarn nx test pricing-service
yarn nx test partner-portal

# Reset DB
docker compose down -v && docker compose up -d postgres
# then re-run migrations + seed (see README §6)
```

**Smoke login:** `partner@example.com` / `partner123` (partner-portal), `admin@example.com` / `admin123` (admin-portal). Swagger: `http://localhost:3000/api/docs`.