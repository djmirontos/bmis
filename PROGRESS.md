# BMIS — Barangay Management Information System
## Progress Documentation — Updated
### Barangay IV, Tangub City, Misamis Occidental

---

## Project Overview

A full-stack web application built for Barangay IV, Tangub City to digitize
barangay operations. Built by DJ Mirontos (OFW on cruise ship) using GitHub
Codespaces — no local installation required.

**GitHub Repo:** github.com/djmirontos/bmis-tangub (Private)
**Developer:** DJ Mirontos (djmirontos@gmail.com)
**Live URL:** https://bmis-tangub.vercel.app

---

## Developer Workflow Instructions (IMPORTANT)

When making any code changes, always follow this approach:
1. Ask for the current file contents first (cat command)
2. Analyze what needs to change
3. Use Python script via bash to rewrite the file
4. Verify with tail or grep command
5. Push to git

Example:
```bash
python3 << 'PYEOF'
content = open('path/to/file').read()
content = content.replace(old, new)
open('path/to/file', 'w').write(content)
print('done')
PYEOF
```

Never use heredoc (cat > file << 'EOF') for code files — use Python instead.
Always verify changes before pushing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 16.2.6 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (logos, signatures, announcement images) |
| Styling | CSS Modules + Tailwind CSS |
| Icons | Lucide React |
| QR Code | qrcode npm package |
| Deployment | Vercel (bmis-tangub.vercel.app) |
| Dev Environment | GitHub Codespaces (browser-based) |

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

- **Primary:** Orange gradient — `linear-gradient(135deg, #f4a020, #e8820c, #c96008)`
- **Theme:** Tangub City orange
- **Font:** System UI (app), Times New Roman (print)
- **CSS:** CSS Modules — each page has its own `.module.css`
- **Paper Sizes:** Short Bond, A4, Long Bond (selectable on print)

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
puroks                    — Barangay sub-areas
households                — Household records (HH-YYYY-XXXX)
residents                 — Resident profiles
barangay_officials        — Officials directory
sk_officials              — SK Officials
barangay_tanod            — Tanod roster (TND-YYYY-XXX)
committees                — Committee assignments
user_profiles             — Auth user roles + full_name + is_active
audit_logs                — All action logs
barangay_settings         — Barangay info, logos, toggles
document_type_settings    — Fee + validity per doc type
document_control_sequences — Sequential numbering per type/year
issued_documents          — All issued certificates
incident_types            — Blotter incident categories
blotter_records           — KP blotter cases
blotter_doc_sequences     — SL/CFA/AS control numbers
announcements             — Barangay announcements
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

---

## File Structure
src/
├── app/
│   ├── api/
│   │   ├── barangay-info/route.ts    ← Public API (service role client)
│   │   └── users/
│   │       ├── route.ts              ← GET list, POST create user
│   │       └── [id]/
│   │           ├── route.ts          ← PATCH update, DELETE user
│   │           └── reset-password/
│   │               └── route.ts      ← POST send reset email
│   ├── announcements/                ← Public announcement pages
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                ← Sidebar with logo from settings
│   │   ├── page.tsx                  ← NEW: Professional dashboard
│   │   ├── dashboard.module.css      ← NEW: Dashboard styles
│   │   ├── residents/                ← Full CRUD + mobile cards
│   │   ├── households/               ← Full CRUD + mobile cards
│   │   ├── officials/                ← 3 tabs + mobile cards
│   │   ├── clearance/                ← 7 doc types + mobile cards
│   │   ├── blotter/                  ← KP workflow + mobile cards
│   │   ├── announcements/            ← Post, edit, delete
│   │   ├── reports/                  ← 5 report tabs
│   │   └── settings/                 ← Full settings + user mgmt
│   ├── print/
│   │   ├── layout.tsx
│   │   ├── [id]/page.tsx             ← Clearance print
│   │   ├── blotter/[id]/page.tsx     ← Blotter docs print
│   │   └── reports/                  ← 5 report print pages
│   ├── verify/[id]/page.tsx          ← Public QR verification
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts
│   ├── supabase-server.ts
│   ├── types.ts
│   ├── validation.ts
│   └── settings-context.tsx
├── middleware.ts
└── proxy.ts

---

## Modules Completed ✅

### 1. Authentication ✅
- Email/password via Supabase Auth
- Route protection via proxy.ts + middleware.ts
- Email confirmation DISABLED

### 2. Dashboard Home ✅ (REDESIGNED)
- Professional welcome banner with greeting + date
- 6 live stat cards (residents, households, officials,
  tanod, docs this month, active blotter)
- Population by Purok — horizontal bar chart
- Sex distribution — visual split bar
- Documents issued — 6-month trend bar chart
- Blotter status — colored progress bars
- Recent Documents panel with View All link
- Recent Blotter panel with View All link
- Fully responsive (mobile + desktop)

### 3. Resident Registry ✅
- Full PH registration form
- On-blur validation
- Duplicate detection
- Classifications: PWD, Senior, Voter, 4Ps, Indigent,
  Solo Parent, OFW
- Household linkage
- Search/filter by purok/sex/classification
- Full profile view + edit + audit log
- Mobile card layout + desktop zebra stripes

### 4. Household Management ✅
- Auto-numbered HH-YYYY-XXXX
- Status: Active/Vacant/Demolished/Transferred/Condemned
- Block deletion if active residents
- Member list by role
- Mobile card layout + desktop zebra stripes

### 5. Officials Directory ✅
- 3 tabs: Barangay Officials | SK Officials | Barangay Tanod
- 90-day expiry warning
- Signature upload (PNG, Supabase Storage)
- Committee assignment
- Mobile card layout + desktop zebra stripes

### 6. Clearance & Certificate Generation ✅
- 7 document types (BC, CR, CI, GM, NI, FJ, BZ)
- Control numbers reset yearly
- 3-step issuance workflow
- QR code → public verify page
- Void with reason + Reprint tracking
- Standalone print page
- Paper size: Short Bond, A4, Long Bond
- Mobile card layout + desktop zebra stripes

### 7. Settings + User Management ✅
- Barangay info + dual logo upload
- Document fee/validity per type
- Purok + Incident type management
- User CRUD: create, role change, activate/deactivate,
  reset password, delete

### 8. Dynamic Settings Context ✅
- SettingsProvider wraps entire app
- useSettings() hook available everywhere
- Public API /api/barangay-info (service role client)

### 9. Blotter & Incident Management ✅
- KP Workflow: Filed → Summoned → Mediation →
  Settled/Referred/Dismissed
- Auto-generates SL/CFA/AS control numbers
- Print templates for all 3 documents
- Mobile card layout + desktop zebra stripes

### 10. Announcements ✅
- Categories + priority levels
- Image upload, expiry date, draft/publish toggle
- Facebook copy button
- Public announcement page (no login required)

### 11. Reports & Analytics ✅
- 5 Report Tabs: Population, Documents, Blotter,
  Households, Officials
- CSS bar charts + stat cards
- CSV export on all 5 reports
- Print/PDF pages for all 5 reports
- Mobile responsive tables

### 12. Vercel Deployment ✅
- Live at: https://bmis-tangub.vercel.app
- All 8 env vars configured in Vercel dashboard

---

## Modules Pending ❌

### Future
- [ ] Photo upload for residents
- [ ] Business Permits
- [ ] City-wide multi-barangay dashboard (Option B)
- [ ] Mobile app for residents (PWA)
- [ ] Custom domain (optional)

---

## User Roles

| Role | Description |
|---|---|
| super_admin | Full access |
| captain | All modules + settings |
| secretary | Most modules, issue docs, blotter, announcements |
| treasurer | Financial records |
| kagawad | View most, committees, announcements |
| sk_official | SK module |
| tanod | View blotter, patrol logs |
| encoder | Data entry, issue docs |
| qa | Read-only |

**Admin User:** djmirontos@gmail.com / super_admin

---

## Key Developer Decisions

- Orange gradient theme (#f4a020 → #e8820c → #c96008)
- CSS Modules — no inline styles (all pages refactored)
- Short bond paper default for printing
- Standalone print routes outside dashboard layout
- QR code on certificates links to /verify/[id] (public)
- Settings is single source of truth for barangay info
- .env.local as fallback only
- suppressHydrationWarning on body tag (Grammarly fix)
- middleware.ts exports proxy for Next.js 16 routing
- API routes use await params (Next.js 16 requirement)
- noImplicitAny: false for Vercel build compatibility
- useSearchParams wrapped in Suspense for dynamic pages
- Public API uses service role client (not cookie-based)
- Always use Python scripts for file edits (not heredoc)
- Mobile card layout: hidden table + visible cards on mobile
- Desktop zebra stripes: nth-child(even) on tableRow

---

## Known Issues & Fixes Applied

1.  Login silent fail → wrong anon key format
2.  Cross-origin blocked → allowedDevOrigins in next.config.ts
3.  middleware.ts deprecated → renamed proxy.ts + new middleware.ts
4.  Print page shows navbar → moved to /print/[id] standalone layout
5.  QR on page 2 → placed inline with signature block
6.  sanitizeAlphanumeric missing → renamed sanitizeHouseNumber
7.  Email confirmation blocking → disabled in Supabase Auth
8.  Hydration warning → suppressHydrationWarning on body
9.  Settings useState generic split → fixed to single line
10. Public announcements 404 → recreated [id] folder + client component
11. User delete 500 error → await params fix for Next.js 16
12. Users not loading in settings → fixed profile scope in useEffect
13. Vercel build — implicit any → noImplicitAny: false in tsconfig
14. Vercel build — duplicate TanodStatus → removed second declaration
15. Vercel build — duplicate BarangayOfficial → removed first declaration
16. Vercel build — useRef type → RefObject<HTMLInputElement | null>
17. Vercel build — useSearchParams → wrapped in Suspense boundary
18. Vercel build — force-dynamic → must come after 'use client'
19. Print toolbar visible on PDF → added no-print class to all
    5 report print pages
20. Login page logo missing on Vercel → fixed public API to use
    service role client instead of cookie-based client
21. Tables not mobile friendly → added card layout for all 5
    list pages with zebra stripes on desktop
22. Reports tables overflow on mobile → added overflow-x auto
    and responsive padding to reports CSS

---

## Git Commands

```bash
cd /workspaces/bmis-tangub/bmis
git add .
git commit -m "description"
git push origin main

# If push rejected (remote has changes)
git pull origin main --rebase
git push origin main

# Restart dev server
kill $(lsof -t -i:3000) 2>/dev/null; npm run dev
```

---

## Next Steps (In Order)

1.  ✅ Residents Registry
2.  ✅ Households Management
3.  ✅ Officials Directory
4.  ✅ Clearance & Certificate Generation
5.  ✅ Settings (logos, fees, puroks, incident types)
6.  ✅ Dynamic settings context (login, sidebar, dashboard)
7.  ✅ Blotter & Incident Management
8.  ✅ Announcements module
9.  ✅ User Management in Settings
10. ✅ Reports & Analytics
11. ✅ Deploy to Vercel
12. ✅ Update Supabase auth URLs for production
13. ✅ Fix login page logo on Vercel
14. ✅ Fix print toolbar on report PDFs
15. ✅ Mobile card layout for all list pages
16. ✅ Professional dashboard redesign
17. ⬜ Photo upload for residents
18. ⬜ City-wide multi-barangay dashboard
19. ⬜ Business Permits (future)
20. ⬜ PWA / Mobile app (future)

---

## How to Resume in New Claude Conversation

Paste this into a new chat:
"I am building BMIS for Barangay IV, Tangub City. Here is my
PROGRESS.md: [paste contents]. Please continue helping me."

---
*Last updated: May 2026 — Dashboard redesign completed*
*Live URL: https://bmis-tangub.vercel.app*
*Generated by Claude (Anthropic)*
