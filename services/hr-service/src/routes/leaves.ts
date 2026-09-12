import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireHrManager } from "../plugins/auth";

const leaveRequestSchema = z.object({
  leaveType: z.enum(["SICK", "CASUAL", "EARNED"]),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().max(1000).optional(),
});

const approveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export default async function leaveRoutes(fastify: FastifyInstance) {
  // POST /api/v1/leaves/request
  fastify.post("/request", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) {
      return reply.code(400).send({ error: "No employee record linked to this user" });
    }

    const body = leaveRequestSchema.parse(request.body);
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);

    if (end < start) {
      return reply.code(400).send({ error: "endDate must be on or after startDate" });
    }

    const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

    const leave = await prisma.leaveRequest.create({
      data: {
        tenantId: auth.tenantId,
        employeeId: auth.employeeId,
        leaveType: body.leaveType,
        startDate: start,
        endDate: end,
        totalDays,
        reason: body.reason,
        status: "PENDING",
      },
    });

    return reply.code(201).send({ data: leave });
  });

  // GET /api/v1/leaves  (self: own requests; HR: all requests in tenant)
  fastify.get("/", async (request, reply) => {
    const auth = request.auth!;
    const where =
      auth.role === "HR_MANAGER"
        ? { tenantId: auth.tenantId }
        : { tenantId: auth.tenantId, employeeId: auth.employeeId ?? "__none__" };

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ data: leaves });
  });

  // PATCH /api/v1/leaves/:id/approve  (HR only)
  fastify.patch(
    "/:id/approve",
    { preHandler: requireHrManager },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = approveSchema.parse(request.body);

      const leave = await prisma.leaveRequest.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (!leave) return reply.code(404).send({ error: "Leave request not found" });

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: body.status, approvedBy: auth.userId },
      });

      return reply.send({ data: updated });
    }
  );
}
