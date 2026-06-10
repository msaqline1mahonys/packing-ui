# Packers Schedule — spec addendum (persistence, integrations & data sources)

This addendum extends **[`packers-schedule-spec.md`](packers-schedule-spec.md)**. The base spec defines the field contract (its §4) and the camelCase ↔ snake_case map (its §6) accurately. This document fills the gaps an implementer hits once they try to wire **real** persistence: the PRA integration that does not yet exist, the true save payload, concurrency, auth, the non-`form-data` lookup sources, and the PEMS endpoints the base spec omits.

Section numbers continue from the base spec (which ends at §9). Where a section amends the base spec it says so.

> **Convention:** all UI paths below are relative to `packing-ui/`. Snake_case names follow the base spec §6.

---

## 10. PRA submission is currently simulated (no backend)

> **Amends base spec §4.4–4.5, §5.** Those sections describe `praSubmitted`, `praLastStatus`, `praLastError` ("Integration error message") and a **Submit PRA** action as though a 1‑Stop PRA integration exists. **It does not.** Both the per-container action and the bulk action mutate local state only — there is no network call.

Evidence:

- `components/pems/container-form-actions.js` → `onSubmitPra` sets a hardcoded result:
  ```js
  applyPatch({
    praSubmitted: true,
    praLastStatus: "Accepted",
    praLastSubmittedTime: new Date().toLocaleString(),
    praLastError: "ERA0100-Message received without error",
  })
  ```
- `app/packers-schedule/[id]/pack-detail-client.jsx` → `runBulkAction("pra-all")` / `runBulkAction("cancel-pra")` do the same for all containers.

So today every container "passes" PRA instantly and offline. The derived **Complete / PRA Passed / PRA Failed** badges in §5 are therefore driven by mock data.

### 10.1 What the backend must provide

A real 1‑Stop PRA (Pre‑Receival Advice) integration with at least:

| Action | Method | Suggested path | Notes |
|--------|--------|----------------|-------|
| Submit PRA for a container | POST | `/packing/packs/{packId}/containers/{containerId}/pra` | Body carries `pra_template` (`Original`/`Resubmit`/`Correction`) + container snapshot |
| Bulk submit PRA for a pack | POST | `/packing/packs/{packId}/pra` | Optional; mirrors "PRA All Containers" |
| Cancel PRA | POST | `/packing/packs/{packId}/containers/{containerId}/pra/cancel` | Mirrors "Bulk Cancel PRA" |
| Status callback / poll | GET or webhook | `/packing/packs/{packId}/containers/{containerId}/pra` | Updates `pra_last_status`, `pra_last_error` |

### 10.2 Status contract

`pra_last_status` is asynchronous in a real integration — submit returns `Pending`/`Submitted`, then a callback or poll resolves to `Accepted` / `Rejected` / `Error`. The frontend's optimistic `Accepted` must be replaced by the server value. Field mapping (base spec §6) stays the same; only the **source of truth** changes from client to server.

### 10.3 `pra_last_submitted_at` is a display string, not a timestamp

`onSubmitPra` writes `new Date().toLocaleString()` (e.g. `"6/10/2026, 3:14:00 PM"`). Base spec §6 maps `praLastSubmittedTime → pra_last_submitted_at` as a timestamp column. **The backend must emit ISO‑8601** (`pra_last_submitted_at` as `timestamptz`) and the UI should render it; do not persist the locale string. Until the UI is updated, treat any inbound non‑ISO value as untrusted and overwrite on the next server response.

---

## 11. Save payload & persistence semantics

> **Amends base spec §2 step 3 and §8 (“Persist `packChecks`”).** The base spec says the PUT sends "the updated `containers` array." The real payload is larger, and `packChecks` is **not in it**.

### 11.1 The actual PUT body

`app/packers-schedule/[id]/pack-detail-client.jsx` persistence effect:

```js
const containers = (draft.containers || []).map((c) => packContainerFromWorkContainer(c, packRow));
const pemsSubmissions = Array.isArray(draft.pemsSubmissions) ? draft.pemsSubmissions : [];
savePack({ ...packRow, containers, pemsSubmissions }); // → PUT /packing/packs/{id}
```

So each save sends **the entire pack row plus `containers` plus `pemsSubmissions`** — effectively the full pack form payload, not a container delta.

Implications for the backend:
- `PUT /packing/packs/{id}` must accept the full pack body from the packers screen **without requiring planning-only fields to be re-validated** (packers do not edit customer, vessel, releases, etc.). Treat missing/unchanged planning fields as no-ops.
- `pemsSubmissions` is echoed back on every save; the backend should treat it as **read-mostly history** sourced from `pack_pems_*` tables (see §15), not as the write path for new submissions.

### 11.2 `packChecks` is not persisted today

The four pre-pack checks (`importDetailsChecked`, `sampleRequirementsChecked`, `rfpDetailsChecked`, `micorRequirementsChecked`) live **only** in the localStorage work draft (`packing-ui-packers-work-v1`). They are **absent from the `savePack` payload** above — `draft.packChecks` is never serialized to the API.

To close base spec §8's "Persist `packChecks`" item, **one of**:
1. **Frontend change:** include `packChecks` in the save payload (e.g. `savePack({ ...packRow, containers, pemsSubmissions, packChecks })`) and add `pack_checks` columns (or a JSON column) on `packs`; **or**
2. **Separate endpoint:** `PUT /packing/packs/{id}/checks` writing a `pack_pre_pack_checks` row.

Recommended: option 1 with a single `pack_checks jsonb` column keyed by the four snake_case names, since the set is small and pack-scoped.

### 11.3 Save fires on every keystroke (no debounce)

The persistence effect depends on `[workByPack, packRow]`, and **every** container edit calls `updateContainerById → setWorkByPack`, so a full-pack PUT fires **per character typed**. There is no debounce or save-on-blur.

Backend/infra consequences:
- Expect bursty, high-frequency full-pack PUTs while a packer types into a weight/seal field.
- Make `PUT` idempotent and cheap; avoid heavy recomputation/side-effects per request.
- **Recommended frontend fix** (out of scope for backend, but note it): debounce the effect 500–800 ms or persist on blur / explicit "Save". The backend should not assume writes are throttled.

---

## 12. Concurrency & multi-device model

> **New — the base spec has no concurrency section.**

In-progress packer work is **device-local**: drafts live in `localStorage["packing-ui-packers-work-v1"]` via `lib/packers-work-store.js` (`loadWorkDrafts` / `saveWorkDrafts`). Only committed `containers` / `pemsSubmissions` reach the server through the §11 PUT.

Consequences:
- Two packers on two devices working the same pack **do not see each other's drafts**. The last `PUT` wins and silently overwrites.
- There is **no version/`updated_at` guard** on the write. A stale tab can clobber newer data.

Recommended backend support:
- Add optimistic concurrency: return `updated_at` (or a `version` integer) from `show`, require it on `PUT`, and reject with `409 Conflict` on mismatch.
- Optionally expose a lightweight server-side draft per (pack, user) if true multi-device collaboration is required. Until then, document the single-active-device assumption.

---

## 13. Auth & tenant scoping

> **Amends base spec §6 “Endpoints used today”, which lists bare paths only.**

All packing requests go through `packingRequest()` in `lib/api/packing.js`:

- **Base URL:** `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000/api`), trailing slashes stripped.
- **Headers:** `Accept: application/json`, `Content-Type: application/json`, and `Authorization: Bearer <authToken>` where `authToken` is read from `localStorage`.
- **Tenant scoping:** `getTenantPayload()` reads `localStorage["authPayload"]` and merges `organization_id` (from `organization.id`) and `site_id` (from `current_site.id`) into **create/update** bodies. List/show rely on the same scoping server-side.
- **Error envelope:** non-2xx **or** `{ success: false }` is treated as failure; the message is taken from `errors` (flattened) or `message`. Success responses are unwrapped from `{ data: … }`.

Backend requirements:
- Enforce tenant isolation by `organization_id` / `site_id`; never return cross-tenant packs.
- Honor the `{ success, data, message, errors }` envelope shape consistently (the client depends on it).

---

## 14. Lookup & reference-data sources (not all from `form-data`)

> **Amends base spec §4.1, §4.4, §4.6 and §3.1.** Several dropdowns the base spec implies come from the packing API are actually sourced elsewhere — some are hardcoded. An implementer wiring "real API persistence" must know which selects are backed by what.

| UI control (screen) | Work-store / pack key | **Current source** | Intended backend source |
|---|---|---|---|
| Packer signoff, PRA signoff | `packerSignoff`, `praSignoff` | `form-data` → `lookups.packers` (active only) | `users` where classification `PACKER` |
| Container park (queue empty-park, release park) | `releasePark` / `emptyContainerParkId` | `form-data` → `lookups.containerParks` | container parks reference table |
| Transporter | `transporter` / `transporterId` | `form-data` → `lookups.transporters` | transporters reference table |
| **AO signoff + AO number** | `aoSignoff`, derived AO number | **`loadContactUsers()`** → `localStorage["packing-contact-users-v1"]` + static `CONTACT_USER_ROWS`, filtered by `filterAuthorisedOfficers` | **`users` + `user_classifications` (`AUTHORISED_OFFICER`)** per `pems-backend-guide.md` §2.1 |
| **Exporter** (PEMS/GPPIR) | `exporter` | **Static** `CUSTOMER_CONTACT_ROWS` from `lib/Data` | customers reference API |
| **Destination country** (PEMS/GPPIR) | `destinationCountry` | **Static** `REFERENCE_COUNTRIES_ROWS` from `lib/Data` | countries reference data |
| **Establishment / yard / place of inspection** | `siteRow` via `pack.siteId` | **`readSiteRows()`** → `lib/site-data` store | **`sites` + PEMS address columns** per `pems-backend-guide.md` §2.2 |
| **Stock/Bay ID** | `stockBayId` | **Hardcoded** `["Silo 1","Silo 2","Silo 3","Bay 12","Shed C"]` | stock locations reference (does not exist yet) |
| **Container ISO** | `isoCode` | **Hardcoded** `["22G1","42G1","45G1","L5G1"]` | container ISO reference (or derive from `container_code`) |

Key takeaways:
- Base spec §4.1 calls Stock/Bay ID a "Lookup: stock locations" and lists ISO options as if from a lookup — **both are hardcoded literals** in `pack-detail-client.jsx` (`stockBayOptions` / `isoOptions` props). No endpoint backs them.
- **AO, exporter, country, and establishment data do not come from `/packing/packs/form-data`.** AO and establishment have a defined target home in `pems-backend-guide.md` (users / sites); the wiring from those tables to these selects is the gap. Exporter/country need a reference-data source decision.

### 14.1 `form-data` contents (base spec §6 lists the endpoint but not the shape)

`GET /packing/packs/form-data` (`getPackFormData`) returns at least:

| Key | Used for |
|-----|----------|
| `packers` | Packer/PRA signoff selects (UI filters to `status === "active"`) |
| `containerParks` | Resolve `emptyContainerParkId` → park name (queue "Empty park" column, release park) |
| `transporters` | Resolve `transporterId` → transporter name |

If AO / stock-bay / ISO are migrated to the API, extending `form-data` with `authorisedOfficers`, `stockBays`, and `containerIsoCodes` is the lowest-friction option.

---

## 15. PEMS endpoints used today

> **Amends base spec §6 “Endpoints used today”, which omits the only real submission integration.** Detailed schema is in [`pems-backend-guide.md`](pems-backend-guide.md); this is the endpoint surface the packers screen actually calls.

PEMS uses a **separate** route group (`/api/pems/...`), not the packing module. From `lib/pems/api.js`:

| Action | Method | Path |
|--------|--------|------|
| Reference data (codes) | GET | `/api/pems/reference-data/{type}` |
| Create inspection | POST | `/api/pems/inspections` |
| Get inspection | GET | `/api/pems/inspections/{id}` |
| Submit ECR (ECI) | POST | `/api/pems/inspections/{id}/submit-eci` |
| Submit GPPIR (CGI) | POST | `/api/pems/inspections/{id}/submit-cgi` |
| Cancel inspection | POST | `/api/pems/inspections/{id}/cancel` |

Flow (`submitPemsInspectionFlow`): **create inspection → submit-eci (ECR) or submit-cgi (GPPIR)** using the returned inspection id. A connectivity failure surfaces as *"PEMS backend is not available…"*.

Preconditions enforced client-side before submit (`submitPemsBatch`):
- Staged containers + `inspectionStart` + `inspectionEnd` + `aoSignoff` are required.
- **GPPIR requires every staged container to already have `ecrSubmitted === true`** (ECR before GPPIR).
- ECR requires non-empty `ecrComments`.
- An RFP-refresh error path (`isPemsRfpRefreshError` / `pemsRfpRefreshUserMessage`) maps a specific backend error to a user message — the backend should return a recognizable error when the pack RFP must be refreshed before submission.

On success the result is recorded in `pemsSubmissions[]` (history) and the staged containers are flagged `ecrSubmitted` / `gppirSubmitted` with `*LastSubmittedAt` / `*LastBatchId`.

---

## 16. Field-semantics corrections

> **Amends base spec §3.2, §4.8, §5, §6.**

### 16.1 `status` has two conflicting meanings in one field

- Placeholder creation defaults `status = "Draft"` (planning value, base spec §3.2).
- But on **every save**, `packContainerFromWorkContainer()` overwrites it with a **derived stage label** from `containerStage()` — one of `Packing` / `PRA Submitted` / `PRA Passed` / `PRA Failed` / `Complete` (base spec §5).

So the same `pack_containers.status` column receives both planning statuses *and* packer-stage labels. The backend must decide:
- **Recommended:** store the derived packer stage in a **separate** column (e.g. `packer_stage`) and keep `status` for planning, **or**
- accept that `status` is client-derived for container rows and never author it server-side (don't run independent status logic that the next PUT will clobber).

Either way, document it — base spec §6 maps `status` straight to a DB column with no mention of the collision.

### 16.2 RFP resolution reads fields the base spec doesn't list

PEMS RFP resolution (`resolvePackRfpRef`) reads, in precedence order, `pack.rfp`, then staged/all container `releaseNumber`, then `pack.releaseNumbers` (array) and `pack.releaseNumber` (scalar). Base spec §3.1 documents only `releaseDetails`. The backend should expose `rfp`, `release_numbers[]`, and per-container `release_number` so RFP resolves consistently with the UI.

---

## 17. Known frontend gaps (set expectations)

> **New — informational.** The base spec assumes the screens "just work." These are pre-existing UI issues independent of backend wiring:

- **List page** (`packers-schedule-client.jsx`): single fetch on mount, no loading state, no auto-refresh, and a silent `.catch(() => setRows([]))` — a failed load is indistinguishable from an empty queue. The "Schedule" toolbar button has no handler.
- **Detail page** (`pack-detail-client.jsx`): a **Rules-of-Hooks ordering bug** — four `useMemo` calls (`packAttachments`, `releaseRefsSummary`, `aggregateNettWeight`, `weightPerContainer`) run *after* the `if (!packRow) return …` early return. Because `packRow` starts null and loads async, the post-return hooks are skipped on the first render and run on the next, which can throw *"Rendered more hooks than during the previous render."* Fix by moving the early return below all hooks.

These don't change the data contract but should be scheduled alongside the persistence work.

---

## 18. Updated implementation checklist (supersedes additions to base spec §8)

Base spec §8 stays valid. Add:

- [ ] **PRA:** build real submit/cancel/status endpoints (§10); replace the client-side hardcoded `Accepted` / `ERA0100…` with server values; emit ISO `pra_last_submitted_at`.
- [ ] **Save payload:** accept the full pack body on `PUT` from the packers screen without re-validating planning-only fields (§11.1).
- [ ] **packChecks:** add `pack_checks` (jsonb) persistence and include it in the save payload or a dedicated endpoint (§11.2).
- [ ] **Throughput:** make `PUT` idempotent/cheap; expect per-keystroke saves until the UI debounces (§11.3).
- [ ] **Concurrency:** return `updated_at`/`version` from `show`, require it on `PUT`, `409` on mismatch (§12).
- [ ] **Auth/tenant:** enforce `organization_id`/`site_id` isolation; keep the `{ success, data, message, errors }` envelope (§13).
- [ ] **Lookups:** decide API sources for AO, exporter, country, establishment, stock-bay, and ISO; consider extending `form-data` (§14).
- [ ] **PEMS:** confirm `/api/pems/*` endpoints and the ECR-before-GPPIR precondition + RFP-refresh error contract (§15).
- [ ] **status field:** resolve the planning-vs-derived collision (separate `packer_stage` column recommended) (§16.1).
- [ ] **RFP fields:** expose `rfp`, `release_numbers[]`, per-container `release_number` (§16.2).

---

## 19. Summary

The base spec's field contract is correct; what it omits is everything around persistence and integration. In short: **PRA is a frontend mock with no endpoint**, the save is a **full-pack PUT on every keystroke** that **drops `packChecks`**, there is **no concurrency guard**, **auth/tenant scoping and the real PEMS endpoints are undocumented**, and **six dropdown data sources (AO, exporter, country, establishment, stock-bay, ISO) do not come from the packing API** the base spec points at — two of them are hardcoded. Implement the sections above to make the packers workflow genuinely API-backed without touching `ContainerFormSections` or the pack-detail layout.
