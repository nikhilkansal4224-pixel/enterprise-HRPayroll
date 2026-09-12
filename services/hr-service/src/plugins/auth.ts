import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import type { AuthContext } from "../types";

/**
 * Global preHandler plugin for Fastify that:
 *  1. Skips authentication for OPTIONS preflights and public endpoints (/health, /).
 *  2. Extracts and trims the Bearer JWT from the Authorization header.
 *  3. Verifies the token using Supabase Auth (supabaseAdmin).
 *  4. Fetches the tenant, role, and associated employee profile from Prisma.
 *  5. Attaches the structured AuthContext to `request.auth`.
 */
async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("auth", undefined);

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Bypass auth for browser OPTIONS preflights and health endpoints
    if (request.method === "OPTIONS" || request.url === "/health" || request.url === "/") {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or malformed Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    // 2. Verify token with Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      request.log.warn({ err: userError }, "Supabase JWT verification failed");
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    const userId = userData.user.id;

    // 3. Look up user tenant and role assignment in database
    const roleRow = await prisma.userRoleAssignment.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (!roleRow) {
      return reply.code(403).send({ error: "No tenant/role assignment found for this user" });
    }

    // 4. Resolve the associated employee record ID (if present)
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
 * Route-level guard: Enforces that only users with the 'HR_MANAGER' role can access the endpoint.
 */
export async function requireHrManager(request: FastifyRequest, reply: FastifyReply) {
  if (request.auth?.role !== "HR_MANAGER") {
    return reply.code(403).send({ error: "HR manager role required" });
  }
}