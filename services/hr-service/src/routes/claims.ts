import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { requireHrManager } from "../plugins/auth";

const PROOF_BUCKET = "expense-proofs";

const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
});

const submitClaimSchema = z.object({
  claimType: z.string().min(1),
  amount: z.number().positive(),
  proofDocumentUrl: z.string().url().optional(),
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export default async function claimRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/claims/upload-url
   * Returns a short-lived signed URL the client uploads the proof document to
   * directly (bypassing the API for the file bytes). Path convention:
   * `${tenant_id}/${employee_id}/${timestamp}-${fileName}` — matches the
   * storage RLS policy in supabase/migrations/0001_init.sql.
   */
  fastify.post("/upload-url", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) return reply.code(400).send({ error: "No employee record linked" });

    const { fileName } = uploadUrlSchema.parse(request.body);
    const path = `${auth.tenantId}/${auth.employeeId}/${Date.now()}-${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .createSignedUploadUrl(path);

    if (error) return reply.code(500).send({ error: error.message });

    return reply.send({ data: { ...data, path } });
  });

  // POST /api/v1/claims/submit
  fastify.post("/submit", async (request, reply) => {
    const auth = request.auth!;
    if (!auth.employeeId) return reply.code(400).send({ error: "No employee record linked" });

    const body = submitClaimSchema.parse(request.body);

    const claim = await prisma.expenseClaim.create({
      data: {
        tenantId: auth.tenantId,
        employeeId: auth.employeeId,
        claimType: body.claimType,
        amount: body.amount,
        proofDocumentUrl: body.proofDocumentUrl,
        status: "PENDING",
      },
    });

    return reply.code(201).send({ data: claim });
  });

  // GET /api/v1/claims (self or HR, tenant-scoped)
  fastify.get("/", async (request, reply) => {
    const auth = request.auth!;
    const where =
      auth.role === "HR_MANAGER"
        ? { tenantId: auth.tenantId }
        : { tenantId: auth.tenantId, employeeId: auth.employeeId ?? "__none__" };

    const claims = await prisma.expenseClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ data: claims });
  });

  // PATCH /api/v1/claims/:id/review (HR only)
  fastify.patch(
    "/:id/review",
    { preHandler: requireHrManager },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = reviewSchema.parse(request.body);

      const claim = await prisma.expenseClaim.findFirst({ where: { id, tenantId: auth.tenantId } });
      if (!claim) return reply.code(404).send({ error: "Claim not found" });

      const updated = await prisma.expenseClaim.update({
        where: { id },
        data: { status: body.status },
      });

      return reply.send({ data: updated });
    }
  );
}
