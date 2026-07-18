bashcat > PROGRESS.md << 'EOF'
# BMIS — Barangay Management Information System
## Progress Documentation — Updated
### Barangay IV, Tangub City, Misamis Occidental

---

## Project Overview

A full-stack multi-tenant web application built for Tangub City to digitize
barangay operations across multiple barangays. Built by DJ Mirontos (OFW on
cruise ship) using GitHub Codespaces and local VS Code — no local installation
required beyond Node.js.

**GitHub Repo:** https://github.com/djmirontos/bmis (Primary)
**Old Repo:** https://github.com/djmirontos/bmis-tangub (Archive)
**Developer:** DJ Mirontos (djmirontos@gmail.com)
**Live URL:** https://bmis-tangub.vercel.app (old repo, pending Vercel reconnect)

---

## Developer Workflow Instructions (IMPORTANT)

When making any code changes always follow this approach:
1. Ask for the current file contents first (cat or Get-Content command)
2. Analyze what needs to change
3. Use Python script via bash to rewrite files in Codespaces
4. For local VS Code use Claude Code extension with precise prompts
5. Verify with tail or grep command
6. Push to git

Python rewrite pattern (Codespaces):
```bash
python3 << 'PYEOF'
content = open('path/to/file').read()
content = content.replace(old, new)
open('path/to/file', 'w').write(content)
print('done')
PYEOF
```

Claude Code prompt pattern (local VS Code):
- Always specify exact files to modify
- State zero regression requirements
- Verify checklist at the end
- Never assume — always check current file first

Never use heredoc (cat > file << EOF) for code files — use Python instead.
Always verify changes before pushing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 16.2.6 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (logos, signatures, announcements) |
| Styling | CSS Modules + Tailwind CSS |
| Icons | Lucide React |
| QR Code | qrcode npm package |
| Deployment | Vercel (pending reconnect to new repo) |
| Dev Environment | GitHub Codespaces + Local VS Code |

---

## Supabase Project

- **Project Name:** Tangub_City
- **URL:** https://dqfwhstplaswfxuepolu.supabase.co

### Storage Buckets
| Bucket | Purpose | Public |
|---|---|---|
| barangay-assets | Logos (barangay + city) | Yes |
| signatures | Official signatures | No |
| announcements | Announcement images | Yes |

---

## Design System

### Barangay Dashboard
- **Primary:** Orange gradient — `linear-gradient(135deg, #f4a020, #e8820c, #c96008)`
- **Theme:** Tangub City orange
- **Font:** System UI (app), Times New Roman (print)
- **CSS:** CSS Modules — each page has its own `.module.css`
- **Paper Sizes:** Short Bond, A4, Long Bond (selectable on print)

### City Admin Command Center
- **Primary:** Government Blue — `#1E3A8A`
- **Accent:** Gold — `#F59E0B`
- **Background:** `#F8FAFC`
- **Sidebar:** Dark `#0F172A`
- **Font:** System UI

---

## Environment Variables (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://dqfwhstplaswfxuepolu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (Legacy anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_BARANGAY_NAME=Barangay IV
NEXT_PUBLIC_CITY=Tangub City
NEXT_PUBLIC_PROVINCE=Misamis Occidental
NEXT_PUBLIC_REGION=Region X
NEXT_PUBLIC_APP_URL=https://bmis-tangub.vercel.app
```

**Important:** Use LEGACY anon key (eyJ...) NOT sb_publishable format.
**Vercel:** All 8 env vars added in Vercel dashboard (Production + Preview).

---

## Database Tables
-- Core multi-tenant tables
barangays                 — All barangays (id, name, city, status, captain_name,
subscription_status, last_activity_at, onboarded_at,
storage_used_mb, theme_color, logo_path, city_logo_path)
-- City Admin tables
city_roles                — City-level user roles (mayor, city_admin, dilg_officer,
planning_office, it_admin)
-- Barangay tables (all have barangay_id)
puroks                    — Barangay sub-areas
households                — Household records (HH-YYYY-XXXX)
residents                 — Resident profiles
barangay_officials        — Officials directory
sk_officials              — SK Officials
barangay_tanod            — Tanod roster (TND-YYYY-XXX)
committees                — Committee assignments
user_profiles             — Auth user roles + full_name + is_active + barangay_id
audit_logs                — All action logs
barangay_settings         — Legacy single-tenant settings (being phased out)
document_type_settings    — Fee + validity per doc type
document_control_sequences — Sequential numbering per type/year
issued_documents          — All issued certificates
incident_types            — Blotter incident categories
blotter_records           — KP blotter cases
blotter_doc_sequences     — SL/CFA/AS control numbers
announcements             — Barangay announcements

### Barangay IV UUID
8201c6a1-a237-4421-ab6c-796b6cb4fe1f

### Key SQL Functions
```sql
generate_control_number(p_document_type)     -- BC-2025-0001
generate_household_number()                   -- HH-2025-0001 trigger
generate_tanod_number()                       -- TND-2025-001 trigger
generate_blotter_number()                     -- BL-2025-0001 trigger
generate_blotter_doc_control_number(p_type)  -- SL/CFA/AS-2025-0001
set_updated_at()                              -- auto updated_at trigger
get_my_role()                                 -- current user role
```

### User Roles
```sql
-- Barangay roles (in user_profiles)
super_admin, captain, secretary, treasurer,
kagawad, sk_official, tanod, encoder, qa

-- City roles (in city_roles table)
mayor, city_admin, dilg_officer, planning_office, it_admin
```

### Row Level Security (RLS)
All major tables have RLS enabled with barangay isolation policy:
- Users can only see data for their own barangay_id
- city_admin role bypasses RLS for city-wide analytics
- city_roles table: users can only read their own row

---

## File Structure
src/
├── app/
│   ├── api/
│   │   ├── barangay-info/route.ts    ← Multi-tenant: reads from barangays table
│   │   └── users/
│   │       ├── route.ts
│   │       └── [id]/
│   │           ├── route.ts
│   │           └── reset-password/route.ts
│   ├── announcements/                ← Public announcement pages
│   ├── city-admin/                   ← NEW: City Admin Command Center
│   │   ├── layout.tsx                ← Dark sidebar, auth check via city_roles
│   │   ├── page.tsx                  ← Command center dashboard
│   │   ├── city-admin.module.css     ← City admin styles
│   │   ├── barangays/                ← TODO: Barangay list + detail
│   │   ├── users/                    ← TODO: City user management
│   │   ├── reports/                  ← TODO: City-wide reports
│   │   ├── announcements/            ← TODO: Cross-barangay announcements
│   │   ├── audit/                    ← TODO: Audit logs
│   │   ├── storage/                  ← TODO: Storage monitoring
│   │   └── settings/                 ← TODO: City admin settings
│   ├── dashboard/
│   │   ├── layout.tsx                ← Sidebar (no logo in mobile header)
│   │   ├── page.tsx                  ← Professional dashboard redesign
│   │   ├── dashboard.module.css      ← Dashboard styles
│   │   ├── residents/                ← Full CRUD + mobile cards
│   │   ├── households/               ← Full CRUD + mobile cards
│   │   ├── officials/                ← 3 tabs + mobile cards
│   │   ├── clearance/                ← 7 doc types + mobile cards
│   │   ├── blotter/                  ← KP workflow + mobile cards
│   │   ├── announcements/            ← Post, edit, delete
│   │   ├── reports/                  ← 5 report tabs, responsive
│   │   └── settings/                 ← Full settings + user mgmt
│   ├── print/
│   │   ├── layout.tsx
│   │   ├── [id]/page.tsx
│   │   ├── blotter/[id]/page.tsx
│   │   └── reports/                  ← 5 report print pages (no-print toolbar)
│   ├── verify/[id]/page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts
│   ├── supabase-server.ts
│   ├── types.ts
│   ├── validation.ts
│   └── settings-context.tsx          ← Multi-tenant: barangay_id, theme_color
├── middleware.ts
└── proxy.ts

---

## Modules Completed ✅

### 1. Authentication ✅
- Email/password via Supabase Auth
- Route protection via proxy.ts + middleware.ts
- Email confirmation DISABLED
- Multi-tenant: users linked to barangay via barangay_id

### 2. Dashboard Home ✅ (REDESIGNED)
- Government blue hero banner with greeting + live clock
- 6 live stat cards (color-coded per module)
- Population by Purok — animated horizontal bar chart
- Sex distribution — visual split bar
- Documents issued — 6-month trend bar chart
- Blotter status — colored progress bars
- Recent Documents panel with View All link
- Recent Blotter panel with View All link
- fadeInUp animations on all sections
- Fully responsive (mobile + desktop)

### 3. Resident Registry ✅
- Full PH registration form + validation
- Duplicate detection
- Classifications: PWD, Senior, Voter, 4Ps, Indigent, Solo Parent, OFW
- Household linkage
- Search/filter by purok/sex/classification
- Full profile view + edit + audit log
- Mobile card layout + desktop zebra stripes

### 4. Household Management ✅
- Auto-numbered HH-YYYY-XXXX
- Status tracking with color badges
- Block deletion if active residents
- Mobile card layout + desktop zebra stripes

### 5. Officials Directory ✅
- 3 tabs: Barangay Officials | SK Officials | Barangay Tanod
- 90-day expiry warning
- Signature upload
- Mobile card layout + desktop zebra stripes

### 6. Clearance & Certificate Generation ✅
- 7 document types (BC, CR, CI, GM, NI, FJ, BZ)
- 3-step issuance workflow
- QR code → public verify page
- Void + Reprint tracking
- Print with paper size selector
- Mobile card layout + desktop zebra stripes

### 7. Settings + User Management ✅
- Barangay info + dual logo upload
- Document fee/validity per type
- Purok + Incident type management
- User CRUD: create, role, activate/deactivate, reset, delete

### 8. Dynamic Settings Context ✅ (MULTI-TENANT)
- Reads from barangays table based on logged-in user's barangay_id
- Returns barangay_id, theme_color, zip_code (new fields)
- Falls back to env vars for public/unauthenticated pages

### 9. Blotter & Incident Management ✅
- KP Workflow: Filed → Summoned → Mediation → Settled/Referred/Dismissed
- Auto-generates SL/CFA/AS control numbers
- Print templates for all 3 documents
- Mobile card layout + desktop zebra stripes

### 10. Announcements ✅
- Categories + priority levels
- Image upload, expiry, draft/publish
- Facebook copy button
- Public announcement page (no login)

### 11. Reports & Analytics ✅
- 5 Report Tabs: Population, Documents, Blotter, Households, Officials
- CSV export on all reports
- Print/PDF pages (toolbar hidden on print)
- Mobile responsive tables

### 12. Vercel Deployment ✅
- Live at: https://bmis-tangub.vercel.app (old repo)
- Pending: reconnect to new repo djmirontos/bmis

### 13. Multi-Tenant Architecture ✅
- barangays table created
- barangay_id added to all major tables
- All existing data migrated to Barangay IV
- RLS enabled on all tables with barangay isolation
- city_admin role added to user_role enum
- Settings context updated for multi-tenant
- barangay-info API reads from barangays table per user

### 14. City Admin Command Center ✅
- Route: /city-admin
- Dark sidebar (#0F172A) with gold accents
- Navigation groups: Main, Management, System
- Auth check via city_roles table
- Hero banner: government blue gradient
- 8 KPI cards: barangays, residents, households,
  documents, blotter, voters, seniors, PWD
- Barangay Overview table
- Monthly docs trend chart (fixed date range bug)
- Recent activity feed
- Responsive (mobile + desktop)

---

## Modules Pending ❌

### City Admin (Phase B-D)
- [ ] /city-admin/barangays — list + detail per barangay
- [ ] /city-admin/users — city user management
- [ ] /city-admin/reports — city-wide export reports
- [ ] /city-admin/announcements — cross-barangay announcements
- [ ] /city-admin/audit — audit logs viewer
- [ ] /city-admin/storage — storage monitoring
- [ ] /city-admin/settings — city admin settings

### Barangay System
- [ ] Settings page: read/write from barangays table
        (currently still uses barangay_settings)
- [ ] INSERT queries: add barangay_id to all new records
- [ ] Photo upload for residents
- [ ] Business Permits module
- [ ] PWA — installable on phone

### Infrastructure
- [ ] Reconnect Vercel to new repo djmirontos/bmis
- [ ] Test with second barangay account
- [ ] Custom domain (optional)

---

## Key Developer Decisions

- Orange gradient theme for barangay dashboard
- Government blue (#1E3A8A) + gold (#F59E0B) for city admin
- CSS Modules — no inline styles
- Short bond paper default for printing
- Standalone print routes outside dashboard layout
- QR code on certificates links to /verify/[id] (public)
- barangays table = single source of truth (replacing barangay_settings)
- RLS handles data isolation at database level
- city_roles table separate from user_profiles
- Python scripts for file edits (not heredoc)
- Claude Code extension for local VS Code changes
- Mobile card layout: hidden table + visible cards on mobile
- Desktop zebra stripes: nth-child(even) on tableRow
- suppressHydrationWarning on body tag (Grammarly fix)
- noImplicitAny: false for Vercel build compatibility
- useSearchParams wrapped in Suspense for dynamic pages

---

## Known Issues & Fixes Applied

1.  Login silent fail → wrong anon key format
2.  Cross-origin blocked → allowedDevOrigins in next.config.ts
3.  middleware.ts deprecated → proxy.ts + new middleware.ts
4.  Print page shows navbar → /print/[id] standalone layout
5.  QR on page 2 → placed inline with signature block
6.  sanitizeAlphanumeric missing → renamed sanitizeHouseNumber
7.  Email confirmation blocking → disabled in Supabase Auth
8.  Hydration warning → suppressHydrationWarning on body
9.  Settings useState generic split → fixed to single line
10. Public announcements 404 → recreated [id] folder
11. User delete 500 error → await params fix Next.js 16
12. Users not loading → fixed profile scope in useEffect
13. Vercel build implicit any → noImplicitAny: false
14. Vercel build duplicate TanodStatus → removed duplicate
15. Vercel build duplicate BarangayOfficial → removed
16. Vercel build useRef type → RefObject<HTMLInputElement|null>
17. Vercel build useSearchParams → wrapped in Suspense
18. Vercel build force-dynamic → must come after 'use client'
19. Print toolbar visible on PDF → no-print class on all 5 pages
20. Login page logo missing on Vercel → service role client
21. Tables not mobile friendly → card layout all 5 list pages
22. Reports tables overflow on mobile → overflow-x auto
23. Dashboard type error months array → typed as
    { month: string, count: number }[]
24. City admin redirect loop → RLS infinite recursion on
    city_roles fixed with simple own-row policy
25. City admin 400 errors → monthly docs date range fixed
    using new Date(year, month+1, 0) for last day of month
26. Active barangays showing 0 → status value was 'Active'
    changed to 'active' (lowercase)
27. Mobile header showing logo/name → removed from header,
    kept only in sidebar
28. Hamburger visible on desktop → removed display:flex
    from inline style so lg:hidden works correctly

---

## Git Commands

```bash
# Local VS Code
git add .
git commit -m "description"
git push origin main

# If push rejected
git pull origin main --rebase
git push origin main

# Codespaces
cd /workspaces/bmis-tangub/bmis
git add .
git commit -m "description"
git push origin main

# Restart dev server (Codespaces)
kill $(lsof -t -i:3000) 2>/dev/null; npm run dev

# Local dev server
npm run dev
```

---

## Next Steps (In Order)

1.  ✅ Residents Registry
2.  ✅ Households Management
3.  ✅ Officials Directory
4.  ✅ Clearance & Certificate Generation
5.  ✅ Settings (logos, fees, puroks, incident types)
6.  ✅ Dynamic settings context (multi-tenant)
7.  ✅ Blotter & Incident Management
8.  ✅ Announcements module
9.  ✅ User Management in Settings
10. ✅ Reports & Analytics
11. ✅ Deploy to Vercel (old repo)
12. ✅ Supabase auth URLs for production
13. ✅ Fix login page logo on Vercel
14. ✅ Fix print toolbar on report PDFs
15. ✅ Mobile card layout for all list pages
16. ✅ Professional dashboard redesign
17. ✅ Multi-tenant architecture (barangay_id + RLS)
18. ✅ City Admin Command Center (/city-admin)
19. ⬜ Reconnect Vercel to new repo (djmirontos/bmis)
20. ⬜ City Admin: Barangay detail page
21. ⬜ City Admin: User management
22. ⬜ City Admin: Reports & export
23. ⬜ City Admin: Cross-barangay announcements
24. ⬜ Settings page: migrate to barangays table
25. ⬜ INSERT queries: include barangay_id
26. ⬜ Test with second barangay
27. ⬜ Photo upload for residents
28. ⬜ Business Permits (future)
29. ⬜ PWA mobile app (future)

---

## How to Resume in New Claude Conversation

Paste this into a new chat:
"I am building BMIS for Tangub City — a multi-tenant barangay
management system. Here is my PROGRESS.md: [paste contents].
Please continue helping me."

---
*Last updated: July 2026 — City Admin Command Center completed*
*GitHub: https://github.com/djmirontos/bmis*
*Generated by Claude (Anthropic)*