# ConstructOS

ConstructOS is the operating system for construction companies: company operations first, with an integrated materials marketplace.

## Current foundation

- Next.js 15 / React 19 / TypeScript app shell
- Responsive operations dashboard & specialized **Field Worker Dashboard**
- Supabase Auth (email/password, Google OAuth, password reset)
- Session-protected routes via `@supabase/ssr` middleware
- Tenant-scoped reads across all domains enforced by Postgres Row Level Security (RLS)
- Dynamic inventory material assignment with stock validation, automatic deduction, and unassignment reversion
- Full procurement flow: Vendors → Catalog Products → RFQs → Quotes → Purchase Orders → Automatic Stock Receiving
- Dedicated Team & People management with custom role creation
- Documents domain backed by Supabase Storage with project file linking
- Live system audit trail backed by `audit_logs`
- Multi-language UI localization (English, Albanian, Macedonian) with real-time storage sync
- Versioned Supabase/PostgreSQL schema in `supabase/migrations/`

## Project layout

```text
app/
  (auth)/login/        # sign in / sign up / reset password
  auth/callback/       # OAuth + email-confirmation code exchange
  _components/         # private client components (Dashboard, WorkerDashboard, GlobalModals)
  actions/             # server actions (inventory, marketplace, people, documents)
  projects/            # project index & deep [id] detail views
  inventory/           # warehouse inventory management
  people/              # team members, invites & role permissions
  documents/           # file repository & project docs
  marketplace/         # vendors, products, RFQs, quotes & purchase orders
lib/
  supabase/            # browser + server clients and the session middleware
  data.ts              # tenant-scoped query layer for all domains & audit logs
  format.ts            # shared display helpers (dates, currency, colors)
  translations.ts      # EN, SQ, MK translation dictionaries & useLanguage hook
middleware.ts          # refreshes sessions and guards routes
supabase/migrations/   # versioned schema, RLS policies, onboarding RPC & material assignments
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
   - `002_auth_and_onboarding.sql` — low-stock flag + `create_company` RPC with starter projects, tasks & inventory
   - `003_project_inventory.sql` — `project_inventory_assignments` schema and RLS policies
   - `004_financing_and_payments.sql` — `project_payments` table, unit costs, hourly rates & financial RLS policies

3. If you use Google OAuth, add the provider in Supabase and set the redirect
   URL to `http://localhost:3000/auth/callback`.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

The first time a user signs up, they land on a **Create your workspace** step.
Submitting it calls `create_company(...)`, which provisions a company, makes the
user its owner, and seeds starter projects, tasks, and inventory materials — so the workspace is
populated immediately. Every subsequent read is scoped to that company through
row-level security.

## Key Operational Capabilities

* **Financial Accounting & Costing Engine**: Live project cost breakdowns calculating allocated inventory material costs (quantity × unit cost), assigned team labor rates, and logged direct invoices/expenses against contract budgets to calculate live net margins and profit percentages.
* **Field Worker Portal**: Normal workers (`employee` role) automatically see a site-tailored dashboard focused on their daily duties, project sites, allocated site materials, shift clock-in timers, and shift logs.
* **Inventory Stock Control**: You can only assign inventory quantities that you currently possess in stock. Assigning materials to a project subtracts from stock; removing materials automatically reverts/restores quantity to central stock.
* **Marketplace Auto-Stock Sync**: Receiving Purchase Order goods in the Marketplace increments existing inventory stock or registers new materials automatically.
* **Audit Trail**: Operational actions across inventory, projects, and marketplace are logged in `audit_logs` and rendered in the live activity feed.

## GitHub Pages preview

The repository root contains a static, responsive ConstructOS dashboard preview
in `index.html`. To publish it without GitHub Actions, open **Settings → Pages**
in GitHub and choose:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/ (root)`

GitHub will publish it at:

`https://aa32608.github.io/construction-app/`

The full Next.js application remains the production app in the repository. Deploy the full app to a Next.js host such as Vercel, or run it with `npm run start`, and configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` there.
