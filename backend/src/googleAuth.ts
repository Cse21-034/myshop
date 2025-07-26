/// <reference types="../types/passport-google-oauth20" />
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SERVER_URL = process.env.SERVER_URL || "https://myshop-test-backend.onrender.com";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing Google OAuth credentials");
  console.error("Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables");
}

// Configure Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      callbackURL: `${SERVER_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("🔐 Google OAuth - Processing profile:", profile.id);
        
        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error("❌ No email found in Google profile");
          return done(new Error("No email found in Google profile"));
        }

        console.log("🔐 Google OAuth - Creating/updating user:", email);
        
        const userData = {
          id: profile.id,
          email,
          firstName: profile.name?.givenName || "",
          lastName: profile.name?.familyName || "",
          profileImageUrl: profile.photos?.[0]?.value || "",
          isAdmin: false,
        };

        const user = await storage.createOrUpdateUser(userData);
        console.log("✅ User created/updated:", user.id);
        
        return done(null, user);
      } catch (error) {
        console.error("❌ OAuth strategy error:", error);
        return done(error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  console.log("🔐 Serializing user:", user.id);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    console.log("🔐 Deserializing user:", id);
    const user = await storage.getUser(id);
    if (!user) {
      console.log("❌ User not found during deserialization:", id);
      return done(null, false);
    }
    console.log("✅ User deserialized successfully:", user.email);
    done(null, user);
  } catch (error) {
    console.error("❌ Deserialization error:", error);
    done(error);
  }
});

// Enhanced authentication middleware
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  console.log("🔍 Auth check - Is Authenticated:", req.isAuthenticated());
  console.log("🔍 Auth check - User:", req.user ? `${(req.user as any).email} (${(req.user as any).id})` : 'null');
  console.log("🔍 Auth check - Session ID:", req.sessionID);
  
  // Check for session cookie
  const sessionCookie = req.headers.cookie?.includes('sessionId') || req.headers.cookie?.includes('connect.sid');
  console.log("🔍 Auth check - Has session cookie:", sessionCookie);
  
  if (req.isAuthenticated()) {
    console.log("✅ User authenticated, proceeding");
    return next();
  }
  
  console.log("❌ Authentication failed - returning 401");
  res.status(401).json({ 
    message: "Not authenticated",
    code: "UNAUTHORIZED"
  });
}

// Main setup function
export function setupGoogleAuth(app: Express) {
  console.log("🔐 Setting up Google OAuth...");
  
  // Initialize Passport middleware - MUST come after session middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth debug route for troubleshooting
  app.get("/api/auth/debug", (req: Request, res: Response) => {
    const debugInfo = {
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session,
      cookies: req.headers.cookie || null,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer,
      timestamp: new Date().toISOString()
    };
    
    console.log("🔍 Auth Debug Info:", JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);
  });

  // Start Google OAuth flow
  app.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
    console.log("🔐 Starting Google OAuth flow");
    console.log("🔐 Request origin:", req.headers.origin);
    console.log("🔐 Request referer:", req.headers.referer);
    console.log("🔐 Session ID:", req.sessionID);
    
    // Store the origin for redirect after auth
    const origin = req.headers.origin || req.headers.referer;
    if (origin && req.session) {
      req.session.authOrigin = origin;
      console.log("🔐 Stored auth origin:", origin);
    }
    
    passport.authenticate("google", { 
      scope: ["profile", "email"],
      prompt: "consent", // Force consent to ensure fresh session
      accessType: "offline" // Get refresh token
    })(req, res, next);
  });

  // Handle OAuth callback
  app.get("/auth/google/callback", (req: Request, res: Response, next: NextFunction) => {
    console.log("🔐 Google OAuth callback received");
    console.log("🔐 Callback session ID:", req.sessionID);
    console.log("🔐 Callback query params:", req.query);
    
    passport.authenticate("google", { 
      failureRedirect: "/?login=failed",
      failureMessage: true
    })(req, res, async (err) => {
      if (err) {
        console.error("❌ OAuth callback error:", err);
        return res.redirect("/?login=error");
      }

      try {
        console.log("🔐 Auth callback - User:", req.user);
        console.log("🔐 Auth callback - Session ID:", req.sessionID);
        console.log("🔐 Auth callback - Is Authenticated:", req.isAuthenticated());

        if (!req.user) {
          console.error("❌ No user found after authentication");
          return res.redirect("/?login=failed");
        }

        // Merge any guest cart items with user cart
        try {
          await storage.mergeGuestCartToUser((req.user as any).id, req.sessionID);
          console.log("✅ Cart merged successfully for user:", (req.user as any).id);
        } catch (cartError) {
          console.error("⚠️ Cart merge failed (non-critical):", cartError);
        }

        // Get the stored origin or use default
        const redirectOrigin = req.session.authOrigin || 
                             process.env.CLIENT_URL || 
                             process.env.FRONTEND_URL ||
                             "https://test-front-mocha.vercel.app";
        
        // Clear the stored origin
        if (req.session.authOrigin) {
          delete req.session.authOrigin;
        }
        
        console.log("🔐 Redirecting to:", `${redirectOrigin}/?login=success`);
        
        // Force session save before redirect to ensure persistence
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("❌ Session save error:", saveErr);
          } else {
            console.log("✅ Session saved successfully");
          }
          
          res.redirect(`${redirectOrigin}/?login=success`);
        });

      } catch (error) {
        console.error("❌ Post-auth processing error:", error);
        res.redirect("/?login=error");
      }
    });
  });

  // Logout route (POST)
  app.post("/auth/logout", (req: Request, res: Response) => {
    console.log("🔐 POST Logout request received");
    console.log("🔐 Current user:", req.user ? (req.user as any).email : 'none');
    
    req.logout((err) => {
      if (err) {
        console.error("❌ Logout error:", err);
        return res.status(500).json({ 
          message: "Logout failed",
          code: "LOGOUT_ERROR"
        });
      }
      
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("❌ Session destroy error:", destroyErr);
        } else {
          console.log("✅ Session destroyed successfully");
        }
        
        res.clearCookie('sessionId'); // Clear our custom session cookie
        res.clearCookie('connect.sid'); // Clear default Express session cookie
        
        console.log("✅ Logout successful");
        res.json({ 
          message: "Logged out successfully",
          code: "LOGOUT_SUCCESS"
        });
      });
    });
  });

  // Logout route (GET) - for direct browser redirects
  app.get("/auth/logout", (req: Request, res: Response) => {
    console.log("🔐 GET Logout request received");
    console.log("🔐 Current user:", req.user ? (req.user as any).email : 'none');
    
    req.logout((err) => {
      if (err) {
        console.error("❌ Logout error:", err);
      }
      
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("❌ Session destroy error:", destroyErr);
        } else {
          console.log("✅ Session destroyed successfully");
        }
        
        res.clearCookie('sessionId');
        res.clearCookie('connect.sid');
        
        const redirectOrigin = process.env.CLIENT_URL || 
                             process.env.FRONTEND_URL ||
                             "https://test-front-mocha.vercel.app";
        
        console.log("✅ Logout successful, redirecting to:", `${redirectOrigin}/?logout=success`);
        res.redirect(`${redirectOrigin}/?logout=success`);
      });
    });
  });

  console.log("✅ Google OAuth setup complete");
}

export default passport;
