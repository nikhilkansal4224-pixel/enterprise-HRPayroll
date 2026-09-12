import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const checkInSchema = z.object({
  logDate: z.string().date().optional(), // defaults to today
});

const checkOutSchema = z.object({
  logDate: z.string().date().optional(),
  overtimeHours: z.number().min(0).max(24).optional(),
});

export default async function attendanceRoutes(fastify: FastifyInstance) {
  // POST /api/v1/attendance/check-in
  fastify.post("/check-in", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) {
      return reply.code(400).send({ error: "No employee record linked to this user" });
    }

    const body = checkInSchema.parse(request.body ?? {});
    const logDate = body.logDate ? new Date(body.logDate) : startOfToday();

    const log = await prisma.attendanceLog.upsert({
      where: { employeeId_logDate: { employeeId: auth.employeeId, logDate } },
      update: { checkIn: new Date(), status: "PRESENT" },
      create: {
        tenantId: auth.tenantId,
        employeeId: auth.employeeId,
        logDate,
        checkIn: new Date(),
        status: "PRESENT",
      },
    });

    return reply.code(200).send({ data: log });
  });

  // POST /api/v1/attendance/check-out
  fastify.post("/check-out", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) {
      return reply.code(400).send({ error: "No employee record linked to this user" });
    }

    const body = checkOutSchema.parse(request.body ?? {});
    const logDate = body.logDate ? new Date(body.logDate) : startOfToday();

    const existing = await prisma.attendanceLog.findUnique({
      where: { employeeId_logDate: { employeeId: auth.employeeId, logDate } },
    });

    if (!existing) {
      return reply.code(400).send({ error: "No check-in found for this date. Check in first." });
    }

    const log = await prisma.attendanceLog.update({
      where: { id: existing.id },
      data: {
        checkOut: new Date(),
        overtimeHours: body.overtimeHours ?? existing.overtimeHours,
      },
    });

    return reply.code(200).send({ data: log });
  });

  // GET /api/v1/attendance/me?month=&year=
  fastify.get("/me", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) return reply.code(400).send({ error: "No employee record linked" });

    const query = z
      .object({ month: z.coerce.number().min(1).max(12).optional(), year: z.coerce.number().optional() })
      .parse(request.query ?? {});

    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const logs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: auth.employeeId,
        logDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      orderBy: { logDate: "asc" },
    });

    return reply.send({ data: logs });
  });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
