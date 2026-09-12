import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import type { AuthContext } from "../types";

/**
 * Global Fastify preHandler plugin that:
 *  1. Skips auth verification for browser OPTIONS preflight requests and public routes (/health, /).
 *  2. Extracts and trims the Bearer JWT from the Authorization header.
 *  3. Verifies the token using Supabase Auth (supabaseAdmin).
 *  4. Resolves the user's active tenant_id + role from user_roles in Prisma.
 *  5. Retrieves the associated employee ID, if present.
 *  6. Attaches the constructed AuthContext object to `request.auth`.
 */
async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("auth", undefined);

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // -------------------------------------------------------------------------
    // PREFLIGHT & PUBLIC ROUTE BYPASS PATTERN
    // -------------------------------------------------------------------------
    // Browser preflight OPTIONS requests do not carry Authorization headers.
    // Skips authentication checks for OPTIONS, /, and /health routes.
    if (request.method === "OPTIONS" || request.url === "/health" || request.url === "/") {
      return;
    }

    // 1. Extract Bearer Token Header
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or malformed Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    // 2. Verify JWT with Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      request.log.warn({ err: userError }, "Supabase JWT verification failed");
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    const userId = userData.user.id;

    // 3. Look up user tenant and role assignment in Prisma
    const roleRow = await prisma.userRoleAssignment.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (!roleRow) {
      return reply.code(403).send({ error: "No tenant/role assignment found for this user" });
    }

    // 4. Resolve associated employee record (if present)
    const employee = await prisma.employee.findFirst({
      where: { userId, tenantId: roleRow.tenantId },
      select: { id: true },
    });

    const auth: AuthContext = {
      userId,
      tenantId: roleRow.tenantId,
      role: roleRow.role,
      employeeId: employee?.id,
    };

    request.auth = auth;
  });
}

export default fp(authPlugin, { name: "auth-plugin" });

/**
 * Route-level guard: Enforces that only users with the 'HR_MANAGER' role can proceed.
 *
 * Usage:
 *   fastify.patch("/leaves/:id/approve", { preHandler: requireHrManager }, handler);
 */
export async function requireHrManager(request: FastifyRequest, reply: FastifyReply) {
  if (request.auth?.role !== "HR_MANAGER") {
    return reply.code(403).send({ error: "HR manager role required" });
  }
}