/// <reference types="../types/passport-google-oauth20" />
import passport from "passport";
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from "passport-google-oauth20";
import session from "express-session";
import csurf from "csurf";
import type { Express, Request, Response, RequestHandler } from "express";
import { storage } from "./storage";
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

  app.set("trust proxy", 1);

  // Redis setup
  let sessionStore;
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true,
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

  // FIXED: Session middleware with proper cross-origin configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        // CRITICAL: Add domain configuration for cross-origin
        domain: process.env.NODE_ENV === "production" 
          ? ".onrender.com"  // This allows cookies to be shared across onrender.com subdomains
          : undefined
      },
      name: "session",
      // ADDED: Force session to be saved even if not modified
      rolling: true,
    })
  );

  // MODIFIED: CSRF protection with cross-origin support
  app.use(csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    }
  }));
  
  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  const callbackURL =
    process.env.NODE_ENV === "production"
      ? "https://myshop-test-backend.onrender.com/auth/google/callback"
      : "http://localhost:5000/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL,
      },
      async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          console.log("🔐 Google OAuth - Creating/updating user:", profile.emails?.[0]?.value);
          const user = await storage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            profileImageUrl: profile.photos?.[0]?.value,
          });
          console.log("✅ User created/updated:", user.id);
          done(null, { id: user.id, email: user.email, isAdmin: user.isAdmin });
        } catch (err) {
          console.error("❌ Google OAuth error:", err);
          done(err as Error);
        }
      }
    )
  );

  // Serialize/deserialize user
  passport.serializeUser((user: any, done) => {
    console.log("🔐 Serializing user:", user.id);
    done(null, { id: user.id, email: user.email, isAdmin: user.isAdmin });
  });

  passport.deserializeUser(async (user: any, done) => {
    try {
      console.log("🔐 Deserializing user:", user.id);
      const dbUser = await storage.getUser(user.id);
      done(null, dbUser || user);
    } catch (err) {
      console.error("❌ Deserialization error:", err);
      done(err);
    }
  });

  // Auth routes
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  // MODIFIED: Enhanced callback with session debugging
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "https://test-front-mocha.vercel.app/?login=failed" 
    }),
    async (req, res) => {
      console.log("🔐 Auth callback - User:", req.user);
      console.log("🔐 Session ID:", req.sessionID);
      console.log("🔐 Is Authenticated:", req.isAuthenticated());
      console.log("🔐 Session data:", req.session);
      
      try {
        const userId = (req.user as any).id;
        const sessionId = req.sessionID;
        
        // Force session save before redirect
        req.session.save((err) => {
          if (err) {
            console.error("❌ Session save error:", err);
          } else {
            console.log("✅ Session saved successfully");
          }
        });
        
        // Merge guest cart with user
        await storage.mergeCart(sessionId, userId);
        console.log("✅ Cart merged successfully for user:", userId);
        
        // MODIFIED: Add a delay to ensure session is persisted
        setTimeout(() => {
          res.redirect("https://test-front-mocha.vercel.app/?login=success");
        }, 100);
        
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
      // Destroy session completely
      req.session.destroy((err) => {
        if (err) {
          console.error("❌ Session destruction error:", err);
        }
        res.redirect("https://test-front-mocha.vercel.app/?logout=success");
      });
    });
  });

  // Enhanced debug endpoint
  app.get("/api/auth/debug", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session,
      cookies: req.headers.cookie || 'No cookies',
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    });
  });

  // Enhanced user endpoint with better session debugging
  app.get("/api/auth/user", (req, res) => {
    console.log("🔍 Auth check - Is Authenticated:", req.isAuthenticated());
    console.log("🔍 Auth check - User:", req.user);
    console.log("🔍 Auth check - Session ID:", req.sessionID);
    console.log("🔍 Auth check - Session exists:", !!req.session);
    console.log("🔍 Auth check - Cookies:", req.headers.cookie);
    
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ 
        message: "Not authenticated",
        debug: {
          isAuthenticated: req.isAuthenticated(),
          hasUser: !!req.user,
          sessionID: req.sessionID,
          hasSession: !!req.session
        }
      });
    }
  });

  // CSRF token endpoint
  app.get("/api/csrf-token", (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });
}

// Auth middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
