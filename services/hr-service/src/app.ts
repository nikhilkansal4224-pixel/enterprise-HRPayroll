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

  // CORS configuration for local dev and production Vercel frontend
  app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  });

  app.register(sensible);

  // Auth plugin registered before route groups so preHandler hooks apply
  app.register(authPlugin);

  // Root landing route (fixes GET / 404 response)
  app.get("/", async () => ({
    status: "online",
    service: "hr-service",
    version: "1.0.0",
    documentation: "/health",
    endpoints: {
      health: "/health",
      attendance: "/api/v1/attendance",
      leaves: "/api/v1/leaves",
      claims: "/api/v1/claims",
      payroll: "/api/v1/payroll",
    },
  }));

  // Health check endpoint for Render/uptime services
  app.get("/health", async () => ({
    status: "ok",
    service: "hr-service",
    timestamp: new Date().toISOString(),
  }));

  // Registered API routes with prefix v1
  app.register(attendanceRoutes, { prefix: "/api/v1/attendance" });
  app.register(leaveRoutes, { prefix: "/api/v1/leaves" });
  app.register(claimRoutes, { prefix: "/api/v1/claims" });
  app.register(payrollRoutes, { prefix: "/api/v1/payroll" });

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation failed",
        details: error.flatten(),
      });
    }

    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      error: error.message ?? "Internal Server Error",
    });
  });

  return app;
}