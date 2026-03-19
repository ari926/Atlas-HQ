# ATLAS HQ — Claude Code Context

**Project**: Atlas HQ — Corporate Command Center for Talaria Transportation LLC
**Owner**: Ari (CEO) — sole developer
**URL**: hq.talaria.com
**Repo**: github.com/ari926/atlas-hq
**Supabase Project ID**: `buqopylxhqdiikzqctkb` (shared with Atlas V2)
**Related Project**: Atlas V2 (delivery management) — github.com/ari926/atlas-v2
**Last Updated**: March 19, 2026 | Initial scaffold complete

---

## What This Project Is

Atlas HQ is the corporate operations command center for Talaria Transportation LLC. It handles compliance, licensing, HR, project management, and document management — separate from the delivery operations in Atlas V2.

**Shared Supabase backend** — same database as Atlas V2. HQ tables are prefixed with `hq_` to avoid collision. The app reads from existing Atlas V2 tables (e.g., `drivers`) for cross-reference but does not write to them.

**Deploy**: Cloudflare Pages → `hq.talaria.com`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES5 — no build step, no modules) |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages → custom domain with SSL |
| Design | Nexus Design System, Inter font, Hydra Teal theme |
| AI Search | Claude API via Cloudflare Worker (planned) |
| Google Drive | Drive API v3 — read-only, files stay in Google (no copies in Supabase) |

**ES5 constraint** — matches Atlas V2. No arrow functions in certain contexts, no import/export. Check existing file patterns before introducing new syntax.

---

## Dev vs Production

- `hq.talaria.com` → production DB (`buqopylxhqdiikzqctkb`)
- Any other hostname (localhost, `*.pages.dev`) → dev DB (`dutvbquoyjtoctjstbmv`) + yellow "DEV ENVIRONMENT" banner
- Config in `shared.js`: `_isProduction` check on `window.location.hostname`

---

## Codebase Map

```
/atlas-hq/
  index.html        — SPA shell (login + app shell + 6 views + modals)
  shared.js          — Auth, Supabase config, SPA routing, utilities, data fetchers
  dashboard.js       — HQ overview: KPI cards, upcoming deadlines, activity feed
  projects.js        — Project management: Kanban board + list view, task CRUD
  compliance.js      — Compliance tracking: filterable list, category/status/state filters
  licensing.js       — License management: cards grouped by state, expiration alerts
  hr.js              — HR: employee directory + read-only drivers tab
  documents.js       — Document browser: Google Drive API, files stay in Google, breadcrumb nav
  search.js          — AI search overlay: local full-text search (Claude API planned)
  style.css          — Nexus design system (forked from Atlas V2, HQ-specific additions)
  fonts/             — Inter WOFF2 (400/500/600/700)
  _headers           — Cloudflare security headers (CSP, cache)
  .gitignore
  CLAUDE.md          — This file
```

---

## Database — 7 HQ Tables (+ shared Atlas V2 tables)

All HQ tables prefixed `hq_` with RLS enabled. Authenticated users can CRUD.

| # | Table | Key Columns |
|---|-------|-------------|
| 1 | hq_projects | id, name, description, status (Backlog/In Progress/Review/Done/Archived), priority, owner_id |
| 2 | hq_tasks | id, project_id (FK → hq_projects, CASCADE), title, description, status, assignee_id, due_date, priority, sort_order |
| 3 | hq_compliance_items | id, title, description, category, status, due_date, state, responsible_id, notes, attachments (JSONB) |
| 4 | hq_licenses | id, license_type, license_number, state, issued_date, expiration_date, renewal_date, status, issuing_authority, notes |
| 5 | hq_employees | id, auth_user_id, first_name, last_name, email, phone, role, department, hire_date, status, notes |
| 6 | hq_document_folders | id, name, parent_id (self-ref FK), google_drive_folder_id |
| 7 | hq_documents | id, name, mime_type, size_bytes, storage_path, folder_id (FK → hq_document_folders), google_drive_id, uploaded_by |

**Shared tables read (not written) by HQ:**
- `profiles` — user accounts (auth)
- `corporate_staff` — staff permissions (28 toggle columns)
- `drivers` — driver directory (read-only in HR tab)

---

## Auth Pattern

- Same as Atlas V2 admin app but with **separate storage key** (`atlas-hq-auth-token`) to prevent session collision
- `initAuth()` → `getSession()` + CustomStorage backup + `onAuthStateChange`
- Queries `corporate_staff` table for permissions (auth_user_id match, fallback to email match)
- `customConfirm()` for all destructive actions (no native `confirm()`)

---

## SPA Routing

- Hash-based: `#dashboard`, `#projects`, `#compliance`, `#licensing`, `#hr`, `#documents`
- `validPages` array in shared.js
- `navigateTo(page)` → `renderPage(page)` → calls page-specific render function
- `.view` / `.view.active` CSS for page visibility
- `_navId` stale render protection

---

## Key Patterns

**Data Cache** — 60-second TTL per data type. `clearCache('key')` or `clearCache()` for all.

**Resilient Queries** — `resilientQuery()` with LockManager error retry, `resilientWrite()` for mutations.

**Kanban Drag & Drop** — HTML5 Drag API (no library). `handleTaskDrop()` updates task status on drop.

**Modal Pattern** — Single reusable `#hq-modal` with dynamic title/body/footer. `openModal()` / `closeModal()`.

**Toast Notifications** — `showToast(message, type, duration)` with deduplication.

**Theme** — Light/dark toggle via `data-theme` attribute. Persisted to localStorage.

---

## Cache Busting

All script tags use `?v=20260319hq1` pattern. Bump version on every deploy:
```html
<script defer src="./shared.js?v=20260319hq1"></script>
```

---

## What's Complete vs. In Progress

### Complete
- Full SPA shell with 6 pages
- Auth (Supabase, corporate_staff permissions, session persistence)
- Dashboard with KPI cards, deadline tracking, activity feed
- Projects with Kanban board + list view + task CRUD
- Compliance with filterable list + CRUD
- Licensing with state-grouped cards + expiration alerts + CRUD
- HR with employee directory + read-only drivers tab + CRUD
- Documents with folder tree + file upload to Supabase Storage
- Local full-text search across all modules
- Dark mode toggle
- All 7 database tables with RLS
- Responsive mobile layout

### In Progress / Next Up
- Google Drive OAuth + sync worker (pull docs into Supabase Storage)
- Claude API search worker (Cloudflare Worker proxy)
- Cloudflare Pages project setup + custom domain (hq.talaria.com)
- Push notifications for compliance deadlines
- Advanced reporting / analytics
- Employee onboarding workflows
- HQ-specific permission columns in corporate_staff table

---

## Do Not Break — Protected Functionality

- [ ] Login + session persistence (separate from Atlas V2 admin)
- [ ] Sidebar navigation — all 6 pages load, active state highlights
- [ ] Dashboard KPI cards calculate correctly from live data
- [ ] Projects — Kanban drag-and-drop moves tasks between columns
- [ ] Projects — list view shows all projects with task counts
- [ ] Compliance — filters work (category, status, state)
- [ ] Licensing — cards grouped by state with expiration badges
- [ ] HR — All Staff tab shows employees, Drivers tab shows read-only driver list
- [ ] Documents — folder tree navigation, file upload to Supabase Storage
- [ ] AI Search — CMD+K opens overlay, local search returns results
- [ ] Dark mode toggle persists
- [ ] customConfirm() used for all destructive actions
- [ ] Dev/prod environment switching by hostname

---

## Session Close Protocol

Same as Atlas V2 — update this CLAUDE.md at the end of every session where changes are made.
