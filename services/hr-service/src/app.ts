import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import authPlugin from "./plugins/auth";
import attendanceRoutes from "./routes/attendance";
import leaveRoutes from "./routes/leaves";
import claimRoutes from "./routes/claims";
import payrollRoutes from "./routes/payroll";
import { ZodError } from "zod";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  });
  app.register(sensible);

  // Auth must be registered before route groups so its preHandler hook applies.
  app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok", service: "hr-service" }));

  app.register(attendanceRoutes, { prefix: "/api/v1/attendance" });
  app.register(leaveRoutes, { prefix: "/api/v1/leaves" });
  app.register(claimRoutes, { prefix: "/api/v1/claims" });
  app.register(payrollRoutes, { prefix: "/api/v1/payroll" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Validation failed", details: error.flatten() });
    }
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({ error: error.message ?? "Internal Server Error" });
  });

  return app;
}
