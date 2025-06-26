import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupGoogleAuth } from "./googleAuth";

const app = express();

// ✅ Security middleware
app.use(helmet());

// ✅ Allowed frontend origins
const allowedOrigins = [
  (process.env.FRONTEND_URL || "http://localhost:3000").trim(),
  "https://shop-fronted-kikjol3xo-leatiles-projects.vercel.app",
  "https://shop-fronted-git-main-leatiles-projects.vercel.app",
  "https://shop-fronted.vercel.app",
];

// ✅ CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS Origin:", origin);
    if (!origin) {
      console.log("Allowing request with no origin");
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      console.log(`Allowing origin: ${origin}`);
      return callback(null, true);
    }
    console.log(`Rejecting origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Session-Id"],
}));

// ✅ Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// ✅ Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

// ✅ Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ✅ Setup Google OAuth & Redis session
setupGoogleAuth(app);

// ✅ Register routes and start server
(async () => {
  const server = await registerRoutes(app);

  // ✅ Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Error:", err);
    res.status(status).json({ message });
  });

  // ✅ 404 handler
  app.use("*", (_req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
  });

  const port = process.env.PORT || 5000;
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });
})();
