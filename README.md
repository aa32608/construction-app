# ConstructOS

ConstructOS is the operating system for construction companies: company operations first, with an integrated materials marketplace.

## Current foundation

- Next.js 15 / TypeScript app shell
- Responsive premium operations dashboard
- Projects, tasks, people, inventory, documents, marketplace and notifications navigation
- Light/dark mode and mobile navigation
- Initial Supabase/PostgreSQL schema in `supabase/migrations/001_initial_schema.sql`
- Tenant isolation policies and role-aware policies for owner, manager, engineer and employee
- Auth profile trigger and audit log foundation

## Run locally

```bash
npm install
npm run dev
```

## Product architecture

Each future domain should live behind its own route and data layer:

```text
app/
  (auth)/              # login, register, reset password
  (app)/               # authenticated shell
    dashboard/
    projects/
    tasks/
    people/
    inventory/
    documents/
    marketplace/
    reports/
components/            # shared UI and shell components
lib/
  supabase/             # browser/server clients and auth helpers
  permissions.ts        # centralized role checks
supabase/migrations/    # versioned schema and RLS
```

The next implementation step is wiring Supabase Auth and the authenticated shell to this schema, then replacing dashboard fixtures with tenant-scoped queries.
