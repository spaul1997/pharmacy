import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import routes from "./routes/index.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const shouldServeFrontend =
  process.env.SERVE_FRONTEND !== "false" && fs.existsSync(frontendIndexPath);
const staticMaxAge = process.env.NODE_ENV === "production" ? "1d" : 0;

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN)?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin: corsOrigins?.length ? corsOrigins : true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", routes);

if (shouldServeFrontend) {
  app.use(
    express.static(frontendDistPath, {
      index: false,
      maxAge: staticMaxAge,
    })
  );

  app.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.path.startsWith("/api") ||
      !req.accepts("html")
    ) {
      return next();
    }

    return res.sendFile(frontendIndexPath);
  });
}

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  res.status(statusCode).json({
    message: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
});

export default app;
