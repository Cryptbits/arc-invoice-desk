import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { invoiceRoutes }   from "./routes/invoices";
import { lenderRoutes }    from "./routes/lenders";
import { settlementRoutes } from "./routes/settlement";
import { metricsRoutes }   from "./routes/metrics";
import { cctpRoutes }      from "./routes/cctp";
import { fxRoutes }        from "./routes/fx";
import { documentsRoutes } from "./routes/documents";
import { privacyRoutes }   from "./routes/privacy";
import { errorHandler }    from "./middleware/errorHandler";
import { initDb }          from "./services/db";
import { initQueue }       from "./jobs/queue";

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3001",
    /\.vercel\.app$/,
  ],
  credentials: true,
}));

app.use((req, res, next) => {
  if (req.headers["content-type"]?.includes("application/pdf") ||
      req.headers["content-type"]?.includes("application/octet-stream")) {
    let data: Buffer[] = [];
    req.on("data", chunk => data.push(chunk));
    req.on("end", () => {
      (req as any).rawBody = Buffer.concat(data);
      next();
    });
  } else {
    next();
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

app.use("/api/invoices",   invoiceRoutes);
app.use("/api/lenders",    lenderRoutes);
app.use("/api/settlement", settlementRoutes);
app.use("/api/metrics",    metricsRoutes);
app.use("/api/cctp",       cctpRoutes);
app.use("/api/fx",         fxRoutes);
app.use("/api/documents",  documentsRoutes);
app.use("/api/privacy",    privacyRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "4.0.0",
    timestamp: new Date().toISOString(),
    features: ["invoices", "auctions", "stablefx", "cctp", "ipfs", "privacy", "fraud-detection"],
  });
});

app.use(errorHandler);

async function bootstrap() {
  await initDb();
  await initQueue();
  app.listen(PORT, () => {
    console.log(`ArcFi API v4 running on port ${PORT}`);
    if (!process.env.CIRCLE_API_KEY || process.env.CIRCLE_API_KEY === "your_circle_api_key_here") {
      console.log("Circle API: using fallback mode (set CIRCLE_API_KEY for live FX rates)");
    }
  });
}

bootstrap().catch(console.error);
