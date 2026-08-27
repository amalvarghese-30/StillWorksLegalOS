import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { signToken, signRefreshToken, verifyToken, requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Refresh-token cookie helpers
// ---------------------------------------------------------------------------
// Web clients receive the refresh token only via an httpOnly cookie (never in
// JS-accessible JSON). Electron desktop clients instead receive it in the JSON
// body and persist it via the OS-level safeStorage API — see x-client-type.

const REFRESH_COOKIE = "stillworks_refresh";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    let value = part.slice(idx + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw value */
    }
    if (key) cookies[key] = value;
  }
  return cookies;
}

function setRefreshCookie(res: Response, token: string): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const parts = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/auth",
    `Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearRefreshCookie(res: Response): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const parts = [
    `${REFRESH_COOKIE}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/auth",
    "Max-Age=0",
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Hash refresh token before storing
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    // Create session record with refresh token hash
    const device = req.headers["user-agent"] ?? "Unknown";
    const ip = req.ip ?? req.socket.remoteAddress ?? "";

    await Session.create({
      userId: user._id,
      token: accessToken,
      refreshTokenHash,
      device,
      ip,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Update user status
    user.status = "online";
    user.lastActiveAt = new Date();
    await user.save();

    // Always set the refresh token as an httpOnly cookie (web clients).
    // Electron ignores cookies — it reads the token from the JSON body below.
    setRefreshCookie(res, refreshToken);

    const isElectron = req.headers["x-client-type"] === "electron";

    const body: Record<string, unknown> = {
      accessToken,
      user: user.toJSON(),
    };
    // Only Electron receives the refresh token in the response body (it is
    // then encrypted via safeStorage). Web clients rely on the httpOnly cookie.
    if (isElectron) {
      body.refreshToken = refreshToken;
    }

    res.json(body);
  } catch (err) {
    console.error("[auth] Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization;
    const token = header?.slice(7) ?? "";

    // Revoke this session
    const session = await Session.findOneAndUpdate(
      { token },
      { $set: { isRevoked: true } },
      { new: true },
    );

    // Force-disconnect any socket bound to this specific session so a revoked
    // session cannot keep receiving confidential chat messages.
    const io = req.app.get("io");
    if (io && session) {
      const sessionId = session._id.toString();
      for (const s of io.sockets.sockets.values()) {
        if (s.data.sessionId === sessionId) s.disconnect(true);
      }
    }

    // Update user status
    await User.findByIdAndUpdate(req.userId, {
      status: "offline",
      lastActiveAt: new Date(),
    });

    clearRefreshCookie(res);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("[auth] Logout error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh — refresh access token using refresh token
// ---------------------------------------------------------------------------
// Implements refresh token rotation with reuse detection

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const isElectron = req.headers["x-client-type"] === "electron";

    // Electron sends the refresh token in the JSON body (from safeStorage);
    // web clients send it via the httpOnly cookie.
    const bodyToken =
      typeof req.body?.refreshToken === "string" ? (req.body.refreshToken as string) : undefined;
    const cookieToken = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
    const refreshToken = bodyToken || cookieToken;

    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    // Verify refresh token signature & expiration
    const payload = verifyToken(refreshToken);
    if (!payload) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }

    // A user may have several concurrent sessions (web + desktop + mobile),
    // so match the refresh token against all active sessions, not just one.
    const activeSessions = await Session.find({
      userId: payload.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    let session: (typeof activeSessions)[number] | null = null;
    for (const candidate of activeSessions) {
      if (
        candidate.refreshTokenHash &&
        (await bcrypt.compare(refreshToken, candidate.refreshTokenHash))
      ) {
        session = candidate;
        break;
      }
    }

    if (!session) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }

    // Rotation: generate new access token AND new refresh token
    const newPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    const newAccessToken = signToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 12);

    // Update session with new tokens
    session.token = newAccessToken;
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActiveAt = new Date();
    await session.save();

    // Always rotate the httpOnly cookie (web clients); Electron ignores it.
    setRefreshCookie(res, newRefreshToken);

    const body: Record<string, unknown> = { accessToken: newAccessToken };
    if (isElectron) body.refreshToken = newRefreshToken;

    res.json(body);
  } catch (err) {
    console.error("[auth] Refresh error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — current user profile
// ---------------------------------------------------------------------------

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("[auth] Me error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/me — update current user profile
// ---------------------------------------------------------------------------

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const allowed = ["name", "phone", "title"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("[auth] Update profile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current and new password are required" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Revoke all sessions except current
    await Session.revokeAllForUser(user._id);

    // Force-disconnect every socket for this user (all sessions now invalid).
    const io = req.app.get("io");
    if (io) {
      const userIdStr = user._id.toString();
      for (const s of io.sockets.sockets.values()) {
        if (s.data.userId === userIdStr) s.disconnect(true);
      }
    }

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("[auth] Change password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/firm — update firm details
// ---------------------------------------------------------------------------

router.patch("/firm", requireAuth, async (req: Request, res: Response) => {
  try {
    const allowed = [
      "firmName",
      "firmBarRegistration",
      "firmPrimaryCourt",
      "firmAddress",
      "firmLogoUrl",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("[auth] Update firm error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/preferences — update notification and security preferences
// ---------------------------------------------------------------------------

router.patch("/preferences", requireAuth, async (req: Request, res: Response) => {
  try {
    const allowed = [
      "notifyHearingReminders",
      "notifyApprovalRequests",
      "notifyCallReminders",
      "notifyDailyDigest",
      "securityTwoFactor",
      "securitySessionTimeout",
      "securityLoginAlerts",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error("[auth] Update preferences error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/seed — initial admin + employee accounts (DEVELOPMENT ONLY)
// ---------------------------------------------------------------------------
// This endpoint is DISABLED in production. It only works when NODE_ENV=development
// and SEED_ENABLED=true environment variable is explicitly set.
// This prevents accidental admin account creation in production environments.

router.post("/seed", async (_req: Request, res: Response) => {
  // SECURITY: Disable seed endpoint in production completely
  if (process.env["NODE_ENV"] === "production") {
    res.status(403).json({ message: "Seed endpoint disabled in production" });
    return;
  }

  // Additional guard: require explicit opt-in even in development
  if (process.env["SEED_ENABLED"] !== "true") {
    res.status(403).json({
      message: "Seed endpoint disabled. Set SEED_ENABLED=true to enable (development only).",
    });
    return;
  }

  try {
    const existing = await User.findOne({ email: "admin@stillworks.legal" });
    if (existing) {
      // Even if admin exists, ensure employee also exists
      const empExisting = await User.findOne({ email: "employee@stillworks.legal" });
      if (empExisting) {
        res.status(409).json({ message: "Seed accounts already exist" });
        return;
      }
      // Admin exists but employee doesn't — create employee
      const employee = await User.create({
        name: "Adv. Meera Nair",
        email: "employee@stillworks.legal",
        passwordHash: await bcrypt.hash("employee123", 12),
        role: "employee",
        title: "Senior Associate",
        phone: "+91-9876543211",
        permissions: {
          dashboard: true,
          clients: true,
          cases: true,
          tasks: true,
          documents: true,
          calendar: true,
          chat: true,
          reports: false,
          employees: false,
          approvals: false,
          auditLogs: false,
          settings: false,
        },
      });
      res.status(201).json({ message: "Employee account created", userId: employee._id });
      return;
    }

    const admin = await User.create({
      name: "Adv. Rohan Desai",
      email: "admin@stillworks.legal",
      passwordHash: await bcrypt.hash("admin123", 12),
      role: "admin",
      title: "Managing Partner · Administrator",
      permissions: {
        dashboard: true,
        clients: true,
        cases: true,
        tasks: true,
        documents: true,
        calendar: true,
        chat: true,
        reports: true,
        employees: true,
        approvals: true,
        auditLogs: true,
        settings: true,
      },
    });

    const employee = await User.create({
      name: "Adv. Meera Nair",
      email: "employee@stillworks.legal",
      passwordHash: await bcrypt.hash("employee123", 12),
      role: "employee",
      title: "Senior Associate",
      phone: "+91-9876543211",
      permissions: {
        dashboard: true,
        clients: true,
        cases: true,
        tasks: true,
        documents: true,
        calendar: true,
        chat: true,
        reports: false,
        employees: false,
        approvals: false,
        auditLogs: false,
        settings: false,
      },
    });

    res.status(201).json({ message: "Admin and employee accounts created", adminId: admin._id, employeeId: employee._id });
  } catch (err) {
    console.error("[auth] Seed error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
