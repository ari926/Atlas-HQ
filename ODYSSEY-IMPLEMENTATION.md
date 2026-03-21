# The Odyssey — Atlas HQ Implementation Plan
# Talaria Transportation LLC
# Last Updated: March 21, 2026

---

## Phase Overview Table

| # | Phase | Status | Est. Sessions | Dependencies |
|---|-------|--------|---------------|--------------|
| 1 | Foundation | ✅ COMPLETE | — | — |
| 2 | Core Modules | ✅ COMPLETE | — | — |
| 3 | Compliance Engine | 🔜 NEXT | 4–5 | None |
| 4 | Licensing Overhaul | 📋 PLANNED | 3–4 | Partial dep on Phase 6 for doc attachments |
| 5 | HR and Workforce | 📋 PLANNED | 3–4 | Partial dep on Phase 6 for doc attachments |
| 6 | Google Drive Integration | 📋 PLANNED | 5–6 | None — can start parallel with Phase 3 |
| 7 | Atlas AI | 📋 PLANNED | 4–5 | Depends on Phases 3–6 for rich data |
| 8 | Dashboard + Cross-Module | 📋 PLANNED | 4–5 | Depends on Phases 3–5 for data |
| 9 | Projects + Permissions | 📋 PLANNED | 3–4 | None |

---

## Guiding Principles

1. **Security first** — Google Drive is the secure document backbone. Sensitive files live in Google's infrastructure. HQ stores only metadata and links, never file contents.
2. **Cannabis-specific** — every module is tailored for cannabis transportation. Generic placeholders replaced with real regulatory categories, credential types, and state authority references.
3. **Cross-module linking** — compliance items link to licenses, licenses link to documents, documents link to employees. Every record is part of the broader operational graph.
4. **State as a dimension** — PA, OH, MD, NJ, MO, WV. A global state filter in the Header propagates across all tabs. Every record is state-scoped where applicable.
5. **Audit-ready** — Talaria must be able to produce all records for any given state in under a minute. Audit mode in Phase 8 is a first-class feature, not an afterthought.

---

## Current Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + Vite 8 + TypeScript |
| State | Zustand |
| UI | Lucide React icons, react-hot-toast, @dnd-kit |
| Tables | @tanstack/react-table |
| Routing | react-router-dom v7 |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages (hq.talaria.com) |
| Design | Nexus Design System, Inter font, Hydra Teal theme |

**Supabase Projects**:
- Production: `buqopylxhqdiikzqctkb`
- Development: `dutvbquoyjtoctjstbmv`

**Repo**: github.com/ari926/Atlas-HQ

---

## Existing Database Tables

### HQ-owned tables (prefixed `hq_`)
- `hq_projects` — board projects
- `hq_board_groups` — groups within a project board
- `hq_board_columns` — column definitions per project
- `hq_tasks` — board task rows
- `hq_task_values` — cell values keyed by task + column
- `hq_task_comments` — comments on tasks
- `hq_task_activity` — audit log of task changes
- `hq_compliance_items` — compliance tracking records
- `hq_licenses` — license registry
- `hq_employees` — staff and HR records
- `hq_document_folders` — document folder tree
- `hq_documents` — document metadata

### Read-only from Atlas V2 (shared Supabase project)
- `profiles` — user accounts
- `corporate_staff` — staff permissions and metadata
- `drivers` — driver records (read-only in HQ; writes managed by Atlas V2)

**Important**: All new HQ tables must be prefixed `hq_`. All new tables must have RLS enabled immediately after creation.

---

## Existing Stores

### `authStore.ts`
- Supabase auth session and user
- Profile lookup from `profiles` table
- `corporate_staff` permissions
- Exposes: `user`, `session`, `profile`, `staff`, `isAdmin`, `signIn`, `signOut`

### `boardStore.ts`
- Full Projects board state: projects, groups, columns, tasks, task values, staff
- CRUD operations for all board entities
- Exposes: `projects`, `activeProject`, `groups`, `columns`, `tasks`, `taskValues`, `staff`
- Actions: `createProject`, `updateTask`, `moveTask`, `addColumn`, `deleteGroup`, etc.

### `uiStore.ts`
- Sidebar collapsed/expanded
- Theme (light/dark)
- `viewMode` — board, table, kanban, timeline
- Global search string
- Detail panel open/close + active record

---

## Existing Components Structure

```
src/
  components/
    Auth/
      LoginPage.tsx
    Board/
      BoardView.tsx
      BoardTable.tsx
      BoardHeader.tsx
      BoardRow.tsx
      AddItemRow.tsx
      DetailPanel.tsx
      GroupHeader.tsx
      PersonPicker.tsx
      StatusPicker.tsx
      SummaryRow.tsx
    Board/cells/
      CellRenderer.tsx
      CheckboxCell.tsx
      DateCell.tsx
      NumberCell.tsx
      PersonCell.tsx
      StatusCell.tsx
      TextCell.tsx
    Dashboard/
      DashboardView.tsx
    Kanban/
      KanbanView.tsx
    Timeline/
      TimelineView.tsx
    Layout/
      AppShell.tsx
      Header.tsx
      Sidebar.tsx
    common/
      ConfirmDialog.tsx
      Modal.tsx
  pages/
    DashboardPage.tsx
    ProjectsPage.tsx
    CompliancePage.tsx
    LicensingPage.tsx
    HRPage.tsx
    DocumentsPage.tsx
  stores/
    authStore.ts
    boardStore.ts
    uiStore.ts
  lib/
    supabase.ts
    utils.ts
```

---

## Phase 3 — Compliance Engine

**Goal**: Transform the generic compliance list into a cannabis transportation-specific compliance engine with auto-status, recurrence, evidence tracking, a multi-state matrix view, and compliance scoring.

---

### Current State

`CompliancePage.tsx` renders a flat list with top-level filters for category, status, and state.

**Existing fields** on `hq_compliance_items`:
- `title` TEXT
- `category` TEXT — Regulatory, Tax, Insurance, Reporting, Safety, Training, Other
- `status` TEXT — Compliant, In Progress, Due Soon, Overdue, Pending, Not Applicable
- `state` TEXT — PA, OH, MD, NJ, MO, WV
- `due_date` DATE
- `description` TEXT
- `responsible_party` TEXT (foreign key or free text)
- `attachments` JSONB — already present, not surfaced in UI

---

### Features to Build

#### 1. Cannabis-Specific Categories

Replace the generic category list with cannabis transportation-specific categories. Update the category enum/dropdown and all existing seed data.

New categories (in display order):
- `Seed-to-Sale / Metrc` — Metrc reporting, manifest compliance, transfer records
- `DOT / FMCSA` — DOT number, FMCSA registration, drug and alcohol program
- `Vehicle Compliance` — vehicle inspections, registration, weight compliance
- `Drug Testing` — pre-employment, random, post-accident, reasonable suspicion
- `Background Checks` — initial and annual background screenings
- `State Cannabis Authority` — state-specific cannabis regulator requirements
- `Regulatory` — general regulatory filings not covered above
- `Tax` — state and federal tax obligations
- `Insurance` — COI renewals, policy maintenance
- `Reporting` — operational, financial, compliance reports to authorities
- `Safety` — safety plans, incident reports, OSHA
- `Training` — driver, handler, compliance training completion records

**Important**: Drivers do NOT require CDL numbers — Talaria vehicles are under the CDL weight threshold. Do not add CDL-related compliance items.

#### 2. Auto-Status Calculation

Run on page load and via Supabase cron (pg_cron or Supabase scheduled functions):

```
if due_date < today AND status != 'Compliant' AND status != 'Not Applicable':
  status = 'Overdue'
else if due_date is within 30 days AND status not in ['Compliant', 'Not Applicable']:
  status = 'Due Soon'
```

- Run on `complianceStore` initialization (client-side for immediate UI accuracy)
- Also run via Supabase Edge Function on a daily schedule to update DB values
- Never overwrite `Not Applicable` or `Compliant` statuses automatically

#### 3. Recurring Items

Add `recurrence` support. When a compliance item is marked `Compliant`, if it has a recurrence setting, auto-create a new `hq_compliance_items` row with:
- Same `title`, `category`, `state`, `responsible_party`, `regulation_ref`, `score_weight`
- `status` = `Pending`
- `due_date` = computed from recurrence rule
- `parent_id` = ID of the completed item (for lineage tracking)
- `attachments` = null (reset for next cycle)

Recurrence values:
- `monthly` — due_date + 1 month
- `quarterly` — due_date + 3 months
- `semi_annual` — due_date + 6 months
- `annual` — due_date + 12 months
- `custom` — due_date + `recurrence_interval` days

#### 4. Attachments UI

Surface the existing `attachments` JSONB column. In Phase 3, support local file upload (stored in Supabase Storage bucket `hq-attachments`). In Phase 6, attachments will be migrated to Google Drive IDs.

Structure for each attachment in the JSONB array:
```json
{
  "id": "uuid",
  "name": "filename.pdf",
  "url": "supabase-storage-url",
  "uploaded_at": "ISO timestamp",
  "drive_id": null
}
```

`AttachmentUploader.tsx` must:
- Accept drag-and-drop or click-to-upload
- Show file list with name, upload date, and delete option
- Show Drive icon badge when `drive_id` is populated (Phase 6)
- Never allow download of files — open in new tab only

#### 5. Evidence / Proof Field

Structured evidence capture for when a compliance action is completed:

```json
{
  "date_filed": "2026-03-15",
  "confirmation_number": "PA-2026-00441",
  "filing_method": "online",
  "notes": "Filed via PennDOT portal, confirmation emailed to ari@talaria.com"
}
```

`filing_method` options: `online`, `mail`, `in-person`, `email`

`EvidenceForm.tsx` renders inside the compliance item detail panel or as a modal when marking an item `Compliant`.

#### 6. Regulation Reference

Free-text field `regulation_ref` for statute citations, e.g.:
- `35 P.S. § 10231.702`
- `49 CFR Part 382`
- `OAC 3796:6-3-21`

Rendered as a monospace/code-styled chip in the compliance item row and detail view. Clicking it could open a Google search in a new tab (optional enhancement).

#### 7. Multi-State Matrix View

`ComplianceMatrixView.tsx` — a grid where:
- **Rows** = compliance categories
- **Columns** = states (PA, OH, MD, NJ, MO, WV)
- **Cells** = color-coded status

Cell logic per category × state:
- 🟢 Green — all applicable items Compliant
- 🟡 Yellow — one or more Due Soon or In Progress
- 🔴 Red — one or more Overdue
- ⚫ Gray — No items / Not Applicable for this state

Clicking a cell drills into a filtered list of compliance items for that category × state combination.

Toggle between List view (existing) and Matrix view with a view switcher in the page header.

#### 8. Compliance Score

`ComplianceScore.tsx` widget:
- **Formula**: `(count of Compliant items) / (count of items where status != 'Not Applicable') × 100`
- Show overall score and per-state breakdown
- Color thresholds: ≥80% green, 60–79% yellow, <60% red
- Displayed in the Compliance page header and duplicated on the Dashboard (Phase 8)

---

### Database Migrations

Run against the production Supabase project (`buqopylxhqdiikzqctkb`). Always run on dev (`dutvbquoyjtoctjstbmv`) first.

```sql
-- Recurrence support
ALTER TABLE hq_compliance_items ADD COLUMN recurrence TEXT;
  -- values: null, monthly, quarterly, semi_annual, annual, custom
ALTER TABLE hq_compliance_items ADD COLUMN recurrence_interval INT;
  -- days, only relevant when recurrence = 'custom'

-- Evidence / proof of filing
ALTER TABLE hq_compliance_items ADD COLUMN evidence_date DATE;
ALTER TABLE hq_compliance_items ADD COLUMN evidence_ref TEXT;
  -- confirmation number, tracking number, etc.
ALTER TABLE hq_compliance_items ADD COLUMN evidence_method TEXT;
  -- online, mail, in-person, email

-- Regulation reference
ALTER TABLE hq_compliance_items ADD COLUMN regulation_ref TEXT;

-- Recurrence lineage
ALTER TABLE hq_compliance_items ADD COLUMN parent_id UUID REFERENCES hq_compliance_items(id);
  -- links regenerated items back to their source

-- Scoring weight (for weighted compliance score calculation)
ALTER TABLE hq_compliance_items ADD COLUMN score_weight INT DEFAULT 1;
  -- higher weight = more impact on score
```

---

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ComplianceMatrixView.tsx` | `src/components/Compliance/` | Multi-state × category grid |
| `RecurrenceField.tsx` | `src/components/Compliance/` | Recurrence picker (type + interval) |
| `EvidenceForm.tsx` | `src/components/Compliance/` | Structured evidence input modal/panel |
| `AttachmentUploader.tsx` | `src/components/common/` | Reusable file upload UI (shared across modules) |
| `ComplianceScore.tsx` | `src/components/Compliance/` | Score widget with per-state breakdown |

### Store Changes

Create `src/stores/complianceStore.ts` following the same Zustand pattern as `boardStore.ts`.

```typescript
// complianceStore.ts responsibilities:
// - fetch/create/update/delete hq_compliance_items
// - auto-status calculation on load
// - recurrence: create next item when current is marked Compliant
// - expose computed: scoreByState, scoreOverall, overdueItems, dueSoonItems
// - expose filters: activeCategory, activeStatus, activeState
```

---

## Phase 4 — Licensing Overhaul

**Goal**: Upgrade from simple license cards into full license management with structured type taxonomy, cost tracking, renewal workflows, authority contacts, dependency mapping, and a calendar view.

---

### Current State

`LicensingPage.tsx` renders license cards grouped by state.

**Existing fields** on `hq_licenses`:
- `license_type` TEXT (free text — no taxonomy)
- `license_number` TEXT
- `state` TEXT — PA, OH, MD, NJ, MO, WV
- `status` TEXT — Active, Pending Renewal, Expired, Suspended, Revoked
- `issued_date` DATE
- `expiration_date` DATE
- `renewal_date` DATE
- `issuing_authority` TEXT (free text)

---

### Features to Build

#### 1. License Type Taxonomy

Replace free-text `license_type` with structured `license_category` field. Predefined options:
- `Cannabis Transporter License` — state cannabis authority transporter license
- `Cannabis Distribution License` — distribution authorization (where applicable)
- `Motor Carrier Permit (MCP)` — state-level motor carrier operating permit
- `USDOT Number` — federal DOT registration (non-CDL; Talaria vehicles are under CDL weight)
- `State Vehicle Registration` — per-vehicle, per-state
- `Business Entity License` — LLC/corporate license in each operating state
- `Insurance Certificate (COI)` — certificate of insurance (treated as a licensed document)
- `Surety Bond` — state-required bonds
- `Workers Comp Certificate` — workers compensation coverage certificate

`license_type` (free text) is preserved for sub-type detail. `license_category` drives filtering, grouping, and renewal workflow triggers.

#### 2. Cost Tracking

Track fees per license:
- `application_fee` NUMERIC — one-time application cost
- `annual_fee` NUMERIC — recurring annual maintenance fee
- `renewal_fee` NUMERIC — cost to renew at expiration

`LicenseCostSummary.tsx` widget:
- Total annual cost across all active licenses
- Breakdown by state and category
- Projected renewal costs within the next 12 months
- Surfaced on Dashboard in Phase 8

#### 3. Renewal Workflow

When `expiration_date` is within 90 days:
- Auto-create a linked `hq_compliance_items` record with:
  - `title` = "Renew: {license_type} – {state}"
  - `category` = `State Cannabis Authority` (or relevant category)
  - `due_date` = `renewal_date` (or `expiration_date - 30 days` as default)
  - `status` = `In Progress`
  - Link back to the license record via `linked_record_id` and `linked_module = 'licenses'`
- Alert in the Dashboard license countdown widget
- Run check on page load and via daily Supabase Edge Function

#### 4. Document Attachment

Each license record has a `document_drive_id` field for the primary license PDF.

In Phase 3: upload to Supabase Storage (hq-attachments bucket), store URL.
In Phase 6: migrate to Google Drive, store Drive file ID in `document_drive_id`.

Document display: show thumbnail placeholder + filename, click to open in new tab (never inline download).

#### 5. Authority Contact

Add structured contact info for the issuing authority per license:
- `contact_name` — person or department name
- `contact_email` — click-to-email
- `contact_phone` — click-to-call
- Displayed in the license detail panel/card expanded view

#### 6. History / Audit Log

`hq_license_events` tracks all significant state changes per license:

Event types:
- `applied` — license application submitted
- `approved` — license issued/activated
- `renewed` — renewal completed
- `amended` — amendment filed
- `suspended` — license suspended by authority
- `revoked` — license revoked
- `expired` — license expired without renewal
- `note` — free-form note added

`LicenseEventLog.tsx` renders a vertical timeline of events in the license detail panel.

#### 7. Dependency Mapping

Some licenses require other licenses to be valid. `hq_license_dependencies` maps these relationships.

Example: `Cannabis Transporter License (PA)` depends on `USDOT Number` being Active.

`LicenseDependencyMap.tsx`:
- Visual list of prerequisites and dependents for a given license
- Warning badge on a license card when any prerequisite license is Expired or Suspended
- In Phase 8, dependency warnings surface on Dashboard

#### 8. License Calendar

`LicenseCalendar.tsx`:
- Monthly calendar view showing all upcoming expirations and renewals
- Color-coded urgency: red (within 30 days), yellow (31–90 days), green (>90 days)
- Filter by state and license category
- Click a calendar event to open the license detail panel

Toggle between Card view (existing), Table view, and Calendar view in the page header.

---

### Database Migrations

```sql
-- License type taxonomy
ALTER TABLE hq_licenses ADD COLUMN license_category TEXT;
  -- structured: Cannabis Transporter License, USDOT Number, etc.

-- Cost tracking
ALTER TABLE hq_licenses ADD COLUMN application_fee NUMERIC;
ALTER TABLE hq_licenses ADD COLUMN annual_fee NUMERIC;
ALTER TABLE hq_licenses ADD COLUMN renewal_fee NUMERIC;

-- Authority contact
ALTER TABLE hq_licenses ADD COLUMN contact_name TEXT;
ALTER TABLE hq_licenses ADD COLUMN contact_email TEXT;
ALTER TABLE hq_licenses ADD COLUMN contact_phone TEXT;

-- Document link (populated in Phase 3 with Storage URL, updated in Phase 6 with Drive ID)
ALTER TABLE hq_licenses ADD COLUMN document_drive_id TEXT;

-- License event log
CREATE TABLE hq_license_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES hq_licenses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
    -- applied, approved, renewed, amended, suspended, revoked, expired, note
  event_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_license_events ENABLE ROW LEVEL SECURITY;

-- License dependency mapping
CREATE TABLE hq_license_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES hq_licenses(id) ON DELETE CASCADE,
  depends_on_license_id UUID REFERENCES hq_licenses(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'requires'
    -- requires, related
);
ALTER TABLE hq_license_dependencies ENABLE ROW LEVEL SECURITY;
```

---

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LicenseCalendar.tsx` | `src/components/Licensing/` | Monthly calendar of expirations/renewals |
| `LicenseEventLog.tsx` | `src/components/Licensing/` | Vertical audit timeline per license |
| `LicenseDependencyMap.tsx` | `src/components/Licensing/` | Prerequisite/dependent license relationships |
| `LicenseCostSummary.tsx` | `src/components/Licensing/` | Aggregated cost widget |

---

## Phase 5 — HR and Workforce

**Goal**: Expand the HR module from a basic staff directory into cannabis workforce management — credentials, training records, onboarding checklists, driver qualification files, and compensation tracking.

---

### Current State

`HRPage.tsx` has two tabs:
1. **Staff** — table with name, email, phone, department, role, status, hire_date + full CRUD
2. **Drivers** — read-only pull from Atlas V2 `drivers` table

Drivers in Atlas V2 do NOT have CDL fields — Talaria vehicles are under the CDL weight threshold. Do not add CDL-related fields in HQ.

---

### Features to Build

#### 1. Cannabis Credentials

Add cannabis industry-specific credential fields to each employee record:

| Field | Type | Description |
|-------|------|-------------|
| `bg_check_status` | TEXT | `passed`, `pending`, `expired`, `not_started` |
| `bg_check_expiry` | DATE | Background check expiration date |
| `cannabis_permit_number` | TEXT | State cannabis worker permit/badge number |
| `cannabis_permit_state` | TEXT | State that issued the permit |
| `drug_test_status` | TEXT | `passed`, `pending`, `failed`, `not_scheduled` |
| `drug_test_last` | DATE | Most recent drug test date |
| `drug_test_next` | DATE | Next scheduled drug test |
| `medical_card_expiry` | DATE | DOT medical examiner certificate expiry (for drivers using DOT physical) |

These fields appear in the staff table as icon badges with color-coded expiry status. Employees with credentials expiring within 30 days surface in the Dashboard Workforce Snapshot (Phase 8).

#### 2. Department Taxonomy

Replace free-text `department` with predefined options:
- `Operations / Dispatch`
- `Drivers`
- `Compliance / Legal`
- `Finance / Admin`
- `Warehouse / Logistics`
- `Management`

#### 3. Emergency Contact

Add per-employee emergency contact fields:
- `emergency_name` TEXT
- `emergency_phone` TEXT
- `emergency_relation` TEXT (e.g., Spouse, Parent, Sibling)

Displayed in the employee detail panel. Not shown in the main table.

#### 4. Onboarding Checklist

When a new employee is created, auto-generate an `hq_onboarding_tasks` set:

Default onboarding tasks (template-driven, editable):
1. Collect signed offer letter
2. Complete I-9 verification
3. Set up payroll in [system]
4. Background check initiated
5. Drug test scheduled
6. Cannabis worker permit — verify or apply
7. Add to company insurance policy
8. Issue company vehicle/equipment (if applicable)
9. Complete safety training
10. Assign to Atlas V2 account (for drivers)

Tasks are shown in the employee detail panel under an "Onboarding" tab. Status per task: `pending`, `in_progress`, `complete`.

#### 5. Training Records

`hq_employee_training` tracks completion of required training programs:

Training types (not exhaustive — free text plus suggested values):
- `Cannabis Handler Training`
- `DOT Drug & Alcohol Awareness`
- `Defensive Driving`
- `OSHA 10 / OSHA 30`
- `Hazmat Awareness` (if applicable)
- `State Cannabis Compliance`
- `Company Safety Policy`

Each record: `training_type`, `completed_date`, `expiration_date`, `certificate_drive_id` (Drive link in Phase 6).

Displayed in employee detail panel under a "Training" tab. Expiring certificates (<30 days) flagged in red. Expired certificates shown in the Dashboard Workforce Snapshot.

#### 6. Driver Qualification File (DQF)

For employees in the `Drivers` department, show a "Qualification File" tab in the detail panel.

`hq_driver_qualifications` tracks required DQF documents:

| doc_type | Description |
|----------|-------------|
| `employment_application` | Signed driver application |
| `mvr` | Motor Vehicle Record (annual) |
| `road_test` | Road test certificate |
| `annual_review` | Annual driving record review |
| `safety_performance_history` | Prior employer safety inquiry |

Each record: `doc_type`, `doc_drive_id`, `issue_date`, `expiry_date`, `notes`.

Note: No CDL documents — Talaria vehicles are below CDL weight threshold.

#### 7. Driver-Vehicle Assignment

Simple cross-reference: `assigned_vehicle_id` on `hq_employees` links to a vehicle record. Vehicle table is out of scope for Phase 5 — store as free text `assigned_vehicle` for now, formalize in a future phase if a Vehicles module is added.

#### 8. Compensation Tracking

Permission-gated (Phase 9 adds the permission check):
- `pay_rate` NUMERIC
- `pay_type` TEXT — `hourly`, `salary`, `contract`

In Phase 5, add the fields. In Phase 9, gate their visibility behind `hq_hr_access = true` AND `hq_role = 'admin'`.

---

### Database Migrations

```sql
-- Cannabis credentials
ALTER TABLE hq_employees ADD COLUMN bg_check_status TEXT;
  -- passed, pending, expired, not_started
ALTER TABLE hq_employees ADD COLUMN bg_check_expiry DATE;
ALTER TABLE hq_employees ADD COLUMN cannabis_permit_number TEXT;
ALTER TABLE hq_employees ADD COLUMN cannabis_permit_state TEXT;
ALTER TABLE hq_employees ADD COLUMN drug_test_status TEXT;
  -- passed, pending, failed, not_scheduled
ALTER TABLE hq_employees ADD COLUMN drug_test_last DATE;
ALTER TABLE hq_employees ADD COLUMN drug_test_next DATE;
ALTER TABLE hq_employees ADD COLUMN medical_card_expiry DATE;

-- Emergency contact
ALTER TABLE hq_employees ADD COLUMN emergency_name TEXT;
ALTER TABLE hq_employees ADD COLUMN emergency_phone TEXT;
ALTER TABLE hq_employees ADD COLUMN emergency_relation TEXT;

-- Compensation (permission-gated in Phase 9)
ALTER TABLE hq_employees ADD COLUMN pay_rate NUMERIC;
ALTER TABLE hq_employees ADD COLUMN pay_type TEXT;
  -- hourly, salary, contract

-- Vehicle assignment (free text until Vehicles module)
ALTER TABLE hq_employees ADD COLUMN assigned_vehicle TEXT;

-- Training records
CREATE TABLE hq_employee_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES hq_employees(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL,
  completed_date DATE,
  expiration_date DATE,
  certificate_drive_id TEXT,
    -- Supabase Storage URL in Phase 5, Google Drive ID in Phase 6
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_employee_training ENABLE ROW LEVEL SECURITY;

-- Onboarding checklist
CREATE TABLE hq_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES hq_employees(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
    -- pending, in_progress, complete
  due_date DATE,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- Driver qualification file
CREATE TABLE hq_driver_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES hq_employees(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
    -- employment_application, mvr, road_test, annual_review, safety_performance_history
  doc_drive_id TEXT,
  issue_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_driver_qualifications ENABLE ROW LEVEL SECURITY;
```

---

## Phase 6 — Google Drive Integration

**Goal**: Google Drive is the secure document backbone for Talaria. Files never leave Google's infrastructure — HQ stores only metadata (file IDs, names, MIME types) and links. All access is authenticated and proxied.

**Security principle**: No file is ever stored in Supabase Storage after Phase 6 is complete. Attachments added in Phases 3–5 (Supabase Storage) should be migrated to Drive. HQ never serves file bytes — always redirects to Google.

---

### Features to Build

#### 1. Google Drive OAuth 2.0

**Scopes** (minimal — principle of least privilege):
- `https://www.googleapis.com/auth/drive.file` — access only files HQ creates
- `https://www.googleapis.com/auth/drive.readonly` — read existing files user grants access to

**Flow**:
1. User clicks "Connect Google Drive" in the Documents page or Settings
2. HQ redirects to Google OAuth consent screen
3. On callback, access token + refresh token are encrypted and stored in `hq_drive_config`
4. Token refresh handled automatically via Supabase Edge Function before expiry
5. All subsequent API calls use the access token, routed through the Cloudflare Worker

**Token security**:
- Tokens are encrypted at rest using AES-256 before storage in `hq_drive_config`
- Encryption key stored as a Supabase/Cloudflare secret, never in code
- Tokens are never exposed to the client — all Drive API calls go through the proxy

#### 2. Pre-Built Folder Hierarchy

On first successful Drive connection, auto-create the following folder structure under a root folder named `/Talaria HQ`:

```
/Talaria HQ/
  Corporate/                    # Articles of org, EIN, operating agreements
  Licenses/
    PA/                         # PA-specific license documents
    OH/
    MD/
    NJ/
    MO/
    WV/
  Insurance/                    # COIs, policies, claims
  Compliance/                   # Filed reports, audit docs, inspections
  HR/
    {Employee Name}/            # Created per-employee on add
  Vehicles/                     # Registrations, inspections, maintenance logs
  Manifests/                    # Transport manifests (cross-ref with Atlas V2)
  Financial/                    # QuickBooks exports, tax filings, invoices
```

Store all folder IDs in `hq_drive_config.root_folder_id` (root) and in `hq_document_folders.google_drive_folder_id` (per folder).

When a new employee is added in Phase 5, auto-create `/HR/{Employee Name}/` folder.

When a new state is activated (license added), auto-create `/Licenses/{state}/` if not exists.

#### 3. Document Browser

Full `DocumentsPage.tsx` overhaul:
- **Left panel** — folder tree (mirrors Drive hierarchy). Expandable. Shows folder name and item count.
- **Right panel** — file list for selected folder with:
  - Thumbnail (Google-generated preview) or file type icon
  - File name, last modified date, file size, version count
  - Owner / last modifier
  - Expiration date badge (from `hq_documents.expiration_date` if set)
- **Breadcrumb nav** — path from root to current folder, each segment clickable
- **Search** — full-text search against file names within the connected Drive (Drive API `q` parameter)
- **File action**: click to open in Google Drive in a new tab (never inline, never downloaded)
- **Upload button** — opens file picker, uploads to current folder via proxy, creates `hq_documents` record

#### 4. Cross-Module Linking

Every major record can reference a Drive file ID:

| Module | Link field |
|--------|-----------|
| `hq_compliance_items` | `attachments` JSONB array — each item has `drive_id` |
| `hq_licenses` | `document_drive_id` TEXT |
| `hq_employee_training` | `certificate_drive_id` TEXT |
| `hq_driver_qualifications` | `doc_drive_id` TEXT |
| `hq_documents` | `google_drive_id` TEXT |

**Linking UX**: Every detail panel for compliance items, licenses, and employee training records has a "Attach from Drive" button that opens a Drive file picker (Google Picker API). Selected file ID is saved to the appropriate column.

#### 5. Expiration Awareness

`hq_documents` records can have `expiration_date` set manually.

Surface in:
- Document browser — red badge on expired files, yellow badge on files expiring within 30 days
- Dashboard Workforce Snapshot (Phase 8) — employees with expiring documents
- Dashboard Compliance Health (Phase 8) — compliance items missing recent documents

#### 6. Version History

Display native Google Drive version info:
- Version count from Drive API `revisions.list`
- Last modified timestamp
- Last modifier name

Shown in the document detail panel. Clicking "View History" opens the Google Drive revision history URL.

#### 7. Upload from Modules

Every compliance item, license, employee training record, and driver qualification record has an "Upload Document" button that:
1. Opens OS file picker
2. Uploads file to the correct pre-built folder via the Cloudflare Worker proxy
3. Creates an `hq_documents` record with `linked_module` + `linked_record_id`
4. Updates the relevant record's Drive ID field

Auto-routing logic:
- Compliance item → `/Compliance/`
- License (PA) → `/Licenses/PA/`
- Employee training → `/HR/{Employee Name}/`
- Driver qualification → `/HR/{Employee Name}/`

#### 8. Cloudflare Worker Proxy

All Google Drive API calls are routed through a Cloudflare Worker at `drive-proxy.talaria.com` (or as a route on the existing Worker).

The Worker:
1. Receives requests from HQ frontend (authenticated by Supabase JWT)
2. Validates the JWT against Supabase's JWKS endpoint
3. Retrieves the user's Drive tokens from `hq_drive_config` via Supabase service role
4. Decrypts the access token
5. Forwards the request to Google Drive API
6. Returns only metadata — never file bytes (for non-download endpoints)
7. Implements rate limiting per user (100 req/min max)

Supported proxy endpoints:
- `GET /files` — list files in folder
- `GET /files/:id` — get file metadata
- `POST /files/upload` — multipart upload to Drive
- `GET /files/:id/revisions` — get version history
- `GET /search` — search files

---

### Database Migrations

```sql
-- Drive OAuth config (one row per user)
CREATE TABLE hq_drive_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  root_folder_id TEXT,
    -- Google Drive folder ID for /Talaria HQ/ root
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ
);
ALTER TABLE hq_drive_config ENABLE ROW LEVEL SECURITY;
-- RLS: user can only read/update their own row

-- Folder → Drive folder mapping
ALTER TABLE hq_document_folders ADD COLUMN google_drive_folder_id TEXT;

-- Document → Drive file mapping
ALTER TABLE hq_documents ADD COLUMN google_drive_id TEXT;
ALTER TABLE hq_documents ADD COLUMN google_drive_url TEXT;
ALTER TABLE hq_documents ADD COLUMN expiration_date DATE;
ALTER TABLE hq_documents ADD COLUMN linked_module TEXT;
  -- compliance, licenses, hr, vehicles, manifests, financial
ALTER TABLE hq_documents ADD COLUMN linked_record_id UUID;
  -- UUID of the related record in any hq_ table
```

---

### Folder Hierarchy Reference

| Drive Path | Contents |
|-----------|---------|
| `/Talaria HQ/Corporate/` | Articles of org, EIN letter, operating agreement, state registrations |
| `/Talaria HQ/Licenses/PA/` | PA cannabis transporter license, PA motor carrier permit |
| `/Talaria HQ/Licenses/OH/` | OH equivalents |
| `/Talaria HQ/Licenses/MD/` | MD equivalents |
| `/Talaria HQ/Licenses/NJ/` | NJ equivalents |
| `/Talaria HQ/Licenses/MO/` | MO equivalents |
| `/Talaria HQ/Licenses/WV/` | WV equivalents |
| `/Talaria HQ/Insurance/` | All COIs, policy documents, claims correspondence |
| `/Talaria HQ/Compliance/` | Filed reports, inspection records, audit packages |
| `/Talaria HQ/HR/{Employee}/` | Per-employee: bg check, drug test results, training certs, DQF |
| `/Talaria HQ/Vehicles/` | Per-vehicle: registration, inspection, maintenance log |
| `/Talaria HQ/Manifests/` | Transport manifests (cross-referenced from Atlas V2) |
| `/Talaria HQ/Financial/` | QuickBooks exports, tax filings, invoices |

---

## Phase 7 — Atlas AI

**Goal**: Unified AI search and assistant with two modes — internal HQ data queries (natural language → Supabase) and external web search (regulatory questions → Claude + live web). Claude auto-routes between modes.

---

### Features to Build

#### 1. Cloudflare Worker Proxy — Claude API

A Cloudflare Worker at `atlas-ai.talaria.com` (or route on existing Worker):
- Accepts requests from HQ frontend, authenticated by Supabase JWT
- Validates JWT against Supabase JWKS
- Injects the HQ database schema context (table names, column names, RLS rules) into the Claude system prompt
- Forwards to Claude API (claude-3-5-sonnet or claude-3-7-sonnet)
- Implements rate limiting: 20 queries/hour per user
- Logs all queries to `hq_search_history`

**System prompt skeleton**:
```
You are Atlas AI, the operational assistant for Talaria Transportation LLC — a cannabis transportation company operating in PA, OH, MD, NJ, MO, WV. You have access to two modes:

INTERNAL: Query the Talaria HQ database. Tables available: hq_compliance_items, hq_licenses, hq_employees, hq_documents. Respond with the relevant data and a plain-English summary.

WEB: Search for current cannabis transportation regulations, DOT/FMCSA rules, or state authority requirements. Always cite sources.

Note: Talaria drivers do NOT require CDLs — vehicles are under CDL weight threshold.
```

#### 2. Internal Search Mode

Natural language → structured Supabase query → result.

Examples:
- "What licenses expire in the next 60 days?" → query `hq_licenses` WHERE `expiration_date` <= now() + 60 days
- "Which employees have expired drug tests?" → query `hq_employees` WHERE `drug_test_next` < now()
- "Show me all overdue compliance items in PA" → query `hq_compliance_items` WHERE `state = 'PA' AND status = 'Overdue'`

Claude generates the query intent, the Worker translates it to a Supabase RPC call or parameterized query, and the result is formatted back to Claude for a plain-English response.

**Important**: Claude never constructs raw SQL that is executed directly. The Worker maps Claude's structured output to pre-defined, parameterized query functions (Supabase RPCs) to prevent injection.

#### 3. Web Search Mode

For regulatory or external questions:
- "What are the cannabis transporter requirements in Missouri?"
- "Is there a new FMCSA rule about cannabis company vehicles in 2026?"

Claude uses its web search capability (or the Worker calls a search API like Brave Search/Perplexity) and returns an answer with cited URLs. Sources are always displayed as clickable links in the response.

#### 4. Auto-Routing

Claude determines the mode based on question content:
- **Internal**: questions about specific Talaria records, employees, licenses, compliance statuses
- **Web**: questions about regulations, laws, state requirements, industry news
- **Both**: "Are we compliant with the new Missouri transporter rules?" → fetch current MO rules (web) + check HQ compliance records (internal)

The mode used is shown as a badge on the response card.

#### 5. Search Overlay UI

Triggered by `CMD+K` (Mac) / `Ctrl+K` (Windows):
- Full-screen overlay or wide centered modal
- Chat-like interface: input at bottom, responses stack above
- Mode toggle: `Auto` / `HQ Data` / `Web`
- Response cards: answer text, sources (for web), linked records (for internal — clickable to navigate to the record)
- Keyboard navigation: arrow keys for history, Escape to close

#### 6. Conversation Memory

Short-term: last 5 exchanges stored in React state (cleared on overlay close). Enables follow-up questions:
- "Which of those has the highest renewal fee?" (refers to previous license query)

Long-term: `hq_search_history` persists all queries for the user's session history view.

#### 7. Suggested Questions

Based on current data state, surface 3–5 suggested prompts when the overlay opens:

Examples (generated from live data):
- "You have 3 licenses expiring in 30 days — show me renewal steps"
- "4 employees have drug tests due this month"
- "OH compliance score is 62% — what's missing?"

Suggestions are generated by querying HQ data on overlay open and templating them.

#### 8. Search History

`hq_search_history` stores: `user_id`, `question`, `mode`, `response`, `created_at`.

A "History" tab in the overlay lists recent queries. Clicking one re-executes the query.

---

### Database Migrations

```sql
-- AI search history
CREATE TABLE hq_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  question TEXT NOT NULL,
  mode TEXT,
    -- hq, web, auto
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_search_history ENABLE ROW LEVEL SECURITY;
-- RLS: user can only read their own history
```

---

### Infrastructure

| Service | Location | Purpose |
|---------|----------|---------|
| Cloudflare Worker | `atlas-ai.talaria.com` | Claude proxy, JWT validation, rate limiting |
| Supabase RPCs | `buqopylxhqdiikzqctkb` | Pre-defined parameterized query functions |
| Claude API | Anthropic (via Worker) | LLM inference |
| Brave Search API (optional) | Via Worker | Web search for regulatory queries |

---

## Phase 8 — Dashboard + Cross-Module

**Goal**: Transform the Dashboard from a placeholder into Talaria's operational command center. Add a global state filter that propagates across all tabs. Build cross-module record linking. Add Audit Mode.

---

### Features to Build

#### 1. Compliance Health Score

`ComplianceHealthScore.tsx`:
- Overall compliance score (formula from Phase 3) as a large percentage ring/gauge
- Per-state breakdown as a horizontal bar or small ring set (PA, OH, MD, NJ, MO, WV)
- Color: ≥80% green, 60–79% yellow, <60% red
- Click any state score → navigates to Compliance page filtered to that state

#### 2. License Renewal Countdown

`LicenseCountdown.tsx`:
- Top 3 most urgently expiring licenses (soonest expiration_date)
- Each card: license name, state, days until expiration, urgency bar (red/yellow/green)
- Click → opens license detail panel
- "View All Expiring" link → navigates to Licensing page sorted by expiration_date ASC

#### 3. Quick Actions Row

`QuickActions.tsx` — a row of icon+label buttons for the most common tasks:
- Add Compliance Item
- Add License
- Add Employee
- Upload Document
- Open Atlas AI (CMD+K)
- Run Audit (opens Audit Mode)

#### 4. State Coverage Map

`StateMap.tsx`:
- Visual representation of the 6 operating states (PA, OH, MD, NJ, MO, WV) on a simplified US map or hexagonal tile layout
- Each state tile shows: compliance score, license count, active status dot
- Click a state tile → sets global state filter and navigates to Compliance page

#### 5. Manifest Activity Widget

`ManifestWidget.tsx`:
- Read-only pull from Atlas V2 tables (shared Supabase backend)
- Shows recent transport manifest activity: count today, count this week, any flagged/failed manifests
- Link to Atlas V2 for full manifest management (external link — HQ does not manage manifests)

#### 6. Workforce Snapshot

Expiring credentials within 30 days, sourced from `hq_employees`:
- Drug tests due
- Background checks expiring
- Cannabis permits expiring
- Medical card expirations
- Training certificates expiring

Displayed as a compact list with employee name, credential type, and days remaining. Click → opens employee detail panel.

#### 7. Global State Filter

`StateFilter.tsx` — a dropdown in `Header.tsx`:
- Options: All States, PA, OH, MD, NJ, MO, WV
- State stored in `stateFilterStore.ts` (new Zustand store)
- All pages (Compliance, Licensing, HR, Documents) subscribe to this store and filter their data accordingly
- State persists for the session (sessionStorage)

```typescript
// stateFilterStore.ts
interface StateFilterStore {
  activeState: string | null; // null = All States
  setActiveState: (state: string | null) => void;
}
```

#### 8. Record Linking

`RecordLink.tsx` — a reusable component that renders a clickable badge linking to a record in another module.

Used in:
- Compliance items → linked license record badge
- License records → linked compliance item badge (renewal workflow)
- Employee records → linked training certificates, DQF docs
- Dashboard widgets → click to navigate to the related record with detail panel open

Navigation pattern: `navigate('/compliance')` + dispatch action to open the specific item's detail panel.

#### 9. Audit Mode

`AuditView.tsx` — activated from Quick Actions or global menu:
- State selector (defaults to global state filter)
- Pulls ALL records for the selected state: compliance items, licenses, employees with expiring credentials, documents
- Renders a structured, printable report layout
- "Export PDF" button (uses browser print dialog or jsPDF)
- "Copy for Email" button (copies summary text to clipboard)
- Must produce complete state audit package in under 60 seconds

#### 10. Universal Search Upgrade

CMD+K (before Phase 7 AI is added, or in parallel):
- Cross-module results: search string matches across compliance items, licenses, employee names, documents
- Results grouped by module with module icon
- Click result → navigate to module + open detail panel
- After Phase 7: CMD+K opens Atlas AI overlay instead; cross-module search is integrated as an HQ Data query

---

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `StateFilter.tsx` | `src/components/Layout/` | Global state dropdown in Header |
| `ComplianceHealthScore.tsx` | `src/components/Dashboard/` | Score ring + per-state breakdown |
| `LicenseCountdown.tsx` | `src/components/Dashboard/` | Top 3 expiring licenses |
| `QuickActions.tsx` | `src/components/Dashboard/` | Common action buttons |
| `StateMap.tsx` | `src/components/Dashboard/` | 6-state visual coverage map |
| `ManifestWidget.tsx` | `src/components/Dashboard/` | Atlas V2 manifest activity (read-only) |
| `AuditView.tsx` | `src/components/Dashboard/` | Full state audit report |
| `RecordLink.tsx` | `src/components/common/` | Cross-module record link badge |

### Store Changes

```typescript
// stateFilterStore.ts — new store
// Shared by Dashboard, Compliance, Licensing, HR, Documents pages
interface StateFilterStore {
  activeState: string | null;
  setActiveState: (state: string | null) => void;
}
```

---

## Phase 9 — Projects + Permissions

**Goal**: Add board templates, subtask support, new column types (priority, timeline), board-level descriptions, duplicate/clone boards, and full role-based access control (RBAC) across all HQ modules.

---

### Features to Build

#### 1. Board Templates

`hq_board_templates` stores reusable board structures (groups + columns in JSONB).

Pre-built templates:
- **State Expansion** — checklist for entering a new operating state (entity registration, cannabis license application, vehicle registration, insurance, compliance setup)
- **Audit Prep** — structured steps for preparing a state compliance audit package
- **Vehicle Onboarding** — adding a new vehicle to the fleet (registration, inspection, insurance, GPS setup, manifest system enrollment)
- **License Renewal** — full renewal workflow with steps from 90 days out to license received

When creating a new project, user can start from blank or select a template. Template groups/columns/tasks are cloned into the new `hq_projects` record.

#### 2. Priority Column Renderer

New column type: `priority`.

`PriorityCell.tsx`:
- Values: `Critical`, `High`, `Medium`, `Low`
- Color-coded: Critical = red, High = orange, Medium = yellow, Low = gray/blue
- Sortable in table view
- Filterable in board view (priority filter chip)

#### 3. Timeline Column Renderer

New column type: `timeline` (date range: start + end date).

`TimelineCell.tsx`:
- Renders as "Mar 21 → Apr 15" in table/board view
- In Timeline view, renders as a horizontal bar spanning the date range
- Date range picker (react-datepicker or custom)

#### 4. Subtasks

`hq_tasks` gains `parent_task_id` for self-referencing hierarchy:
- Subtasks appear indented under their parent in board table view
- Parent task shows a subtask count badge (e.g., "3/5 done")
- Subtasks are not shown in Kanban or Timeline view by default (toggle to show)
- DetailPanel shows subtask list with status + assignee

#### 5. Board Description

Editable markdown text field at the top of a board, below the board name:
- Stored in `hq_projects.description` (add column if not present)
- Rendered as formatted text; click to edit inline
- Useful for documenting board purpose, state context, or linked compliance items

#### 6. Duplicate Board

"Duplicate" action in the board context menu (⋯):
- Clones the board: all groups, columns, tasks, and task values
- Sets `status` of all tasks to their original values (or optionally reset to first status)
- New board name: "{Original Name} (Copy)"
- Prompts user: "Clone as template?" → saves to `hq_board_templates` instead

#### 7. Role-Based Access Control

Three roles in `corporate_staff.hq_role`:
- `admin` — full read/write access to all modules, can manage users
- `manager` — read/write access to permitted modules (per per-module flags)
- `viewer` — read-only access to permitted modules

Per-module access flags in `corporate_staff`:
- `hq_compliance_access` BOOLEAN
- `hq_licensing_access` BOOLEAN
- `hq_hr_access` BOOLEAN — includes employee training, onboarding, DQF
- `hq_documents_access` BOOLEAN
- `hq_projects_access` BOOLEAN

**Enforcement**:
- Frontend: each page checks `authStore.staff.hq_*_access` and `hq_role` before rendering write controls
- Backend: RLS policies on all `hq_` tables enforce the same rules via `corporate_staff` join
- Compensation fields (`pay_rate`, `pay_type`) on `hq_employees`: only visible to `hq_role = 'admin'`

#### 8. Permission UI

Settings page (new, or add to existing sidebar):
- Table of all `corporate_staff` members with toggles for each module permission
- Role dropdown per user (Admin / Manager / Viewer)
- Only `admin` users can access this page

---

### Database Migrations

```sql
-- Subtasks
ALTER TABLE hq_tasks ADD COLUMN parent_task_id UUID REFERENCES hq_tasks(id);

-- Board description (if not already present)
ALTER TABLE hq_projects ADD COLUMN description TEXT;

-- Board templates
CREATE TABLE hq_board_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  groups_json JSONB,
    -- array of group definitions with tasks
  columns_json JSONB,
    -- array of column definitions with types
  is_system BOOLEAN DEFAULT false,
    -- true for pre-built templates (State Expansion, Audit Prep, etc.)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hq_board_templates ENABLE ROW LEVEL SECURITY;

-- RBAC on corporate_staff (shared with Atlas V2 — coordinate before migration)
ALTER TABLE corporate_staff ADD COLUMN hq_role TEXT DEFAULT 'viewer';
  -- admin, manager, viewer
ALTER TABLE corporate_staff ADD COLUMN hq_compliance_access BOOLEAN DEFAULT true;
ALTER TABLE corporate_staff ADD COLUMN hq_licensing_access BOOLEAN DEFAULT true;
ALTER TABLE corporate_staff ADD COLUMN hq_hr_access BOOLEAN DEFAULT false;
  -- false by default — compensation data is sensitive
ALTER TABLE corporate_staff ADD COLUMN hq_documents_access BOOLEAN DEFAULT true;
ALTER TABLE corporate_staff ADD COLUMN hq_projects_access BOOLEAN DEFAULT true;
```

> **Note on `corporate_staff`**: This table is shared with Atlas V2. Coordinate migrations on this table to avoid breaking Atlas V2. Always run on dev first and verify Atlas V2 behavior before applying to prod.

---

## Recommended Build Order

| Priority | Phase | Rationale |
|----------|-------|-----------|
| 1 | Phase 3 (Compliance) + Phase 6 (Drive) in parallel | Compliance is the operational core. Drive unlocks secure attachments across all modules. |
| 2 | Phase 4 (Licensing) | Licenses are the legal right to operate — must be current at all times. |
| 3 | Phase 5 (HR) | Cannabis worker credentials and training are a state audit requirement. |
| 4 | Phase 7 (Atlas AI) | Search and query layer across all the rich data from Phases 3–6. |
| 5 | Phase 8 (Dashboard + Cross-Module) | Ties everything into a command center once data exists. |
| 6 | Phase 9 (Projects + Permissions) | Templates and access control — important but not blocking operations. |

---

## Total Estimate

| Metric | Range |
|--------|-------|
| Total focused work sessions | ~30–38 |
| Calendar time | ~16–22 weeks |
| Target completion | July–August 2026 |

---

## 80/20 Priority — Most Value, Fastest

**Phases 3 + 4 + 5 alone** (Compliance Engine, Licensing Overhaul, HR and Workforce) make Atlas HQ a real operational tool for cannabis transportation compliance. Estimated: **6–8 weeks** of focused build time, ~10–13 sessions.

These three phases deliver:
- Full cannabis-specific compliance tracking with auto-status and recurrence
- Complete license registry with renewal workflows and cost tracking
- Cannabis worker credential management and driver qualification files

Everything else (AI, Drive, Dashboard) makes it *great*. Phases 3–5 make it *useful*.

---

## Session Close Protocol

At the end of every session where changes are made:

1. **Update this file** — mark any newly completed phase sections, add notes under the relevant phase, bump the "Last Updated" date at the top.
2. **Update CLAUDE.md** — reflect any new components, tables, or patterns introduced.
3. **Bump the date** — `# Last Updated: {today's date}` at the top of both files.
4. **Commit** — commit with a message like `session: Phase 3 compliance categories + auto-status`.

Do not leave a session without updating these two files. They are the single source of truth for the next session.
