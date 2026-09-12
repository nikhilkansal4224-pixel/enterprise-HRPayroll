-- =============================================================================
-- HR & Payroll System — initial schema + Row-Level Security
-- Run via: supabase db push   (or paste into the Supabase SQL editor)
-- This file is the source of truth for RLS. Prisma (services/hr-service/prisma)
-- is kept structurally in sync with this file for application-side typed access.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type attendance_status as enum ('PRESENT', 'ABSENT', 'HALF_DAY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum ('SICK', 'CASUAL', 'EARNED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('EMPLOYEE', 'HR_MANAGER');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- user_roles: maps auth.users -> tenant + role. This is the backbone of RLS.
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       user_role not null default 'EMPLOYEE',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  employee_code  varchar(50) not null,
  first_name     varchar(100) not null,
  last_name      varchar(100) not null,
  email          varchar(255) not null,
  department     varchar(100),
  designation    varchar(100),
  base_salary    decimal(12, 2) not null,
  pf_number      varchar(50),
  pan_number     varchar(20),
  created_at     timestamptz not null default now(),
  unique (tenant_id, employee_code)
);
create index if not exists idx_employees_tenant on public.employees(tenant_id);
create index if not exists idx_employees_user on public.employees(user_id);

-- ---------------------------------------------------------------------------
-- attendance_logs
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  log_date        date not null,
  check_in        timestamptz,
  check_out       timestamptz,
  status          attendance_status not null default 'PRESENT',
  overtime_hours  decimal(5, 2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (employee_id, log_date)
);
create index if not exists idx_attendance_tenant on public.attendance_logs(tenant_id);
create index if not exists idx_attendance_emp_date on public.attendance_logs(employee_id, log_date);

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  leave_type   leave_type not null,
  start_date   date not null,
  end_date     date not null,
  total_days   decimal(4, 1) not null,
  reason       text,
  status       leave_status not null default 'PENDING',
  approved_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_leaves_tenant on public.leave_requests(tenant_id);
create index if not exists idx_leaves_employee on public.leave_requests(employee_id);

-- ---------------------------------------------------------------------------
-- expense_claims
-- ---------------------------------------------------------------------------
create table if not exists public.expense_claims (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  employee_id         uuid not null references public.employees(id) on delete cascade,
  claim_type          varchar(100) not null,
  amount              decimal(12, 2) not null,
  proof_document_url  text,
  status              claim_status not null default 'PENDING',
  created_at          timestamptz not null default now()
);
create index if not exists idx_claims_tenant on public.expense_claims(tenant_id);
create index if not exists idx_claims_employee on public.expense_claims(employee_id);

-- ---------------------------------------------------------------------------
-- payslips
-- ---------------------------------------------------------------------------
create table if not exists public.payslips (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  month           int not null check (month between 1 and 12),
  year            int not null check (year between 2000 and 2100),
  gross_earnings  decimal(12, 2) not null,
  pf_deduction    decimal(12, 2) not null,
  tds_deduction   decimal(12, 2) not null,
  net_payable     decimal(12, 2) not null,
  generated_at    timestamptz not null default now(),
  unique (employee_id, month, year)
);
create index if not exists idx_payslips_tenant on public.payslips(tenant_id);

-- ---------------------------------------------------------------------------
-- Supabase Storage bucket for expense-claim proof documents
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-proofs', 'expense-proofs', false)
on conflict (id) do nothing;

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.user_roles      enable row level security;
alter table public.employees       enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.expense_claims  enable row level security;
alter table public.payslips        enable row level security;

-- Helper: is the current JWT holder an HR_MANAGER for the given tenant?
create or replace function public.is_hr_manager(p_tenant_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = p_tenant_id
      and ur.role = 'HR_MANAGER'
  );
$$;

-- Helper: current user's own employee row id(s) for a given tenant
create or replace function public.owns_employee(p_employee_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee_id
      and e.user_id = auth.uid()
  );
$$;

-- --- user_roles: users can read their own role row; HR can read all in tenant
create policy "user_roles_self_select" on public.user_roles
  for select using (user_id = auth.uid() or public.is_hr_manager(tenant_id));

-- --- employees: self read/update own row; HR full access within tenant
create policy "employees_self_select" on public.employees
  for select using (user_id = auth.uid() or public.is_hr_manager(tenant_id));

create policy "employees_self_update" on public.employees
  for update using (user_id = auth.uid() or public.is_hr_manager(tenant_id));

create policy "employees_hr_insert" on public.employees
  for insert with check (public.is_hr_manager(tenant_id));

create policy "employees_hr_delete" on public.employees
  for delete using (public.is_hr_manager(tenant_id));

-- --- attendance_logs: employee manages their own; HR manages all in tenant
create policy "attendance_self_select" on public.attendance_logs
  for select using (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

create policy "attendance_self_insert" on public.attendance_logs
  for insert with check (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

create policy "attendance_self_update" on public.attendance_logs
  for update using (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

-- --- leave_requests: employee creates/reads own; only HR can update (approve/reject)
create policy "leaves_self_select" on public.leave_requests
  for select using (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

create policy "leaves_self_insert" on public.leave_requests
  for insert with check (public.owns_employee(employee_id));

create policy "leaves_hr_update" on public.leave_requests
  for update using (public.is_hr_manager(tenant_id));

-- --- expense_claims: employee creates/reads own; HR reviews all in tenant
create policy "claims_self_select" on public.expense_claims
  for select using (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

create policy "claims_self_insert" on public.expense_claims
  for insert with check (public.owns_employee(employee_id));

create policy "claims_hr_update" on public.expense_claims
  for update using (public.is_hr_manager(tenant_id));

-- --- payslips: employee reads own; only HR (via service role backend) writes
create policy "payslips_self_select" on public.payslips
  for select using (public.owns_employee(employee_id) or public.is_hr_manager(tenant_id));

create policy "payslips_hr_write" on public.payslips
  for insert with check (public.is_hr_manager(tenant_id));

create policy "payslips_hr_update" on public.payslips
  for update using (public.is_hr_manager(tenant_id));

-- ---------------------------------------------------------------------------
-- Storage RLS: employees can upload/read only their own proof documents,
-- stored under a path convention of `${tenant_id}/${employee_id}/...`.
-- ---------------------------------------------------------------------------
create policy "expense_proofs_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'expense-proofs'
    and (storage.foldername(name))[2]::uuid in (
      select id from public.employees where user_id = auth.uid()
    )
  );

create policy "expense_proofs_owner_select" on storage.objects
  for select using (
    bucket_id = 'expense-proofs'
    and (
      (storage.foldername(name))[2]::uuid in (
        select id from public.employees where user_id = auth.uid()
      )
      or public.is_hr_manager((storage.foldername(name))[1]::uuid)
    )
  );
