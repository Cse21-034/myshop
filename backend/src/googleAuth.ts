/// <reference types="../types/passport-google-oauth20" />
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import session from "express-session";
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
  app.set("trust proxy", 1); // Needed when behind a proxy like Vercel/Render

  let sessionStore;

  // ✅ Enable Redis store in production
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true, // ✅ required for Upstash and other managed Redis
      },
    });

  redisClient.on("error", (err: Error) => {
  console.error("❌ Redis error:", err.message);
});


    redisClient.on("connect", () => {
      console.log("✅ Connected to Redis");
    });

    redisClient.connect().catch(console.error);

    sessionStore = new RedisStore({ client: redisClient });
  }

  // ✅ Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: sessionStore, // May be undefined in development (uses MemoryStore)
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // https only in prod
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ✅ Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          // Upsert user in your DB
          await storage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            profileImageUrl: profile.photos?.[0]?.value,
          });

          return done(null, profile);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // ✅ Serialize user session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // ✅ Deserialize user session
  passport.deserializeUser((user, done) => {
    done(null, user as any);
  });

  // ✅ Auth routes
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/?login=failed",
      successReturnToOrRedirect: "https://shop-fronted.vercel.app",
    })
  );

  app.get("/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.redirect("/");
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
