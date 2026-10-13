import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { webRouter } from "./routes/web/index.js";
import { appRouter } from "./routes/app/index.js";
import { prisma } from "./lib/prisma.js";

const server = express();
server.disable("x-powered-by");
server.use(helmet());
server.use(
  cors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? false,
    credentials: true,
  }),
);
server.use(express.json({ limit: "1mb" }));
server.use(cookieParser());
server.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
server.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "savvy-api",
    database: "postgresql-configured",
    timestamp: new Date().toISOString(),
  }),
);
server.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "postgresql", connected: true });
  } catch (error) {
    console.error("PostgreSQL health check failed:", error);
    res
      .status(503)
      .json({ ok: false, database: "postgresql", connected: false });
  }
});
server.use("/api/web/v1", webRouter);
server.use("/api/app/v1", appRouter);
server.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }),
);
server.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  },
);
const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => console.log(`Savvy API listening on :${port}`));
