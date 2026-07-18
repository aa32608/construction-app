# ConstructOS

ConstructOS is the operating system for construction companies: company operations first, with an integrated materials marketplace.

## Current foundation

- Next.js 15 / React 19 / TypeScript app shell
- Responsive premium operations dashboard
- Supabase Auth (email/password, Google OAuth, password reset)
- Session-protected routes via `@supabase/ssr` middleware
- Tenant-scoped dashboard reads (projects, tasks, inventory) enforced by RLS
- Create project / create task / toggle task wired to the database
- Light/dark mode and mobile navigation
- Versioned Supabase/PostgreSQL schema in `supabase/migrations/`

## Project layout

```text
app/
  (auth)/login/        # sign in / sign up / reset password
  auth/callback/       # OAuth + email-confirmation code exchange
  _components/         # private (non-routing) client components
  page.tsx             # server component: auth gate + initial tenant data
lib/
  supabase/            # browser + server clients and the session middleware
  data.ts              # tenant-scoped query layer for the dashboard
  format.ts            # shared display helpers (dates, currency, colors)
middleware.ts          # refreshes sessions and guards routes
supabase/migrations/   # versioned schema, RLS and onboarding RPC
```

## Run locally

1. Copy the env template and fill in your Supabase project credentials
   (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

2. Apply the migrations to your Supabase database (SQL editor or
   `supabase db push`):

   - `001_initial_schema.sql` — tables, enums, RLS policies, profile trigger
   - `002_auth_and_onboarding.sql` — low-stock flag + `create_company` RPC

3. If you use Google OAuth, add the provider in Supabase and set the redirect
   URL to `http://localhost:3000/auth/callback`.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

The first time a user signs up, they land on a **Create your workspace** step.
Submitting it calls `create_company(...)`, which provisions a company, makes the
user its owner, and seeds starter projects and tasks — so the dashboard is
populated immediately. Every subsequent read is scoped to that company through
row-level security.

## Architecture notes

- **Auth state** lives in cookies managed by `@supabase/ssr`. The middleware
  refreshes the session on each request and redirects unauthenticated users to
  `/login`.
- **Tenant isolation** is enforced by Postgres RLS (`is_company_member` /
  `has_company_role` helpers). The app simply assumes it only ever sees rows
  the signed-in user is allowed to see.
- **The dashboard** is a Server Component that loads the active company's data
  up front and hands it to a client component for interactivity; mutations use
  the browser client and `router.refresh()` to re-run the server query.

The next implementation steps are deeper project/task detail views and the
people, inventory, documents and marketplace domains.
