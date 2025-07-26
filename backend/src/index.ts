import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupGoogleAuth } from "./googleAuth";
import MongoStore from "connect-mongo"; // Add if using MongoDB for session storage

const app = express();

// Trust proxy for secure cookies behind reverse proxy (important for production)
app.set('trust proxy', 1);

// Security middleware - Modified for session compatibility
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Needed for OAuth redirects
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests
    message: { message: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Allowed frontend origins
const allowedOrigins = [
  (process.env.FRONTEND_URL || "http://localhost:3000").trim(),
  "https://test-front-6jtcnlax1-leatiles-projects.vercel.app",
  "https://test-front-git-main-leatiles-projects.vercel.app",
  "https://test-front-mocha.vercel.app",
  "http://localhost:5173", // Common Vite dev port
  process.env.CLIENT_URL
].filter(Boolean);

console.log('🌐 Allowed CORS origins:', allowedOrigins);

// CORS configuration - Enhanced for session cookies
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("CORS Origin:", origin);
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('❌ CORS blocked origin:', origin);
        // Don't throw error, just deny - more graceful
        callback(null, false);
      }
    },
    credentials: true, // CRITICAL: Enable credentials for session cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-CSRF-Token",
      "X-Requested-With",
      "Cache-Control",
      "Accept",
      "Origin"
    ],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200,
    preflightContinue: false
  })
);

// Handle preflight requests explicitly
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Changed to true for better parsing

// CRITICAL: Session middleware - Must come before auth setup
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  name: 'sessionId', // Custom session cookie name
  resave: false,
  saveUninitialized: false, // Don't save empty sessions
  rolling: true, // Reset expiry on each request
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CRITICAL for cross-origin
    domain: undefined // Let browser handle domain
  },
  // Use persistent store in production
  store: process.env.MONGODB_URI ? MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 24 hours
    autoRemove: 'native',
    touchAfter: 24 * 3600 // Only update session once per day unless changed
  }) : undefined
};

console.log('🍪 Session config:', {
  secure: sessionConfig.cookie.secure,
  sameSite: sessionConfig.cookie.sameSite,
  httpOnly: sessionConfig.cookie.httpOnly,
  maxAge: sessionConfig.cookie.maxAge,
  hasStore: !!sessionConfig.store,
  environment: process.env.NODE_ENV || 'development'
});

app.use(session(sessionConfig));

// CSRF Token endpoint - Must come after session middleware
app.get('/api/csrf-token', (req, res) => {
  const token = require('crypto').randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  
  console.log('🔑 CSRF token generated for session:', req.sessionID);
  
  res.json({ csrfToken: token });
});

// CSRF validation middleware (optional - can be disabled for debugging)
function validateCSRF(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET requests and health checks
  if (req.method === 'GET' || req.path === '/health') {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    console.warn('⚠️ CSRF validation failed:', { 
      hasToken: !!token, 
      hasSessionToken: !!sessionToken,
      sessionId: req.sessionID,
      path: req.path 
    });
    // For debugging, just log - don't block requests
    // Uncomment next line to enforce CSRF in production
    // return res.status(403).json({ message: 'Invalid CSRF token', code: 'CSRF_ERROR' });
  }
  
  next();
}

// Apply CSRF validation to API routes
app.use('/api', validateCSRF);

// Logging middleware - Enhanced with session info
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
    if (path.startsWith("/api") || path.startsWith("/auth")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Add session info for auth-related requests
      if (path.includes('auth') || path.includes('user')) {
        logLine += ` [Session: ${req.sessionID?.substring(0, 8)}...]`;
      }
      
      if (capturedJsonResponse) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${responseStr}`;
      }
      
      if (logLine.length > 150) {
        logLine = logLine.slice(0, 149) + "…";
      }
      
      console.log(logLine);
    }
  });
  
  next();
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    sessionStore: !!sessionConfig.store ? 'persistent' : 'memory'
  });
});

// Setup Google OAuth & session - MUST come after session middleware
setupGoogleAuth(app);

// Register routes and start server
(async () => {
  const server = await registerRoutes(app);

  // Enhanced error handler with better logging
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`❌ [${req.method} ${req.path}] Error (${status}):`, {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      sessionId: req.sessionID,
      user: req.user ? (req.user as any).id : 'anonymous'
    });
    
    // Don't expose sensitive error details in production
    const responseMessage = process.env.NODE_ENV === 'production' && status >= 500 
      ? 'Internal Server Error' 
      : message;
    
    res.status(status).json({ 
      message: responseMessage, 
      code: err.code || "UNKNOWN_ERROR",
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use("*", (req: Request, res: Response) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
      message: "Route not found",
      code: "NOT_FOUND",
      path: req.path
    });
  });

  const port = process.env.PORT || 5000;
  
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔐 Session store: ${sessionConfig.store ? 'Persistent (MongoDB)' : 'Memory'}`);
    console.log(`🍪 Secure cookies: ${sessionConfig.cookie.secure}`);
    console.log(`🌐 CORS origins: ${allowedOrigins.length} configured`);
  });
})();
