# repo-hr-payroll

Multi-tenant HR & Payroll System.

- **Backend** — `services/hr-service`: Fastify + TypeScript API, Prisma ORM, Supabase Postgres + Auth + Storage.
- **Frontend** — `apps/hr-payroll`: Next.js (App Router) + React + Tailwind CSS dashboard with an Employee Self-Service view and an HR Admin view.
- **Database** — Supabase Postgres, multi-tenant via a `tenant_id` column on every table, enforced with Postgres Row-Level Security (RLS).

```
repo-hr-payroll/
├── services/hr-service/       # Fastify API
│   ├── prisma/schema.prisma   # Typed data model (mirrors supabase/migrations/0001_init.sql)
│   ├── prisma/seed.ts         # Demo tenant + users + sample data
│   └── src/
│       ├── plugins/auth.ts    # Verifies Supabase JWT, resolves tenant_id + role
│       ├── routes/            # attendance, leaves, claims, payroll
│       └── utils/payroll-calculator.ts
├── apps/hr-payroll/           # Next.js dashboard
│   └── src/
│       ├── app/ess/           # Employee Self-Service view
│       ├── app/admin/         # HR Admin view
│       ├── components/        # ClockInOut, LeaveForm, ClaimUpload, PayslipPreview,
│       │                      # PayrollBoard, ApprovalQueue, DeductionReport
│       └── lib/                # Supabase browser client + backend API client
└── supabase/migrations/0001_init.sql   # Tables, indexes, RLS policies, storage bucket
```

## 1. Prerequisites

- Node.js 18.18+
- A Supabase project (free tier is fine): https://supabase.com/dashboard
- Supabase CLI (optional but recommended): `npm i -g supabase`

## 2. Set up Supabase

1. Create a new Supabase project.
2. In **Project Settings → API**, copy `Project URL`, `anon public` key, and `service_role` key.
3. In **Project Settings → Database**, copy the connection string (use the pooled/`pgbouncer` URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`).
4. Apply the schema + RLS policies:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push --file supabase/migrations/0001_init.sql
   ```
   (Or paste the contents of `supabase/migrations/0001_init.sql` into the Supabase SQL editor and run it.)

## 3. Configure environment variables

```bash
cp services/hr-service/.env.example services/hr-service/.env
cp apps/hr-payroll/.env.example apps/hr-payroll/.env.local
```

Fill in both files with your Supabase project's URL and keys. **Never** put the `service_role` key in the frontend `.env.local` — it belongs only in `services/hr-service/.env`.

## 4. Install dependencies and generate the Prisma client

```bash
npm install
npm run prisma:generate
```

## 5. Seed demo data

Creates a demo tenant with one HR manager and two employees (via Supabase Auth admin API), plus sample attendance/leave/claim rows.

```bash
npm run prisma:seed
```

Demo logins (password `DemoPass123!`):
- `hr.manager@demo-hrpayroll.com` — HR_MANAGER role
- `asha.rao@demo-hrpayroll.com` — EMPLOYEE
- `rahul.mehta@demo-hrpayroll.com` — EMPLOYEE

## 6. Run the apps

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Sign in on the frontend via Supabase Auth (wire up your own `/login` page using `supabase.auth.signInWithPassword`, or use the Supabase Auth UI) — the dashboard components already read the session and call the API with the bearer token.

## How multi-tenancy + RLS work together

- Every table carries `tenant_id`. The backend never trusts a `tenant_id` sent by the client — it always resolves it server-side from `user_roles` (see `src/plugins/auth.ts`), based on the verified Supabase JWT.
- RLS policies in `supabase/migrations/0001_init.sql` are the last line of defense: even if a bug in the backend forwarded a client-supplied `tenant_id`, Postgres itself would reject cross-tenant reads/writes for anon/authenticated-key connections.
- The Fastify backend uses the Supabase **service role** key (via Prisma's `DATABASE_URL`, and via `supabaseAdmin` for storage signed URLs) which bypasses RLS — so authorization there is enforced entirely in application code (`requireHrManager`, tenant-scoped `where` clauses). Treat this backend as a trusted, audited boundary.
- Any direct client-to-Supabase calls (e.g. if you extend the frontend to query Supabase directly instead of via the API) go through the `anon` key and are fully subject to RLS.

## Payroll calculation assumptions

See the doc comment in `services/hr-service/src/utils/payroll-calculator.ts` for the exact formulas and the assumptions baked into "unpaid days," the PF wage ceiling, and the simplified TDS slab estimate. **Have your CA/finance team review and adjust these constants before using this for real statutory filings.**

## Tally export

`GET /api/v1/payroll/export-tally?month=&year=` (HR only) returns a read-only JSON summary of Salaries Payable / PF Payable / TDS Payable journal lines plus a per-employee breakdown, for a CA to review before importing into Tally. It does not post entries automatically.
