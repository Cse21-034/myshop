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
        reconnectStrategy: (retries: number) => Math.min(retries * 100, 3000), // <-- typed here
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

  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true, // Allow guest sessions
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // CSRF protection
  app.use(csurf());
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
          const user = await storage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            profileImageUrl: profile.photos?.[0]?.value,
          });
          done(null, { id: user.id, email: user.email, isAdmin: user.isAdmin });
        } catch (err) {
          console.error("Google OAuth error:", err);
          done(err as Error);
        }
      }
    )
  );

  // Serialize/deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, { id: user.id, email: user.email, isAdmin: user.isAdmin });
  });

  passport.deserializeUser(async (user: any, done) => {
    try {
      const dbUser = await storage.getUser(user.id);
      done(null, dbUser || user);
    } catch (err) {
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

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?login=failed" }),
    async (req, res) => {
      // Merge guest cart with user
      const userId = (req.user as any).id;
      const sessionId = req.sessionID;
      await storage.mergeCart(sessionId, userId);
      res.redirect("https://shop-fronted.vercel.app");
    }
  );

  app.get("/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.redirect("/");
    });
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
