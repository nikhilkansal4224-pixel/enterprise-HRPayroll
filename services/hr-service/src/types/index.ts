export type AppUserRole = "EMPLOYEE" | "HR_MANAGER";

/**
 * Auth context attached to every authenticated request by the `auth` plugin.
 */
export interface AuthContext {
  userId: string; // Supabase auth.users.id
  tenantId: string;
  role: AppUserRole;
  employeeId?: string; // resolved employees.id for this user, if one exists
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
