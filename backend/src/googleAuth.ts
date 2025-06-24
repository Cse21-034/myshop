import passport from "passport";
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from "passport-google-oauth20";
import session from "express-session";
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "./storage";

export function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
  }, async (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) => {
    // Upsert user in DB
    await storage.upsertUser({
      id: profile.id,
      email: profile.emails?.[0]?.value,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      profileImageUrl: profile.photos?.[0]?.value,
    });
    done(null, profile);
  }));

  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((user, done) => {
    done(null, user as any);
  });

  // Auth endpoints
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/auth/google/callback", passport.authenticate("google", {
    failureRedirect: "/?login=failed",
    successReturnToOrRedirect: "/",
  }));

  app.get("/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}; 