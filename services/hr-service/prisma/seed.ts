/**
 * Seed script — populates a demo tenant with an HR manager, two employees,
 * attendance logs, a leave request, and an expense claim.
 *
 * IMPORTANT: This script uses the Supabase service-role key to create real
 * auth.users entries (so RLS `auth.uid()` checks work end-to-end), then
 * writes application rows via Prisma.
 *
 * Run with: npm run prisma:seed --workspace=services/hr-service
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment to run the seed script."
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

async function createAuthUser(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error && !error.message.includes("already been registered")) {
    throw error;
  }
  if (data?.user) return data.user.id;

  // User already exists — look it up.
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not find or create user ${email}`);
  return existing.id;
}

async function main() {
  console.log("Seeding demo tenant:", TENANT_ID);

  const hrUserId = await createAuthUser("hr.manager@demo-hrpayroll.com", "DemoPass123!");
  const emp1UserId = await createAuthUser("asha.rao@demo-hrpayroll.com", "DemoPass123!");
  const emp2UserId = await createAuthUser("rahul.mehta@demo-hrpayroll.com", "DemoPass123!");

  await prisma.userRoleAssignment.upsert({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId: hrUserId } },
    update: { role: "HR_MANAGER" },
    create: { tenantId: TENANT_ID, userId: hrUserId, role: "HR_MANAGER" },
  });
  await prisma.userRoleAssignment.upsert({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId: emp1UserId } },
    update: { role: "EMPLOYEE" },
    create: { tenantId: TENANT_ID, userId: emp1UserId, role: "EMPLOYEE" },
  });
  await prisma.userRoleAssignment.upsert({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId: emp2UserId } },
    update: { role: "EMPLOYEE" },
    create: { tenantId: TENANT_ID, userId: emp2UserId, role: "EMPLOYEE" },
  });

  const asha = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: TENANT_ID, employeeCode: "EMP-001" } },
    update: {},
    create: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      userId: emp1UserId,
      employeeCode: "EMP-001",
      firstName: "Asha",
      lastName: "Rao",
      email: "asha.rao@demo-hrpayroll.com",
      department: "Engineering",
      designation: "Software Engineer",
      baseSalary: 85000,
      pfNumber: "PF-KA-0001",
      panNumber: "ABCDE1234F",
    },
  });

  const rahul = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: TENANT_ID, employeeCode: "EMP-002" } },
    update: {},
    create: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      userId: emp2UserId,
      employeeCode: "EMP-002",
      firstName: "Rahul",
      lastName: "Mehta",
      email: "rahul.mehta@demo-hrpayroll.com",
      department: "Finance",
      designation: "Accounts Executive",
      baseSalary: 52000,
      pfNumber: "PF-KA-0002",
      panNumber: "FGHIJ5678K",
    },
  });

  const today = new Date();
  await prisma.attendanceLog.upsert({
    where: { employeeId_logDate: { employeeId: asha.id, logDate: today } },
    update: {},
    create: {
      tenantId: TENANT_ID,
      employeeId: asha.id,
      logDate: today,
      checkIn: new Date(today.setHours(9, 30, 0, 0)),
      status: "PRESENT",
    },
  });

  await prisma.leaveRequest.create({
    data: {
      tenantId: TENANT_ID,
      employeeId: rahul.id,
      leaveType: "CASUAL",
      startDate: new Date(today.getFullYear(), today.getMonth(), 20),
      endDate: new Date(today.getFullYear(), today.getMonth(), 21),
      totalDays: 2,
      reason: "Family function",
      status: "PENDING",
    },
  });

  await prisma.expenseClaim.create({
    data: {
      tenantId: TENANT_ID,
      employeeId: asha.id,
      claimType: "Travel",
      amount: 1450.0,
      proofDocumentUrl: null,
      status: "PENDING",
    },
  });

  console.log("Seed complete.");
  console.log({ TENANT_ID, hrUserId, asha: asha.id, rahul: rahul.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
