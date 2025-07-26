import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupGoogleAuth } from "./googleAuth";

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: "Too many requests, please try again later" },
  })
);

// Allowed frontend origins
const allowedOrigins = [
  (process.env.FRONTEND_URL || "http://localhost:3000").trim(),
  "https://test-front-6jtcnlax1-leatiles-projects.vercel.app",
  "https://test-front-git-main-leatiles-projects.vercel.app",
  "https://test-front-mocha.vercel.app",
];

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Log CORS headers
app.use((req, res, next) => {
  console.log("🔗 CORS Headers:", {
    origin: req.headers.origin,
    cookies: req.headers.cookie || "No cookies",
  });
  next();
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;
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

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Setup Google OAuth & session
setupGoogleAuth(app);

// Register routes and start server
(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[${req.method} ${req.path}] Error (${status}):`, err.stack);

    res.status(status).json({ message, code: err.code || "UNKNOWN", stack: process.env.NODE_ENV === "development" ? err.stack : undefined });
  });

  // 404 handler
  app.use("*", (req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
  });

  const port = process.env.PORT || 5000;
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });
})();
