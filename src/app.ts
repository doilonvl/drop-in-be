import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import uploadRoutes from "./routes/upload.routes";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import homeContentRoutes from "./routes/homeContent.routes";

const app = express();

app.set("trust proxy", 1);

const allowList = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.length === 0 || allowList.includes(origin))
        return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ["text/*"] }));
app.use(morgan("dev"));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const API_BASE = process.env.API_BASE?.trim() || "/api/v1";
app.use(`${API_BASE}/upload`, uploadRoutes);
app.use(`${API_BASE}/auth`, authRoutes);
app.use(`${API_BASE}/products`, productRoutes);
app.use(`${API_BASE}/homeContent`, homeContentRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: err?.message || "Internal Server Error" });
  }
);

export default app;
