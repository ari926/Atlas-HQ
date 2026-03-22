# ATLAS HQ — Claude Code Context

**Project**: Atlas HQ — Corporate Command Center for Talaria Transportation LLC
**Owner**: Ari (CEO) — sole developer
**URL**: hq.talaria.com
**Repo**: github.com/ari926/atlas-hq
**Supabase Project ID**: `buqopylxhqdiikzqctkb` (shared with Atlas V2)
**Dev Supabase ID**: `dutvbquoyjtoctjstbmv`
**Related Project**: Atlas V2 (delivery management) — github.com/ari926/atlas-v2
**Last Updated**: March 21, 2026 | Phases 1-5, 7 complete. Phase 6 frontend built, Worker pending deploy. Phase 8 in progress.
**Google Cloud Project**: Talaria Atlas (talaria-atlas) — Drive API enabled, OAuth Internal
**Claude API**: Anthropic account created, key stored as `CLAUDE_API_KEY` in Supabase Edge Function secrets
**Edge Functions**: `atlas-ai` (streaming Claude proxy) deployed on prod Supabase
**Auth Status**: TEMPORARILY DISABLED — AuthGate commented out, RLS disabled on all HQ tables. Re-enable when Supabase auth is fixed.
**Anon Key**: Was regenerated — current key is in `src/lib/supabase.ts`

---

## What This Project Is

Atlas HQ is the corporate operations command center for Talaria Transportation LLC. It handles compliance, licensing, HR, project management, and document management — separate from the delivery operations in Atlas V2.

**Shared Supabase backend** — same database as Atlas V2. HQ tables are prefixed with `hq_` to avoid collision. The app reads from existing Atlas V2 tables (e.g., `drivers`) for cross-reference but does not write to them.

**Deploy**: Cloudflare Pages → `hq.talaria.com`

**Implementation Plan**: The Odyssey v3 (see `/ODYSSEY-IMPLEMENTATION.md` and `/The_Odyssey_v3.pdf`)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + Vite 8 + TypeScript |
| State | Zustand 5 |
| UI | Lucide React icons, react-hot-toast, @dnd-kit |
| Tables | @tanstack/react-table |
| Routing | react-router-dom v7 (path-based) |
| Dates | date-fns 4 |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages → custom domain with SSL |
| Design | Nexus Design System, Inter font, Hydra Teal theme |
| AI Search | Claude API via Supabase Edge Function (`atlas-ai`) |
| Google Drive | Drive API v3 via Cloudflare Worker (`drive-proxy`) — pending deploy |

---

## Dev vs Production

- `hq.talaria.com` → production DB (`buqopylxhqdiikzqctkb`)
- Any other hostname (localhost, `*.pages.dev`) → dev DB (`dutvbquoyjtoctjstbmv`) + yellow "DEV ENVIRONMENT" banner
- Config in `src/lib/supabase.ts`: `isProduction` check on `window.location.hostname`

---

## Codebase Map

```
/atlas-hq/
  src/
    main.tsx                     — React entry point
    App.tsx                      — Router + AuthGate
    index.css                    — Nexus design system (all CSS)
    lib/
      supabase.ts                — Supabase client (prod/dev switching)
      utils.ts                   — Date, color, formatting utilities
    stores/
      authStore.ts               — Zustand: auth session, profile
      boardStore.ts              — Zustand: projects board state
      uiStore.ts                 — Zustand: sidebar, theme
    pages/
      DashboardPage.tsx          — KPI cards, deadlines, activity
      ProjectsPage.tsx           — Monday-style board (table/kanban/timeline/dashboard)
      CompliancePage.tsx         — Phase 3 Compliance Engine (list + matrix views)
      LicensingPage.tsx          — License cards grouped by state
      HRPage.tsx                 — Employee directory + drivers tab
      DocumentsPage.tsx          — Google Drive integration (folder tree, file browser, search)
    components/
      Auth/LoginPage.tsx         — Supabase auth login
      Layout/AppShell.tsx        — Sidebar + header + main content
      Layout/Header.tsx          — Top bar with search
      Layout/Sidebar.tsx         — Navigation sidebar
      Board/                     — Projects board components
        BoardView.tsx            — Main board container
        BoardTable.tsx           — TanStack table grid
        BoardRow.tsx             — Memoized row
        DetailPanel.tsx          — Slide-out detail editor
        cells/                   — Cell renderers (Status, Person, Date, etc.)
      Kanban/KanbanView.tsx      — Kanban board
      Timeline/TimelineView.tsx  — Timeline/Gantt view
      Dashboard/DashboardView.tsx — Dashboard widgets
      Licensing/
        LicenseCalendar.tsx      — Calendar view for license dates
        LicenseCostSummary.tsx   — Fee KPI cards
        LicenseEventLog.tsx      — License change history
      HR/
        TrainingRecords.tsx      — Employee training tracker
        OnboardingChecklist.tsx  — New hire onboarding tasks
      Documents/
        DriveConnectCard.tsx     — Google Drive connection UI
        FolderTree.tsx           — Folder navigation sidebar
        BreadcrumbNav.tsx        — Breadcrumb trail
        FileList.tsx             — File grid/list renderer
        FileDetailModal.tsx      — File metadata editor
        FileUpload.tsx           — Upload form
      AI/
        AtlasAI.tsx              — CMD+K AI search overlay (chat interface)
      common/
        Modal.tsx                — Reusable modal (supports wide prop)
        ConfirmDialog.tsx        — Destructive action confirmation
  public/
    fonts/                       — Inter WOFF2 (400/500/600/700)
    favicon.svg
    icons.svg
  index.html                     — SPA entry point
  vite.config.ts
  tsconfig.json
  package.json
  CLAUDE.md                      — This file
  ODYSSEY-IMPLEMENTATION.md      — Full implementation plan (Phases 1-9)
```

**Note**: Root-level `.js` files (shared.js, compliance.js, etc.) are obsolete remnants from the vanilla JS era and are NOT used by the React app.

---

## Database — HQ Tables (+ shared Atlas V2 tables)

All HQ tables prefixed `hq_` with RLS enabled. Authenticated users can CRUD.

| # | Table | Key Columns |
|---|-------|-------------|
| 1 | hq_projects | id, name, description, status, priority, owner_id |
| 2 | hq_board_groups | id, project_id, name, color, sort_order, collapsed |
| 3 | hq_board_columns | id, project_id, name, type, settings, sort_order |
| 4 | hq_tasks | id, project_id, group_id, title, sort_order |
| 5 | hq_task_values | id, task_id, column_id, value |
| 6 | hq_compliance_items | id, title, description, category, status, due_date, state, responsible_party, recurrence, recurrence_interval, evidence_date, evidence_ref, evidence_method, regulation_ref, parent_id, score_weight, attachments (JSONB) |
| 7 | hq_licenses | id, license_type, license_number, license_category, state, issued_date, expiration_date, renewal_date, status, issuing_authority, notes, document_url, application_fee, annual_fee, renewal_fee, contact_name, contact_email, contact_phone |
| 8 | hq_employees | id, auth_user_id, first_name, last_name, email, phone, role, department, hire_date, status, notes, background_check_status, background_check_expiry, cannabis_permit_number, cannabis_permit_state, drug_test_status, drug_test_last, drug_test_next, medical_card_expiry, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, pay_rate, pay_type |
| 9 | hq_document_folders | id, name, parent_id (self-ref FK), google_drive_folder_id |
| 10 | hq_documents | id, name, mime_type, size_bytes, storage_path, folder_id, google_drive_id, uploaded_by |

**Shared tables read (not written) by HQ:**
- `profiles` — user accounts (auth)
- `corporate_staff` — staff permissions (28 toggle columns)
- `drivers` — driver directory (read-only in HR tab)

---

## Auth Pattern

- Supabase Auth with **separate storage key** (`atlas-hq-auth-token`) — prevents session collision with Atlas V2
- Zustand `authStore.ts`: `initialize()` → `getSession()` + `onAuthStateChange`
- Queries `profiles` table for user info
- `ConfirmDialog` component for all destructive actions

---

## Routing

- Path-based via react-router-dom v7: `/dashboard`, `/projects`, `/compliance`, `/licensing`, `/hr`, `/documents`
- `AppShell` layout wraps all routes (sidebar + header + main content)
- `AuthGate` component blocks unauthenticated access → shows `LoginPage`

---

## Key Patterns

**Zustand Stores** — `authStore` (session), `boardStore` (projects board), `uiStore` (sidebar/theme).

**Modal Pattern** — `<Modal>` component with `open`, `onClose`, `title`, `wide`, `footer` props.

**Toast Notifications** — `react-hot-toast` with Nexus-styled toasts.

**Theme** — Light/dark toggle via `data-theme` attribute on `<html>`. Persisted to localStorage.

**Board (Projects)** — Monday.com-style board using `@tanstack/react-table` + `@dnd-kit` for drag-and-drop. Custom column types: status, person, date, text, number, checkbox.

---

## Phase 3: Compliance Engine (COMPLETE)

Cannabis-specific compliance tracking with the following features:

**Cannabis Categories**: Seed-to-Sale/Metrc, DOT/FMCSA, Vehicle Compliance, Drug Testing, Background Checks, State Cannabis Authority, Regulatory, Tax, Insurance, Reporting, Safety, Training

**Auto-Status Calculation**: On page load, items with passed due_date auto-update to "Overdue" (past due) or "Due Soon" (within 30 days). Compliant and Not Applicable items are excluded from auto-update.

**Recurring Items**: When an item with recurrence is marked Compliant, a new Pending item is auto-created with the next due date. Supports monthly, quarterly, semi-annual, annual, and custom day intervals. Recurring items link to parent via `parent_id`.

**Evidence / Proof Fields**: Structured evidence tracking: evidence_date, evidence_ref (confirmation number), evidence_method (online/mail/in-person/email/phone/fax). Collapsible section in the edit modal.

**Regulation Reference**: Text field for statute citation (e.g., 35 P.S. 10231.702).

**Multi-State Matrix View**: Grid view with states as columns, categories as rows. Cells show color-coded counts (green/yellow/red). Click a cell to filter the list view. Bottom row shows per-state compliance scores.

**Compliance Score**: Weighted percentage: (compliant weight / total weight) × 100. Score weight per item (default 1, max 10). Overall score + per-state breakdown shown in KPI cards and state chips.

**Database columns added** (Phase 3 migration): recurrence, recurrence_interval, evidence_date, evidence_ref, evidence_method, regulation_ref, parent_id, score_weight, responsible_party

---

## Odyssey Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation | COMPLETE |
| 2 | Core Modules | COMPLETE |
| 3 | Compliance Engine | COMPLETE |
| 4 | Licensing Overhaul | COMPLETE — 3 views (cards/table/calendar), cost tracking, event log, multi-state |
| 5 | HR and Workforce | COMPLETE — Staff + Drivers tabs, cannabis credentials, training, onboarding |
| 6 | Google Drive Integration | IN PROGRESS — Frontend 80% built (folder tree, file browser, search). Cloudflare Worker scaffolded but not deployed. Need: deploy worker, set secrets, add custom domain, test OAuth flow |
| 7 | Atlas AI | COMPLETE (frontend + edge function deployed) |
| 8 | Dashboard + Cross-Module | IN PROGRESS |
| 9 | Projects + Permissions | PLANNED |

---

## Do Not Break — Protected Functionality

- [ ] Login + session persistence (separate from Atlas V2 admin)
- [ ] Sidebar navigation — all 6 pages load, active state highlights
- [ ] Dashboard KPI cards calculate correctly from live data
- [ ] Projects — Monday-style board with groups, custom columns, drag-and-drop
- [ ] Projects — kanban, timeline, and dashboard views
- [ ] Compliance — cannabis categories, auto-status, recurring items
- [ ] Compliance — list view filters (category, status, state)
- [ ] Compliance — matrix view with per-state scores
- [ ] Compliance — evidence/proof fields, regulation reference
- [ ] Licensing — cards/table/calendar views, cost tracking, event log
- [ ] HR — All Staff tab (cannabis credentials, training, onboarding) + Drivers tab (read-only sync)
- [ ] Documents — Google Drive folder tree, file browser, search, upload (pending worker deploy)
- [ ] AI Search — CMD+K opens overlay, local search returns results
- [ ] Dark mode toggle persists
- [ ] ConfirmDialog used for all destructive actions
- [ ] Dev/prod environment switching by hostname

---

## Session Close Protocol

Same as Atlas V2 — update this CLAUDE.md at the end of every session where changes are made.

---

## Next Session — Pick Up Here

### Phase 6: Google Drive — Deploy Worker (BLOCKED on Ari)
Frontend is built. Ari needs to run these commands:
1. `cd workers/drive-proxy && npx wrangler deploy`
2. Set 6 secrets via `npx wrangler secret put` (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, HQ_SHARED_SECRET)
3. Add custom domain `drive-proxy.talaria.com` in Cloudflare dashboard
4. Set `VITE_HQ_SHARED_SECRET` in Cloudflare Pages env vars
5. Test OAuth flow end-to-end

Google Cloud credentials:
- `GOOGLE_CLIENT_ID`: `164128185859-h7h15rfnanq1o5h6rdbeln66toal2qgr.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET`: stored in Cloudflare Worker secrets
- Redirect URI: `https://drive-proxy.ari-863.workers.dev/auth/callback`
- Consent screen: Internal (talaria.com org only)

### Also Pending
- Re-enable auth + RLS when Supabase login is fixed
- Phase 9: Projects + Permissions (role-based access, templates, automations)
