# Reports Module - Backend Specification

This document defines the Laravel module behind the Report Builder UI. The UI ships first against localStorage; this spec is what the backend implementation must deliver so the front end can swap its persistence layer for real API calls with no public-surface changes.

## Scope and Rules

The Reports module supports two delivery paths:

1. **Ad-hoc runs** — operator picks a date range, customers, commodities and sections, then either downloads a per-customer CSV bundle or has it emailed.
2. **Scheduled runs** — customers are enrolled in one of four fixed cadences: `daily`, `weekly`, `monthly`, `yearly`. There is no user-configurable schedule. The system fires each cadence at a single site-wide time-of-day:

   | Cadence  | Fires                                            | Window covered                              |
   |----------|--------------------------------------------------|---------------------------------------------|
   | daily    | every day at site fire time                      | previous calendar day                        |
   | weekly   | every Monday at site fire time                   | previous Mon-Sun                             |
   | monthly  | the 1st of every month at site fire time         | previous calendar month                      |
   | yearly   | January 1st at site fire time                    | previous calendar year                       |

Recipient scoping rule: every send is filtered per customer. One email per customer; that customer only sees their own rows across all five sections.

Stock-on-Hand is a point-in-time snapshot "as at" the window end. The module does not replay historical balances.

## Window resolution

The cadence windows must match the front-end helper `packing-ui/lib/reports-windows.js`. Implement them as pure functions taking a reference `DateTimeImmutable` in the site timezone:

- `previousDayWindow($now)` -> `[Y-m-d, Y-m-d]` for yesterday
- `previousWeekWindow($now)` -> previous Mon-Sun
- `previousMonthWindow($now)` -> previous calendar month
- `previousYearWindow($now)` -> previous calendar year

The site fire time lives as `site_settings.reports_fire_time` (`TIME`, default `06:00`); site timezone comes from `sites.timezone`.

## Module placement

- Folder: `clutch-packing/Modules/Reports/`
- Namespace: `Modules\Reports\`
- Add to `clutch-packing/modules_statuses.json`: `"Reports": true`
- API mounted under `/api/reports/*` behind the `auth:api` middleware
- All controllers `use ResponseTrait;` (`clutch-packing/app/Traits/ResponseTrait.php`) and reply via `$this->sendApiResponse()`

## Multi-tenancy

Every model `use HasCompanyContext;` (`clutch-packing/app/Traits/HasCompanyContext.php`). All tables carry `organization_id`, `site_id`, `created_by`, `updated_by`. The scheduled command iterates tenants explicitly with `Model::withoutCompanyContext()` and re-scopes inside each iteration; never run a scheduled command in the context of a single tenant.

## Permissions

Three new permission keys (Spatie), all gated by the Reports module being enabled:

- `reports.view`
- `reports.run_ad_hoc`
- `reports.manage_subscriptions`

`LoginResponseBuilder` must append `reports.*` to `allowed_modules` only when the module is enabled. Cache must be cleared on tenant/site switch using the existing `AuthController` precedent.

## Database Tables

### 1) `report_subscriptions`

```sql
CREATE TABLE report_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  cadence VARCHAR(16) NOT NULL CHECK (cadence IN ('daily','weekly','monthly','yearly')),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  commodity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_subscriptions_tenant
  ON report_subscriptions (organization_id, site_id, cadence)
  WHERE enabled = TRUE;
```

### 2) `report_runs`

```sql
CREATE TABLE report_runs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  source VARCHAR(16) NOT NULL CHECK (source IN ('ad-hoc','daily','weekly','monthly','yearly')),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  ran_by BIGINT REFERENCES users(id),
  status VARCHAR(16) NOT NULL CHECK (status IN ('ok','partial','error')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_runs_tenant_created
  ON report_runs (organization_id, site_id, created_at DESC);
```

### 3) `report_run_artifacts`

```sql
CREATE TABLE report_run_artifacts (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  file_path VARCHAR(512) NOT NULL,
  delivered_as VARCHAR(16) NOT NULL CHECK (delivered_as IN ('download','email','simulated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_run_artifacts_run ON report_run_artifacts (run_id);
```

Artifacts are zip files (one per customer) stored via `Storage::disk('reports')`. Path convention: `reports/{organization_id}/{site_id}/{yyyy}/{mm}/{run_id}-{customer_id}.zip`.

## API contract

All endpoints return the project's standard JSON envelope (`{ success, data, message }`) via `ResponseTrait::sendApiResponse()`. Validation is inline `$request->validate(...)` per the project's no-FormRequest convention.

### Subscriptions

- `GET /api/reports/subscriptions?cadence=daily|weekly|monthly|yearly`
  - Optional `cadence` filter; otherwise returns every subscription for the active tenant
  - Response: `{ data: [{ id, cadence, customerId, commodityIds, recipientEmails, enabled, lastFiredAt, createdAt, updatedAt }] }`

- `POST /api/reports/subscriptions`
  - Body: `{ cadence, customerId, commodityIds, recipientEmails, enabled }`
  - Validation: `cadence` in the four enum values; `customerId` exists; `recipientEmails` array of valid emails; `commodityIds` array of existing commodity ids

- `PUT /api/reports/subscriptions/{id}`
  - Body: same shape as POST (partial allowed)

- `DELETE /api/reports/subscriptions/{id}`

### Ad-hoc run + send

- `POST /api/reports/run-ad-hoc`
  - Body: `{ dateFrom, dateTo, customerIds: number[], commodityIds: number[], sections: string[], deliver: "download"|"email", replyTo: string }`
  - `deliver = "download"`: returns `200 { data: { artifacts: [{ customerId, downloadUrl }] } }` with short-lived signed URLs (~10 min) pointing at the generated zips.
  - `deliver = "email"`: queues a `ReportBundleMail` per customer, returns `202 Accepted` with `{ data: { runId } }`. Recipient list per customer is read from the request body (the UI sends it explicitly so the user can override).

- `POST /api/reports/send` (compatibility alias used by the current UI)
  - Same as `run-ad-hoc` with `deliver: "email"` defaulted. Body: `{ source, dateRange: { from, to }, commodityIds, sections, replyTo, recipients: [{ customerId, emails }] }`.

### Runs and artifacts

- `GET /api/reports/runs?limit=&before=`
  - Paginated list. Response includes `recipients` (derived from artifacts grouped by customer) so the History tab can render without extra round-trips.

- `GET /api/reports/runs/{id}`
  - Single run with full artifact list.

- `GET /api/reports/runs/{id}/artifacts/{artifactId}`
  - Streams the zip file with `application/zip`. Returns 410 once the artifact has been pruned (retention policy below).

## Mailable

Class: `Modules\Reports\Mail\ReportBundleMail`

- `Mailable` with `Queueable, SerializesModels`
- Attaches the per-customer zip via `Storage::disk('reports')->path(...)` -> `$this->attach(...)`
- `from` is `MAIL_FROM_ADDRESS` (config default)
- **`replyTo` is set from the request payload's `replyTo` field** — that field carries the currently-logged-in user's email so the customer can reply directly to the operator who ran the report
- Subject template: `"{cadenceLabel} report for {customerName} ({dateFrom} - {dateTo})"`
- View: `Modules\Reports\Mail\Views\bundle` (Markdown mail). Body covers: customer name, range, sections included, generated-by, row counts, contact link.

Email backend defaults to `MAIL_MAILER=log` (already set in `.env.example`). Production must wire SMTP/SES via env; no credentials in the repo.

## Bundle generation

The zip layout must match the UI builder at `packing-ui/lib/reports-csv.js`:

- `summary.txt` — customer, source, range, snapshot-as-at, generated-by, row counts
- `tickets.csv`, `transactions.csv`, `containers.csv`, `packs.csv`, `stock-on-hand.csv` — only the sections the request asked for; CSV columns match the on-screen Clutch Table column order.

Generate via a dedicated service: `Modules\Reports\Services\BundleBuilder`. Single entrypoint `build(ReportRequest $request, Customer $customer): SplFileInfo` returning the path to the zip on the reports disk.

Data resolution per section (filters: customer match + commodity match + window):

| Section        | Source query                                                                                       | Date column                  | Commodity match                                        |
|----------------|----------------------------------------------------------------------------------------------------|------------------------------|--------------------------------------------------------|
| tickets        | `tickets`, scoped to `customer_id`                                                                 | `date BETWEEN from AND to`   | `commodity_id IN (...)` or via `pack.commodity_id` join |
| transactions   | `transactions`, scoped to `account_id` (customer) OR `account` name match                          | `transaction_date BETWEEN`   | `commodity_id IN (...)`                                |
| containers     | `pack_containers` join `packs` scoped to `packs.customer_id`                                       | `packs.date BETWEEN`         | `packs.commodity_id IN (...)`                          |
| packs          | `packs`, scoped to `customer_id`                                                                   | `date BETWEEN`               | `commodity_id IN (...)`                                |
| stockOnHand    | `account_balances` view, as-at `to`                                                                | snapshot, no range filter    | `commodity_id IN (...)`                                |

Empty commodity filter = match all.

## Scheduled command

`routes/console.php` (Laravel 13+):

```php
use Illuminate\Support\Facades\Schedule;

// Use site fire time when single-tenant; for multi-tenant, the command itself
// iterates sites and dispatches per tenant timezone.
Schedule::command('reports:fire daily')->everyMinute()->withoutOverlapping();
Schedule::command('reports:fire weekly')->mondays()->everyMinute()->withoutOverlapping();
Schedule::command('reports:fire monthly')->monthlyOn(1)->everyMinute()->withoutOverlapping();
Schedule::command('reports:fire yearly')->yearlyOn(1, 1)->everyMinute()->withoutOverlapping();
```

Command: `Modules\Reports\Console\Commands\FireReports` (`reports:fire {cadence}`).

```text
For each tenant (organization, site):
  - Resolve current local time in site timezone
  - If current time has not yet reached site_settings.reports_fire_time today, continue
  - Window = previousXxxWindow(now, siteTz)
  - For each enabled subscription with this cadence where last_fired_at is null OR window has rolled over:
      dispatch new RunSubscriptionJob($subscription, $window)
      mark last_fired_at = now()
```

Job: `Modules\Reports\Jobs\RunSubscriptionJob` (queueable, `database` driver — already configured). Builds the bundle, persists a `report_run` + `report_run_artifact`, queues `ReportBundleMail`.

## Retention

Zips on disk are retained for **30 days** by default (configurable via env `REPORTS_RETENTION_DAYS`). A daily cleanup command `reports:prune` removes expired artifact rows and files. History rows survive.

## LoginResponseBuilder impact

When the Reports module is enabled, `LoginResponseBuilder` must include `reports.*` permissions the caller actually holds (no auto-grant) in `allowed_modules`. The cached `authPayload` shape gains no new top-level keys; the UI reads `permissions` only.

## Verification

- `composer test` from `clutch-packing/` runs `php artisan test`. Add feature tests covering: subscription CRUD, ad-hoc run for one customer with all five sections, scheduled fire across a cadence boundary, per-customer row isolation (customer A's run contains no customer B rows).
- Manual: `php artisan reports:fire daily --tenant=...` should produce identical artifacts to a UI ad-hoc run with `dateFrom = dateTo = yesterday`.

## Frontend coupling

UI files that read this contract (do not change their public surface):

- `packing-ui/lib/reports-store.js` - localStorage today; later thin REST wrappers
- `packing-ui/lib/reports-data.js` - per-section collectors; later swap each `safeFetch` for the backend run endpoint
- `packing-ui/lib/reports-csv.js` - keep client-side build until the backend artifact URL flow is live; afterwards either side can produce identical zips
- `packing-ui/lib/reports-windows.js` - mirror of the PHP window helpers
- `packing-ui/components/reports/send-or-download-dialog.jsx` - already posts to `/api/reports/send`; expects `replyTo` to land as message reply-to
