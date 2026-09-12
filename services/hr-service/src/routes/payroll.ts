import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AttendanceLog, Payslip } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireHrManager } from "../plugins/auth";
import { calculatePayroll } from "../utils/payroll-calculator";

export default async function payrollRoutes(fastify: FastifyInstance) {
  fastify.get("/me", async (request, reply) => {
    // request.auth is populated by authPlugin
    const { employeeId, tenantId } = request.auth ?? {};

    if (!employeeId) {
      return reply.code(404).send({ error: "No employee profile found for this user account" });
    }

    const payslips = await fastify.prisma.payslip.findMany({
      where: {
        employeeId,
        tenantId,
      },
      orderBy: { year: "desc", month: "desc" },
    });

    return reply.send(payslips);
  });
}
const calculateSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  employeeId: z.string().uuid().optional(), // omit to run for the whole tenant
  persist: z.boolean().optional().default(true), // write payslip rows
});

const exportTallySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
});


  /**
   * POST /api/v1/payroll/calculate  (HR only)
   * Calculates payroll for one employee, or the whole tenant if `employeeId`
   * is omitted. Persists results to `payslips` unless `persist: false`.
   */
  fastify.post(
    "/calculate",
    { preHandler: requireHrManager },
    async (request, reply) => {
      const auth = request.auth!;
      const body = calculateSchema.parse(request.body);

      const employees = await prisma.employee.findMany({
        where: {
          tenantId: auth.tenantId,
          ...(body.employeeId ? { id: body.employeeId } : {}),
        },
      });

      if (employees.length === 0) {
        return reply.code(404).send({ error: "No matching employee(s) found for this tenant" });
      }

      const monthStart = new Date(body.year, body.month - 1, 1);
      const monthEnd = new Date(body.year, body.month, 1);

      const results = [];

      for (const emp of employees) {
        const logs = await prisma.attendanceLog.findMany({
          where: { employeeId: emp.id, logDate: { gte: monthStart, lt: monthEnd } },
        });

        const absentDays = logs.filter((l: AttendanceLog) => l.status === "ABSENT").length;
        const halfDays = logs.filter((l: AttendanceLog) => l.status === "HALF_DAY").length;

        const payroll = calculatePayroll({
          baseSalary: Number(emp.baseSalary),
          month: body.month,
          year: body.year,
          absentDays,
          halfDays,
        });

        let payslipId: string | undefined;

        if (body.persist) {
          const payslip = await prisma.payslip.upsert({
            where: { employeeId_month_year: { employeeId: emp.id, month: body.month, year: body.year } },
            update: {
              grossEarnings: payroll.grossEarnings,
              pfDeduction: payroll.pfDeduction,
              tdsDeduction: payroll.tdsDeduction,
              netPayable: payroll.netPayable,
              generatedAt: new Date(),
            },
            create: {
              tenantId: auth.tenantId,
              employeeId: emp.id,
              month: body.month,
              year: body.year,
              grossEarnings: payroll.grossEarnings,
              pfDeduction: payroll.pfDeduction,
              tdsDeduction: payroll.tdsDeduction,
              netPayable: payroll.netPayable,
            },
          });
          payslipId = payslip.id;
        }

        results.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          payslipId,
          ...payroll,
        });
      }

      return reply.send({ data: results });
    }
  );

  /**
   * GET /api/v1/payroll/export-tally?month=&year=  (HR only)
   * Produces a read-only JSON payload summarizing finalized payroll journals
   * for the month: Salaries Payable, PF liability, and TDS liability — the
   * three ledger heads a CA typically needs to post/import into Tally.
   */
  fastify.get(
    "/export-tally",
    { preHandler: requireHrManager },
    async (request, reply) => {
      const auth = request.auth!;
      const query = exportTallySchema.parse(request.query);

      const payslips = await prisma.payslip.findMany({
        where: { tenantId: auth.tenantId, month: query.month, year: query.year },
        include: { employee: { select: { employeeCode: true, firstName: true, lastName: true, department: true } } },
      });

      if (payslips.length === 0) {
        return reply.code(404).send({ error: "No finalized payslips found for this period" });
      }

      type PayslipWithEmployee = Payslip & {
        employee: { employeeCode: string; firstName: string; lastName: string; department: string | null };
      };

      const totals = payslips.reduce(
        (acc: { grossEarnings: number; pf: number; tds: number; netPayable: number }, p: PayslipWithEmployee) => {
          acc.grossEarnings += Number(p.grossEarnings);
          acc.pf += Number(p.pfDeduction);
          acc.tds += Number(p.tdsDeduction);
          acc.netPayable += Number(p.netPayable);
          return acc;
        },
        { grossEarnings: 0, pf: 0, tds: 0, netPayable: 0 }
      );

      const payload = {
        tenantId: auth.tenantId,
        period: { month: query.month, year: query.year },
        generatedAt: new Date().toISOString(),
        ledgerSummary: {
          salariesPayable: round2(totals.netPayable),
          pfLiability: round2(totals.pf),
          tdsLiability: round2(totals.tds),
          grossSalaryExpense: round2(totals.grossEarnings),
        },
        journalLines: [
          { ledger: "Salary Expense (Dr)", amount: round2(totals.grossEarnings) },
          { ledger: "PF Payable (Cr)", amount: round2(totals.pf) },
          { ledger: "TDS Payable (Cr)", amount: round2(totals.tds) },
          { ledger: "Salaries Payable / Bank (Cr)", amount: round2(totals.netPayable) },
        ],
        employeeBreakdown: payslips.map((p: PayslipWithEmployee) => ({
          employeeCode: p.employee.employeeCode,
          name: `${p.employee.firstName} ${p.employee.lastName}`,
          department: p.employee.department,
          grossEarnings: Number(p.grossEarnings),
          pfDeduction: Number(p.pfDeduction),
          tdsDeduction: Number(p.tdsDeduction),
          netPayable: Number(p.netPayable),
        })),
        note:
          "This export is a read-only summary for CA review prior to Tally ingestion. It does not post entries automatically.",
      };

      return reply.send({ data: payload });
    }
  );

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
