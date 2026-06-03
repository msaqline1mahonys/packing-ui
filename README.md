# Packing UI

Next.js 16 frontend for **Mahonys Packing** — a multi-tenant ERP for grain and agricultural packing & logistics operations.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** JavaScript (no TypeScript)
- **React:** 19
- **Styling:** Tailwind CSS v4, MUI v9, Radix UI primitives
- **Icons:** Lucide React
- **Data Grid:** Custom Clutch Table (MUI + TanStack Virtual + DnD Kit)
- **Fonts:** Geist Sans & Geist Mono

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Environment

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

The backend is a separate Laravel application (`clutch-packing/`) that runs on port 8000.

### Development

```bash
npm run dev
```

Runs the dev server at [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

### E2E Tests

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive UI
```

## Project Structure

```
packing-ui/
├── app/                        # Next.js App Router pages
│   ├── accounting/             # Pack pricing, fees, invoicing
│   ├── contact/                # Customers, transporters, users
│   ├── fumigation/             # Records, certificates, templates
│   ├── help/                   # Help / documentation
│   ├── login/                  # Auth pages
│   ├── more-settings/          # Integration & site settings
│   ├── packing/                # Container & bulk packing
│   ├── packing-schedule/       # Pack scheduling
│   ├── packers-schedule/       # Packers work schedule
│   ├── product-settings/       # Commodities, tests, shrink, grading
│   ├── reference-data/         # Vessels, ports, terminals, trucks, etc.
│   ├── stock-management/       # Transactions, transfers, balances
│   ├── ticketing/              # In/out tickets, CMOs
│   └── transactions/           # Transaction ledger
├── components/
│   ├── app-shell.jsx           # Auth-gated layout wrapper
│   ├── clutch-table/           # Reusable data grid component
│   ├── erp-navbar/             # Navigation rail, dock, site selector
│   ├── fumigation/             # Fumigation-specific components
│   ├── pems/                   # PEMS integration components
│   ├── ticketing/              # Ticketing print documents
│   ├── quality-tester/         # Quality testing components
│   └── ui/                     # shadcn primitives (button)
├── lib/
│   ├── Data.js                 # Master seed/reference dataset
│   ├── *-store.js              # Per-module localStorage stores
│   ├── *-nav.js                # Navigation config per module
│   └── grading-standards/      # Grading standard definitions
├── docs/                       # Backend API specs
├── public/                     # Static assets
└── package.json
```

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Packing | `/packing` | Container packing, bulk packing, packing table |
| Pack Schedule | `/packing-schedule` | Schedule and manage packs |
| Fumigation | `/fumigation` | Records, certificates, templates, fumigants |
| Ticketing | `/ticketing` | Inward/outward tickets, CMOs |
| Stock Management | `/stock-management` | Locations, transfers, balances, transactions |
| Accounting | `/accounting` | Pack pricing, fees, invoicing |
| Product Settings | `/product-settings` | Commodities, tests, shrink rules, grading standards |
| Reference Data | `/reference-data` | Vessels, ports, terminals, trucks, container parks |
| Contacts | `/contact` | Customers, transporters, internal accounts, users |
| Settings | `/more-settings` | Integration settings, site config |

## Architecture Notes

### Authentication

Client-side only. `app-shell.jsx` checks `localStorage.isAuthenticated` and the bearer token. Auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`) bypass the shell. All API calls include `Authorization: Bearer <token>` from `localStorage.authToken`.

### State Management

No Redux or Zustand. Module-specific state lives in `lib/*-store.js` files backed by `localStorage`. React Context is used only for navigation chrome (NavDock, Site, ErpNavUi providers).

### API Communication

Plain `fetch` with `credentials: "include"`. No centralized API client. Backend URL sourced from `NEXT_PUBLIC_API_URL` (see `lib/api-config.js`).

### Clutch Table

The custom data grid in `components/clutch-table/` provides virtualization, column drag-reorder, inline editing, global search, multi-sort, CSV export, and persisted saved views. Extend via props and column configs — do not modify internals.

### Path Aliases

`@/*` maps to the project root (configured in `jsconfig.json`).

## Related

- **Backend:** `clutch-packing/` — Laravel 13 API (sibling directory)
- **Specs:** `BACKEND_DATA_GUIDE.md`, `SYSTEM_INTEGRATION_SETTINGS_SINGLE_TABLE.md`, `docs/pack-pricing-backend-spec.md`
