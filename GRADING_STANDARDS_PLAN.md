# Grading Standards & Quality Testing — Feature Plan

> **Status:** Approved for implementation.
> **Scope:** `Product Settings → Grading Standards` + `Quality Tester` tab in Container Packing.
> **Prerequisite:** `Reference Data → Species` screen (built first).

---

## 1. What is this feature?

Grain receival and outloading at a packing site requires **quality testing** — measuring moisture, protein, screenings, foreign seeds, contaminants, etc. — and comparing each result against a **grading standard** (a table of tolerances keyed by commodity type, season, and grade).

The feature has two parts:

- **Grading Standards (admin)** — A settings screen under Product Settings where staff define and maintain standards: which grades exist, which parameters are tested, and what the tolerance is for each parameter/grade combination.
- **Quality Tester (operational)** — A tab embedded in the Container Packing right panel. The user picks a grade and enters per-container values; the grid shows pass/fail per cell in real time.

---

## 2. Decisions (All Resolved)

### 2.1 Who manages grading standards?
- **Admin-level function only.** Exact role/permission to be determined when backend is built.
- **Standards are per-site.** Each site manages its own set of grading standards.
- **Standards are never locked.** Admins can edit tolerances at any time, even mid-season.

### 2.2 Where exactly does the Quality Tester appear?
- **New tab in the Container Packing right panel** alongside [Checklist] and [Containers].
- Testing happens before sealing, per container.
- **Advisory only.** The grade on the container is set by the pack configuration — the quality test result is a record only and does not override it.
- **No system action on fail.** Red cells are sufficient — the operator decides how to proceed.

### 2.3 Which commodity types need standards on day one?
- **No seed data.** The standards list starts empty. Admins create standards from scratch in the UI.
- Commodity types come from the shared commodity type list (existing).

### 2.4 Backend timing
- **localStorage only for now.** Backend API will be built later as a separate module.
- Backend module: `Modules/GradingStandards` — see §7 for proposed schema.

### 2.5 Standard source of truth
- No seed data shipped. Admins build standards from scratch.
- **Species come from a shared global list** managed under Reference Data → Species (new screen, prerequisite).
- The standard's Species tab references global species and adds per-standard config (which param group, groupRule, groupLabel).

### 2.6 Detail view layout
- **Inline accordion row expand** — clicking a standard in the list expands it inline below the row, revealing 4 tabs (Overview, Grades, Parameters, Species).
- **Does NOT use Clutch Table** — the accordion pattern is incompatible with the Grid black-box constraint. Uses a custom table/list component.

### 2.7 Tolerance editing
- **Inline editable table** — the Parameters tab shows a grid (params × grades); clicking a cell edits it in place. No separate modal per parameter.

### 2.8 Print / reporting
- **Printable.** The pack form must show a full quality test summary — all containers' results together in one view.
- **Editable before printing.** From the pack form, users can edit any cell in the test results. The grid flags values outside tolerance in real time while editing.
- **Saved against the pack record.** Results persist so they can be reviewed, edited, and printed at any point.

---

## 3. Data Model

### 3.1 GlobalSpecies (shared reference list, managed under Reference Data)
```
GlobalSpecies
  id            string slug    e.g. "sp_doublegee"
  name          string         e.g. "Doublegee"
  defaultGroup  string         default group label hint e.g. "Type 7b"
  status        "active" | "inactive"
```

### 3.2 Grading Standard
```
Standard
  id                  string (UUID or local int)
  commodityType       string (matches commodity_type name)
  season              string  e.g. "2025/26"
  status              "active" | "inactive"
  defaultGrade        string  (pre-selected in tester)
  grades              string[]  ordered list of grade codes
  params              Param[]
  speciesLinks        SpeciesLink[]
  groupColors         { [paramId]: "#hex" }
  updatedAt           ISO datetime
```

### 3.3 Parameter (within a Standard)
```
Param
  id          string slug  e.g. "protein_min"
  name        string       e.g. "Protein Min"
  category    "quality" | "defective" | "foreign" | "contaminant"
  type        "min" | "max" | "nil"
              min  → pass when value >= tolerance
              max  → pass when value <= tolerance
              nil  → pass only when value === 0
  unit        string  e.g. "%" or "seeds/0.5L"
  tolerances  { [gradeCode]: number | null }
              null means N/A for that grade
```

### 3.4 SpeciesLink (per-standard reference to a GlobalSpecies)
```
SpeciesLink
  speciesId   string  → GlobalSpecies.id
  group       string  → id of a Param (must be foreign or contaminant category)
  groupRule   "individual" | "sum"
              individual  → species value is compared to group tolerance on its own
              sum         → all species in the same group sum together vs. group tolerance
  groupLabel  string  display label for the group badge  e.g. "Type 7b"
```

### 3.5 Quality Test Session (per pack)
```
QualityTestSession
  id              UUID
  packId          int
  standardId      string  (grading standard used)
  grade           string  (grade being tested against)
  containerIds    string[]  (ordered — row index maps to container)
  data            { "[rowIndex]-[paramId]": number | string }
  updatedAt       ISO datetime
```

---

## 4. UI Screens & Flows

### 4.1 Reference Data → Species (prerequisite — build first)

Standard product settings pattern:
- Clutch Table Grid listing all species (name, defaultGroup, status)
- Add/edit via centered modal
- Fields: name (required), defaultGroup (text), status (Active/Inactive)

### 4.2 Product Settings → Grading Standards (admin screen)

**List view** — custom table (NOT Clutch Table) with columns: commodity type, season, grades count, params count, status, expand toggle.

**Toolbar** — Add Standard button opens a centered modal.

**Add/Edit Standard modal** (top-level fields):
- Commodity Type (text, required)
- Season (text, required)
- Status (Active / Inactive)
- Default Grade (text — set after grades are added, blank on create)

**Inline accordion detail** — tabs:

- **Overview** — read-only display of top-level fields + Edit button
- **Grades** — chip list; type code + Enter to add; × to remove; drag or arrows to reorder; radio to mark default grade
- **Parameters** — inline editable tolerance grid (params as rows, grade codes as columns, tolerance values as editable cells); category filter buttons (All / Quality / Defective / Foreign / Contaminant); "+ Add Param" inline row; delete param icon on row hover
- **Species** — checklist of global species; for each checked species: group (dropdown of foreign/contaminant params), groupRule, groupLabel

### 4.3 Container Packing — Quality Test tab

**Right panel tabs:** [Checklist] [Containers] [Quality Test]

**Quality Test tab content:**
- Loads grading standard from store matching the pack's commodity type (active status, latest season)
- Grade selector (defaults to standard's defaultGrade)
- QualityTester widget (see §4.4)
- Test session auto-saved to localStorage on every change

### 4.4 Quality Tester widget (`components/quality-tester/QualityTester.jsx`)

**Props:**
```js
{
  standard,       // Standard object
  containerIds,   // string[] — row labels (container numbers)
  value,          // { "[rowIndex]-[paramId]": number | "" }
  onChange,       // (newValue) => void
}
```

**Grid:**
- Sticky tolerance header row (shows the tolerance for the selected grade)
- One data row per container
- Cells: plain `<input type="number">` with green/red/grey background (pass/fail/not-entered)
- Tab/Enter navigation
- Summary row: Min / Max / Avg / Fail count per column

**Column picker:** dropdown/panel listing params and species, filterable by category; greyed out if tolerance is N/A for selected grade.

**CSV export** — uses `rowsToCsv` / `downloadCsv` from `components/clutch-table/utils/csv`.

---

## 5. Integration Points

| Where | Notes |
|---|---|
| Container Packing right panel | Quality Test tab. Row labels = container IDs from the pack. |
| (Future) Outloading | Same widget, different parent context. |

The Quality Tester widget is **data-agnostic** — the parent screen passes in the `standard` object and `containerIds`. The widget owns its internal state but calls `onChange` so the parent can persist results.

---

## 6. Seed Data

**None.** Standards list starts empty. Admins create from scratch. The PDFs (`Barley-Trading-Standards-2025-2026.pdf`, `Pulse-Trading-Standards-202526-Revised-23Oct25.pdf`) are reference documents for admin use.

---

## 7. Backend Plan (for when the API module is built)

Proposed module: `Modules/GradingStandards`

Key tables:
- `global_species` — shared species master list
- `grading_standards` — one row per commodity × season
- `grading_params` — params belonging to a standard
- `grading_param_tolerances` — one row per param × grade (EAV)
- `grading_species_links` — per-standard species references
- `quality_test_sessions` — one session per pack
- `quality_test_results` — individual cell values (or stored as JSONB in session)

Until the backend module is built: **localStorage only**, following `lib/fumigation-store.js` as the model.

---

## 8. Things We Learned from the First Implementation (Don't Repeat)

- The page + QualityTester were built in one shot without clarity on packing integration — ended up with a component wired to nothing.
- The tolerance modal (one modal per parameter) felt heavy — **use inline editable table instead**.
- The Grade management chip list felt right — keep that pattern.
- Species → group linking is the trickiest part to explain — needs clear labels/hints in the UI.
- Don't use Clutch Table for the standards list — accordion rows require a custom list.

---

## 9. Implementation Steps

### Step 1 — Store (`lib/grading-standards-store.js`)
- [ ] Create store following `lib/fumigation-store.js` pattern
- [ ] Implement: `loadSpecies/saveSpecies`, `loadStandards/saveStandards`, `loadQualityTestSessions/saveQualityTestSessions`, `getSessionByPackId`, `upsertSession`, `nextLocalEntityId`

### Step 2 — Species screen (Reference Data prerequisite)
- [ ] Add `{ slug: "species", label: "Species" }` to `lib/reference-data-nav.js`
- [ ] Create `app/reference-data/species/page.jsx` (pattern: `app/product-settings/test/page.jsx`)

### Step 3 — Grading Standards screen
- [ ] Add `{ slug: "grading-standards", label: "Grading Standards" }` to `lib/product-settings-nav.js`
- [ ] Create `app/product-settings/grading-standards/page.jsx`
  - [ ] Custom list with accordion rows
  - [ ] Add Standard modal (top-level fields)
  - [ ] Overview tab
  - [ ] Grades tab (chip list)
  - [ ] Parameters tab (inline editable tolerance grid)
  - [ ] Species tab (checklist referencing global species)

### Step 4 — Quality Tester widget
- [ ] Create `components/quality-tester/QualityTester.jsx`
  - [ ] Grade selector
  - [ ] Column picker
  - [ ] Tolerance grid with pass/fail coloring
  - [ ] Summary row
  - [ ] CSV export

### Step 5 — Wire into Container Packing
- [ ] Add Quality Test tab to `app/packing/container-packing/page.jsx`
- [ ] Load matching standard from store
- [ ] Persist QualityTestSession on change
