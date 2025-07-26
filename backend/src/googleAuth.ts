/// <reference types="../types/passport-google-oauth20" />
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import session from "express-session";
import csurf from "csurf";
import type {
  Express,
  Request,
  Response,
  RequestHandler,
} from "express";
import { storage } from "./storage";
// Redis session store setup
import RedisStore from "connect-redis";
import { createClient } from "redis";

export function setupGoogleAuth(app: Express) {
  // Validate environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
  }
  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required in production");
  }

  app.set("trust proxy", 1); // Needed when behind a proxy like Vercel/Render
  
  let sessionStore;
  // ✅ Enable Redis store in production
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true, // ✅ required for Upstash and other managed Redis
        reconnectStrategy: (retries: number) => Math.min(retries * 100, 3000),
      },
    });

    redisClient.on("error", (err: Error) => {
      console.error("❌ Redis error:", err.message);
    });

    redisClient.on("connect", () => {
      console.log("✅ Connected to Redis");
    });

    redisClient.connect().catch((err: Error) => {
      console.error("❌ Redis connection failed:", err.message);
    });

    sessionStore = new RedisStore({ client: redisClient });
  }

  // ✅ Session middleware - FIXED for cross-origin support
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true, // CHANGED: Set to true for cross-origin to work
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: true, // CHANGED: Always true since Render uses HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        sameSite: "none", // CHANGED: Always "none" for cross-origin
      },
      name: "connect.sid", // CHANGED: Use default session name
      rolling: true, // ADDED: Reset expiration on each request
    })
  );

  // Remove CSRF for now to isolate the session issue
  // CSRF protection setup
  // app.use(csurf());
  // app.use((req, res, next) => {
  //   res.locals.csrfToken = req.csrfToken();
  //   next();
  // });

  app.use(passport.initialize());
  app.use(passport.session());

  // ✅ Google OAuth Strategy
  const callbackURL = process.env.NODE_ENV === "production"
    ? "https://myshop-test-backend.onrender.com/auth/google/callback"
    : "http://localhost:5000/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          console.log("🔐 Google OAuth - Creating/updating user:", profile.emails?.[0]?.value);
          // Upsert user in your DB
          const user = await storage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            profileImageUrl: profile.photos?.[0]?.value,
          });
          console.log("✅ User created/updated:", user.id);
          // Return user data that will be stored in session
          done(null, { 
            id: user.id, 
            email: user.email, 
            isAdmin: user.isAdmin,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl
          });
        } catch (err) {
          console.error("❌ Google OAuth error:", err);
          done(err as Error);
        }
      }
    )
  );

  // ✅ Serialize user session - Store minimal user data
  passport.serializeUser((user: any, done) => {
    console.log("🔐 Serializing user:", user.id);
    done(null, { 
      id: user.id, 
      email: user.email, 
      isAdmin: user.isAdmin,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl
    });
  });

  // ✅ Deserialize user session
  passport.deserializeUser(async (user: any, done) => {
    try {
      console.log("🔐 Deserializing user:", user.id);
      // Try to get fresh user data from database
      const dbUser = await storage.getUser(user.id);
      done(null, dbUser || user);
    } catch (err) {
      console.error("❌ Deserialization error:", err);
      done(err);
    }
  });

  // ✅ Auth routes
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  // Updated callback with proper redirect handling
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "https://test-front-mocha.vercel.app/?login=failed" 
    }),
    async (req, res) => {
      console.log("🔐 Auth callback - User:", req.user);
      console.log("🔐 Session ID:", req.sessionID);
      console.log("🔐 Is Authenticated:", req.isAuthenticated());
      
      try {
        const userId = (req.user as any).id;
        const sessionId = req.sessionID;
        
        // Merge guest cart with user (if you have cart functionality)
        if (storage.mergeCart) {
          await storage.mergeCart(sessionId, userId);
          console.log("✅ Cart merged successfully for user:", userId);
        }
        
        // Redirect to frontend with success parameter
        res.redirect("https://test-front-mocha.vercel.app/?login=success");
      } catch (error) {
        console.error("❌ Cart merge failed:", error);
        res.redirect("https://test-front-mocha.vercel.app/?login=error");
      }
    }
  );

  app.get("/auth/logout", (req: Request, res: Response) => {
    console.log("🔐 Logging out user:", req.user);
    req.logout((err) => {
      if (err) {
        console.error("❌ Logout error:", err);
      }
      res.redirect("https://test-front-mocha.vercel.app/?logout=success");
    });
  });

  // CSRF token endpoint - Temporary mock since CSRF is disabled
  app.get("/api/csrf-token", (req: Request, res: Response) => {
    res.json({ csrfToken: "mock-token" });
  });

  // Auth user endpoint - THIS WAS MISSING!
  app.get("/api/auth/user", (req: Request, res: Response) => {
    console.log("🔍 Auth check - Is Authenticated:", req.isAuthenticated());
    console.log("🔍 Auth check - User:", req.user);
    console.log("🔍 Auth check - Session ID:", req.sessionID);
    console.log("🔍 Auth check - Cookies:", req.headers.cookie || 'No cookies');
    
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Debug endpoint for troubleshooting
  app.get("/api/auth/debug", (req: Request, res: Response) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      cookies: req.headers.cookie || 'No cookies',
      userAgent: req.headers['user-agent'],
      sessionData: req.session,
    });
  });
}

// ✅ Auth middleware for protected routes
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated?.()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
