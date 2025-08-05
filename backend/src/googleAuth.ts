/// <reference types="../types/passport-google-oauth20" />
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import session from "express-session";
import csurf from "csurf";
import type { Express, Request, Response, RequestHandler } from "express";
import { storage } from "./storage";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import jwt from "jsonwebtoken";

// Extend express-session types to include user property
declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      isAdmin: boolean;
    };
  }
}

export function setupGoogleAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required in production");
  }

  app.set("trust proxy", 1);

  let redisClient: any;
  let sessionStore;
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    redisClient = createClient({
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

    redisClient.on("ready", () => {
      console.log("✅ Redis ready for session storage");
    });

    redisClient.connect().catch((err: Error) => {
      console.error("❌ Redis connection failed:", err.message);
    });

    sessionStore = new RedisStore({
      client: redisClient,
    });

    async function cleanupStaleSessions() {
      const sessions = await redisClient.keys("sess:*");
      for (const sessionKey of sessions) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const expiry = session.cookie?.expires;
          if (expiry && new Date(expiry) < new Date()) {
            await redisClient.del(sessionKey);
            console.log(`🧹 Cleaned up stale session: ${sessionKey}`);
          }
        }
      }
    }
    setInterval(cleanupStaleSessions, 24 * 60 * 60 * 1000);
  }

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
       // domain: process.env.NODE_ENV === "production" ? ".onrender.com" : undefined,
      },
      name: "session",
    })
  );

  app.use((req, res, next) => {
    console.log("🔐 Session accessed:", req.sessionID, "Cookies:", req.headers.cookie || "No cookies");
    if (!req.sessionID) {
      console.warn("⚠️ No session ID generated");
    }
    next();
  });

  app.use(csurf());
  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

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
          
          // IMPORTANT: Use the actual user data from database, not hardcoded values
          done(null, {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin, // Use the actual value from database
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          });
        } catch (err: unknown) {
          console.error("❌ Google OAuth error:", err);
          done(err instanceof Error ? err : new Error(String(err)));
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    console.log("🔐 Serializing user:", user.id);
    // Store minimal data in session - this should match the database
    done(null, { 
      id: user.id, 
      email: user.email, 
      isAdmin: user.isAdmin // This should be the actual value from DB
    });
  });

  passport.deserializeUser(async (sessionUser: any, done) => {
    try {
      const cacheKey = `user:${sessionUser.id}`;
      let dbUser = await redisClient?.get?.(cacheKey);
      
      if (!dbUser) {
        // Always get fresh data from database
        dbUser = await storage.getUser(sessionUser.id);
        if (!dbUser) {
          console.warn("❌ User not found in DB:", sessionUser.id);
          return done(null, null);
        }
        
        // Cache the fresh data
        await redisClient?.setEx?.(cacheKey, 3600, JSON.stringify(dbUser));
        console.log("✅ Cached fresh user data in Redis:", sessionUser.id);
      } else {
        dbUser = JSON.parse(dbUser);
        console.log("✅ Retrieved user from Redis cache:", sessionUser.id);
      }
      
      // Always return the database user data, not session data
      done(null, dbUser);
    } catch (err: unknown) {
      console.error("❌ Deserialization error:", err);
      done(err instanceof Error ? err : new Error(String(err)));
    }
  });

  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
        console.log("✅ JWT verified, user set:", decoded);
      } catch (err: any) {
        console.error("❌ JWT verification failed:", err.message);
        if (err.name === "TokenExpiredError") {
          console.warn("Token expired, client should refresh");
        }
      }
    } else {
      console.log("🔍 No JWT token provided in Authorization header");
    }
    next();
  });

  app.get("/auth/google", (req: Request, res: Response, next: Function) => {
    const sessionId = req.query.sessionId as string || "";
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: sessionId,
    })(req, res, next);
  });

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "https://fountstream.com/?login=failed",
    }),
    async (req, res) => {
      console.log("🔐 Auth callback - User:", req.user);
      console.log("🔐 Session ID:", req.sessionID);
      console.log("🔐 Is Authenticated:", req.isAuthenticated());

      try {
        const user = req.user as any;
        const userId = user.id;
        const sessionId = req.sessionID;
        const oldSessionId = req.query.state as string | undefined;

        // Get the most up-to-date user data from database
        const freshUserData = await storage.getUser(userId);
        if (!freshUserData) {
          throw new Error("User not found after authentication");
        }

        // Store the actual database values in session
        req.session.user = { 
          id: freshUserData.id, 
          email: freshUserData.email || user.email, 
          isAdmin: freshUserData.isAdmin || false // Use actual database value with fallback
        };
        
        console.log("🔐 Storing user in session:", req.session.user);
        
        req.session.save((err) => {
          if (err) {
            console.error("❌ Failed to save session to Redis:", err);
          } else {
            console.log("✅ Session saved to Redis");
          }
        });

        // Create JWT with actual database values
        const token = jwt.sign({ 
          id: freshUserData.id, 
          email: freshUserData.email || user.email,
          isAdmin: freshUserData.isAdmin || false // Include actual admin status in JWT with fallback
        }, process.env.JWT_SECRET!, {
          expiresIn: "1h",
        });
        
        const refreshToken = jwt.sign({ id: freshUserData.id }, process.env.JWT_SECRET!, {
          expiresIn: "7d",
        });

        await redisClient.setEx(`refresh:${freshUserData.id}`, 7 * 24 * 60 * 60, refreshToken);
        console.log("✅ Stored refresh token for user:", freshUserData.id);

        // Clear any cached user data to force fresh fetch
        await redisClient?.del?.(`user:${userId}`);

        if (oldSessionId && storage.mergeCart) {
          try {
            console.log(`🔍 Attempting to merge cart: sessionId=${oldSessionId}, userId=${userId}`);
            await storage.mergeCart(oldSessionId, userId);
            console.log(`✅ Merged cart from session ${oldSessionId} to user ${userId}`);
          } catch (cartError) {
            console.error("❌ Cart merge failed:", cartError);
            // Don't fail the entire auth process if cart merge fails
          }
        }

        const csrfToken = req.csrfToken();
        console.log("🔐 New CSRF token:", csrfToken);

        res.redirect(
          `https://fountstream.com/?login=success&token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&csrfToken=${encodeURIComponent(csrfToken)}`
        );
      } catch (error) {
        console.error("❌ Auth callback error:", error);
        res.redirect("https://fountstream.com/?login=error");
      }
    }
  );

  app.get("/auth/logout", (req: Request, res: Response) => {
    console.log("🔐 Logging out user:", req.user);
    req.logout((err) => {
      if (err) {
        console.error("❌ Logout error:", err);
      }
      req.session.destroy(async () => {
        if (req.user) {
          await redisClient?.del?.(`refresh:${(req.user as any)?.id}`);
          await redisClient?.del?.(`user:${(req.user as any)?.id}`); // Clear user cache
        }
        res.redirect("https://fountstream.com/?logout=success");
      });
    });
  });

  app.get("/api/csrf-token", (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    console.log("🔍 Auth check - Is Authenticated:", req.isAuthenticated());
    console.log("🔍 Auth check - User:", req.user);
    console.log("🔍 Auth check - Session User:", req.session.user);
    console.log("🔍 Auth check - Session ID:", req.sessionID);
    console.log("🔍 Auth check - Cookies:", req.headers.cookie || "No cookies");

    try {
      let userData = null;

      // Priority 1: JWT token user (most up-to-date)
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        // Get fresh data from database for JWT users
        const userId = (req.user as any).id;
        userData = await storage.getUser(userId);
        console.log("✅ Using JWT user data from database:", userData);
      }
      // Priority 2: Passport authenticated user
      else if (req.isAuthenticated() && req.user) {
        userData = req.user;
        console.log("✅ Using Passport authenticated user:", userData);
      }
      // Priority 3: Session user
      else if (req.session.user) {
        // Get fresh data from database even for session users
        const userId = req.session.user.id;
        userData = await storage.getUser(userId);
        console.log("✅ Using session user data from database:", userData);
      }

      if (userData) {
        res.json(userData);
      } else {
        res.status(401).json({ message: "Not authenticated" });
      }
    } catch (error) {
      console.error("❌ Error in /api/auth/user:", error);
      res.status(401).json({ message: "Authentication error" });
    }
  });

  app.get("/api/auth/debug", (req: Request, res: Response) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      sessionUser: req.session.user || null,
      cookies: req.headers.cookie || "No cookies",
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }
      console.log("🔄 Verifying refresh token:", refreshToken);
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
      const storedRefreshToken = await redisClient.get(`refresh:${decoded.id}`);
      console.log("🔄 Stored refresh token in Redis:", storedRefreshToken);
      if (storedRefreshToken !== refreshToken) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      // Get fresh user data from database
      const user = await storage.getUser(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Create new JWT with fresh user data
      const newToken = jwt.sign({ 
        id: user.id, 
        email: user.email || '',
        isAdmin: user.isAdmin || false // Use actual database value with fallback
      }, process.env.JWT_SECRET!, {
        expiresIn: "1h",
      });
      
      res.json({ token: newToken });
    } catch (error) {
      console.error("❌ Refresh token error:", error);
      res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated?.() || req.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
