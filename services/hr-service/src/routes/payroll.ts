import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireHrManager } from "../plugins/auth";

const calculatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export default async function payrollRoutes(fastify: FastifyInstance) {
  // GET /api/v1/payroll/me - Fetch payslips for authenticated employee
  fastify.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const { employeeId, tenantId } = request.auth ?? {};

    if (!employeeId || !tenantId) {
      return reply.code(404).send({ error: "No employee profile found for this user account" });
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId,
        tenantId,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return reply.send(payslips);
  });

  // GET /api/v1/payroll - Fetch all tenant payslips (HR Manager only)
  fastify.get(
    "/",
    { preHandler: requireHrManager },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.auth ?? {};

      if (!tenantId) {
        return reply.code(401).send({ error: "Unauthorized tenant request" });
      }

      const payslips = await prisma.payslip.findMany({
        where: { tenantId },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true,
              email: true,
            },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });

      return reply.send(payslips);
    }
  );

  // POST /api/v1/payroll/calculate - Bulk generate payslips (HR Manager only)
  fastify.post(
    "/calculate",
    { preHandler: requireHrManager },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { month, year } = calculatePayrollSchema.parse(request.body);
      const { tenantId } = request.auth ?? {};

      if (!tenantId) {
        return reply.code(401).send({ error: "Unauthorized tenant request" });
      }

      const employees = await prisma.employee.findMany({
        where: { tenantId },
      });

      if (employees.length === 0) {
        return reply.code(400).send({ error: "No active employees found for payroll calculation" });
      }

      const generatedPayslips = [];

      for (const emp of employees) {
        const grossEarnings = Number(emp.baseSalary);
        const pfDeduction = Math.round(grossEarnings * 0.12 * 100) / 100;
        const tdsDeduction = Math.round(grossEarnings * 0.05 * 100) / 100;
        const netPayable = grossEarnings - pfDeduction - tdsDeduction;

        const payslip = await prisma.payslip.upsert({
          where: {
            employeeId_month_year: {
              employeeId: emp.id,
              month,
              year,
            },
          },
          update: {
            grossEarnings,
            pfDeduction,
            tdsDeduction,
            netPayable,
            generatedAt: new Date(),
          },
          create: {
            tenantId,
            employeeId: emp.id,
            month,
            year,
            grossEarnings,
            pfDeduction,
            tdsDeduction,
            netPayable,
          },
        });

        generatedPayslips.push(payslip);
      }

      return reply.code(200).send({
        message: `Successfully calculated payroll for ${generatedPayslips.length} employees`,
        payslips: generatedPayslips,
      });
    }
  );

  // GET /api/v1/payroll/export-tally - Export data for accounting (HR Manager only)
  fastify.get(
    "/export-tally",
    { preHandler: requireHrManager },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        month: z.coerce.number().int().min(1).max(12),
        year: z.coerce.number().int().min(2000).max(2100),
      });

      const { month, year } = querySchema.parse(request.query);
      const { tenantId } = request.auth ?? {};

      if (!tenantId) {
        return reply.code(401).send({ error: "Unauthorized tenant request" });
      }

      const payslips = await prisma.payslip.findMany({
        where: { tenantId, month, year },
        include: {
          employee: {
            select: {
              employeeCode: true,
              firstName: true,
              lastName: true,
              pfNumber: true,
              panNumber: true,
            },
          },
        },
      });

      const exportData = payslips.map((p) => ({
        employee_code: p.employee.employeeCode,
        employee_name: `${p.employee.firstName} ${p.employee.lastName}`,
        pf_number: p.employee.pfNumber ?? "N/A",
        pan_number: p.employee.panNumber ?? "N/A",
        month: p.month,
        year: p.year,
        gross_earnings: Number(p.grossEarnings),
        pf_deduction: Number(p.pfDeduction),
        tds_deduction: Number(p.tdsDeduction),
        net_payable: Number(p.netPayable),
      }));

      return reply.send({
        period: `${month}/${year}`,
        records: exportData,
      });
    }
  );
}