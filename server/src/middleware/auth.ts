import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User.js";
import { Session } from "../models/Session.js";

// JWT Secret getter - FAIL FAST in production if secret is missing or weak
export const getJwtSecret = (): string => {
  const secret = process.env["JWT_SECRET"];

  if (!secret) {
    console.error("[auth] FATAL: JWT_SECRET environment variable is not set");
    console.error("[auth] Generate a strong secret: openssl rand -base64 48");
    process.exit(1);
  }

  // In production, enforce minimum secret strength
  if (process.env["NODE_ENV"] === "production") {
    if (secret.length < 64) {
      console.error("[auth] FATAL: JWT_SECRET must be at least 64 characters in production");
      process.exit(1);
    }
    if (secret === "dev-secret-change-me" || secret === "change-me-to-a-random-64-char-string") {
      console.error("[auth] FATAL: Default JWT_SECRET detected in production");
      process.exit(1);
    }
  }

  return secret;
};

// ---------------------------------------------------------------------------
// Augment Express Request with authenticated user
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// JWT payload shape
// ---------------------------------------------------------------------------

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// requireAuth — validates JWT and attaches user to request
// Also verifies session exists in DB and is not revoked
// ---------------------------------------------------------------------------

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = header.slice(7);

  let payload: JwtPayload;
  try {
    // Explicitly enforce HS256 algorithm to prevent algorithm confusion attacks
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // Attach decoded payload immediately for quick access
  req.userId = payload.userId;

  try {
    // Fetch full user for permission checks
    // Also verify session is still valid in DB (not revoked, not expired)
    const session = await Session.findOne({
      token,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.status(401).json({ message: "Session revoked or expired" });
      return;
    }

    // Update last active timestamp (non-blocking)
    Session.updateOne({ _id: session._id }, { $set: { lastActiveAt: new Date() } }).catch(() => { /* ignore */ });

    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("[auth] Session/User lookup failed:", (err as Error)?.message ?? err);
    if (res.headersSent) return;
    res.status(500).json({ message: "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// requireAdmin — must be called AFTER requireAuth
// ---------------------------------------------------------------------------

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// requirePermission(module) — checks user permissions map
// ---------------------------------------------------------------------------

export function requirePermission(module: keyof IUser["permissions"]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!req.user.permissions[module]) {
      res.status(403).json({ message: `Access denied: missing '${module}' permission` });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// signToken — utility for creating JWTs (used in auth routes)
// Uses short-lived access tokens (15 minutes) for security
// ---------------------------------------------------------------------------

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: (process.env["JWT_EXPIRES_IN"] || "15m") as jwt.SignOptions["expiresIn"],
  });
}

// ---------------------------------------------------------------------------
// signRefreshToken — creates long-lived refresh token (7 days)
// Stored hashed in DB, rotated on use
// ---------------------------------------------------------------------------

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "7d" as jwt.SignOptions["expiresIn"],
  });
}

// ---------------------------------------------------------------------------
// verifyToken — lightweight verification without DB hit
// Explicitly enforces HS256 algorithm
// ---------------------------------------------------------------------------

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    return null;
  }
}
