import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import type { AuthContext } from "../types";

/**
 * Registers a global `preHandler` that:
 *  1. Extracts the Bearer JWT issued by Supabase Auth from the Authorization header.
 *  2. Verifies it against Supabase (via the service-role client's auth.getUser).
 *  3. Loads the caller's tenant_id + role from `user_roles`.
 *  4. Loads the caller's `employees.id`, if any (most employee-scoped routes need it).
 *  5. Attaches all of this to `request.auth`.
 *
 * Routes that should be reachable without auth (health checks, etc.) can be
 * registered outside this plugin's scope, or you can add a path allow-list here.
 */
async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("auth", undefined);

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Allow unauthenticated health checks.
    if (request.url === "/health" || request.url === "/") return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or malformed Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length);

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    const userId = userData.user.id;

    const roleRow = await prisma.userRoleAssignment.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (!roleRow) {
      return reply.code(403).send({ error: "No tenant/role assignment found for this user" });
    }

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
 * Route-level guard: use inside a handler (or as a preHandler) to enforce
 * that only HR managers can proceed.
 *
 * Example:
 *   fastify.patch("/leaves/:id/approve", { preHandler: requireHrManager }, handler)
 */
export async function requireHrManager(request: FastifyRequest, reply: FastifyReply) {
  if (request.auth?.role !== "HR_MANAGER") {
    return reply.code(403).send({ error: "HR manager role required" });
  }
}
