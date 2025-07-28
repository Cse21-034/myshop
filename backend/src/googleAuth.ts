// server/src/googleAuth.ts
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
import util from "util";

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

    redisClient.getAsync = util.promisify(redisClient.get).bind(redisClient);
    redisClient.setExAsync = util.promisify(redisClient.setEx).bind(redisClient);
    redisClient.delAsync = util.promisify(redisClient.del).bind(redisClient);

    sessionStore = new RedisStore({
      client: redisClient,
    });

    async function cleanupStaleSessions() {
      const sessions = await redisClient.keys("sess:*");
      for (const sessionKey of sessions) {
        const sessionData = await redisClient.getAsync(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const expiry = session.cookie?.expires;
          if (expiry && new Date(expiry) < new Date()) {
            await redisClient.delAsync(sessionKey);
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
        domain: process.env.NODE_ENV === "production" ? "test-front-mocha.vercel.app" : undefined,
      },
      name: "session",
    })
  );

  app.use((req, res, next) => {
    console.log("🔐 Session accessed:", req.sessionID);
    res.cookie("session", req.sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
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
          done(null, {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
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
    done(null, { id: user.id, email: user.email, isAdmin: user.isAdmin });
  });

  passport.deserializeUser(async (user: any, done) => {
    try {
      const cacheKey = `user:${user.id}`;
      let dbUser = await redisClient?.getAsync?.(cacheKey);
      if (!dbUser) {
        dbUser = await storage.getUser(user.id);
        if (!dbUser) {
          console.warn("❌ User not found in DB:", user.id);
          return done(null, null);
        }
        await redisClient?.setExAsync?.(cacheKey, 3600, JSON.stringify(dbUser));
        console.log("✅ Cached user in Redis:", user.id);
      } else {
        dbUser = JSON.parse(dbUser);
      }
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
      } catch (err) {
        console.error("❌ JWT verification failed:", err);
      }
    }
    next();
  });

  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );


  
 app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "https://test-front-mocha.vercel.app/?login=failed",
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

      // Store user in session
      req.session.user = { id: user.id, email: user.email, isAdmin: user.isAdmin };

      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
        expiresIn: "1h",
      });
      const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      await redisClient.setExAsync(`refresh:${user.id}`, 7 * 24 * 60 * 60, refreshToken);
      console.log("✅ Stored refresh token for user:", user.id);

      if (oldSessionId && storage.mergeCart) {
        await storage.mergeCart(oldSessionId, userId);
        console.log(`✅ Merged cart from session ${oldSessionId} to user ${userId}`);
      }

      const csrfToken = req.csrfToken();
      console.log("🔐 New CSRF token:", csrfToken);

      res.cookie("session", req.sessionID, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: process.env.NODE_ENV === "production" ? "test-front-mocha.vercel.app" : undefined,
      });

      console.log("🔐 Setting session cookie:", res.getHeader("Set-Cookie"));
      res.redirect(
        `https://test-front-mocha.vercel.app/?login=success&token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&csrfToken=${encodeURIComponent(csrfToken)}`
      );
    } catch (error) {
      console.error("❌ Auth callback error:", error);
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
      req.session.destroy(async () => {
        await redisClient.delAsync(`refresh:${(req.user as any)?.id}`);
        res.redirect("https://test-front-mocha.vercel.app/?logout=success");
      });
    });
  });

  app.get("/api/csrf-token", (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  app.get("/api/auth/user", (req: Request, res: Response) => {
    console.log("🔍 Auth check - Is Authenticated:", req.isAuthenticated());
    console.log("🔍 Auth check - User:", req.user);
    console.log("🔍 Auth check - Session ID:", req.sessionID);
    console.log("🔍 Auth check - Cookies:", req.headers.cookie || "No cookies");

    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else if (req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.get("/api/auth/debug", (req: Request, res: Response) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      cookies: req.headers.cookie || "No cookies",
      userAgent: req.headers["user-agent"],
      sessionData: req.session,
    });
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
      const storedRefreshToken = await redisClient.getAsync(`refresh:${decoded.id}`);
      if (storedRefreshToken !== refreshToken) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      const user = await storage.getUser(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const newToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
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
