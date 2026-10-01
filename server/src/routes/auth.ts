import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { signToken, signRefreshToken, verifyToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { validatePasswordStrength } from "../services/passwordPolicy.js";
import { getPasswordResetDeliveryProvider } from "../services/passwordResetDelivery.js";
import { StorageService } from "../services/storage.js";

const router = Router();

// ---------------------------------------------------------------------------
// Refresh-token cookie helpers
// ---------------------------------------------------------------------------
// Web clients receive the refresh token only via an httpOnly cookie (never in
// JS-accessible JSON). Electron desktop clients instead receive it in the JSON
// body and persist it via the OS-level safeStorage API — see x-client-type.

const REFRESH_COOKIE = "stillworks_refresh";
const REFRESH_COOKIE_PERSISTENT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

function setRefreshCookie(res: Response, token: string, persistent = false): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const parts = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/auth",
  ];
  if (persistent) {
    parts.push(`Max-Age=${REFRESH_COOKIE_PERSISTENT_MAX_AGE_SECONDS}`);
  }
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

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({
        field: !email ? "email" : "password",
        code: "VALIDATION_ERROR",
        message: "Email and password must be valid text strings",
      });
      return;
    }

    const inputIdentifier = email.toLowerCase().trim();
    if (!inputIdentifier) {
      res.status(400).json({
        field: "email",
        code: "VALIDATION_ERROR",
        message: "Email address or username cannot be empty",
      });
      return;
    }

    let user = await User.findOne({ email: inputIdentifier });

    // Allow 'admin@stillworks.legal' or 'admin' as an alias for the firm administrator
    if (!user && (inputIdentifier === "admin@stillworks.legal" || inputIdentifier === "admin")) {
      user = await User.findOne({ role: "admin" });
    }

    // Allow logging in with registered phone number
    if (!user) {
      const cleanDigits = inputIdentifier.replace(/\D/g, "");
      if (cleanDigits.length >= 5) {
        const lastDigits = cleanDigits.slice(-10);
        const flexiblePhoneRegex = lastDigits.split("").join("[\\s\\-\\(\\)\\+]*");
        user = await User.findOne({ phone: { $regex: flexiblePhoneRegex, $options: "i" } });
      }
    }

    if (!user) {
      res.status(401).json({
        field: "email",
        code: "USER_NOT_FOUND",
        message: "No account found matching this email or username.",
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({
        field: "password",
        code: "INVALID_PASSWORD",
        message: "Incorrect password. Please check your password and try again.",
      });
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

    // Create session record with refresh token hash and rememberMe policy
    const device = (req.headers["user-agent"] as string) ?? "Unknown";
    const ip = req.ip ?? req.socket.remoteAddress ?? "";
    const rememberMe = Boolean(req.body?.rememberMe);
    const sessionLifetimeMs = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days persistent
      : 12 * 60 * 60 * 1000;      // 12 hours (session scoped)

    await Session.create({
      userId: user._id,
      token: accessToken,
      refreshTokenHash,
      device,
      ip,
      rememberMe,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + sessionLifetimeMs),
    });

    // Update user status
    user.status = "online";
    user.lastActiveAt = new Date();
    await user.save();

    // Set refresh token cookie: persistent if rememberMe, session-only if not
    setRefreshCookie(res, refreshToken, rememberMe);

    // If user has securityLoginAlerts enabled, trigger alert notification
    if (user.securityLoginAlerts !== false) {
      import("../services/notifications.js").then(({ NotificationService }) => {
        NotificationService.createNotification(
          {
            userId: user._id,
            type: "SYSTEM_ALERT",
            title: "New sign-in detected",
            message: `Account signed in from ${device.slice(0, 45)} (${ip || "Local network"}) at ${new Date().toLocaleTimeString("en-IN")}.`,
            metadata: { ip, device },
          },
          req.app.get("io")
        ).catch(() => {});
      });
    }

    const isElectron = req.headers["x-client-type"] === "electron";
    const body: Record<string, unknown> = {
      accessToken,
      user: user.toJSON(),
    };

    // Electron desktop stores the refresh token in OS-level safeStorage vault
    if (isElectron) {
      body["refreshToken"] = refreshToken;
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
// GET /api/auth/sessions — list active sessions for current user
// ---------------------------------------------------------------------------

router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentToken = req.headers.authorization?.slice(7) ?? "";
    const sessions = await Session.find({
      userId: req.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    res.json({
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        device: s.device || "Unknown Device",
        ip: s.ip || "Local",
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: s.token === currentToken,
        rememberMe: Boolean(s.rememberMe),
      })),
    });
  } catch (err) {
    console.error("[auth] List sessions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/sessions/:id — revoke specific session
// ---------------------------------------------------------------------------

router.delete("/sessions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: { isRevoked: true } },
      { new: true }
    );
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const io = req.app.get("io");
    if (io) {
      const sessionId = session._id.toString();
      for (const s of io.sockets.sockets.values()) {
        if (s.data.sessionId === sessionId) s.disconnect(true);
      }
    }

    res.json({ message: "Session revoked successfully" });
  } catch (err) {
    console.error("[auth] Revoke session error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/sessions — revoke all other sessions
// ---------------------------------------------------------------------------

router.delete("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentToken = req.headers.authorization?.slice(7) ?? "";
    const otherSessions = await Session.find({
      userId: req.userId,
      token: { $ne: currentToken },
      isRevoked: false,
    });

    await Session.updateMany(
      { userId: req.userId, token: { $ne: currentToken }, isRevoked: false },
      { $set: { isRevoked: true } }
    );

    const io = req.app.get("io");
    if (io && otherSessions.length > 0) {
      const otherIds = new Set(otherSessions.map((s) => s._id.toString()));
      for (const s of io.sockets.sockets.values()) {
        if (otherIds.has(s.data.sessionId)) s.disconnect(true);
      }
    }

    res.json({ message: "All other sessions revoked", revokedCount: otherSessions.length });
  } catch (err) {
    console.error("[auth] Revoke all other sessions error:", err);
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
      res.status(401).json({ message: "Refresh token is required" });
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
      // Reuse / replay detection: a valid signature was presented that does not match
      // any active session hash (it was already rotated or revoked). Revoke session family!
      await Session.revokeAllForUser(payload.userId);
      clearRefreshCookie(res);
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
    setRefreshCookie(res, newRefreshToken, Boolean(session.rememberMe));

    const body: Record<string, unknown> = {
      accessToken: newAccessToken,
    };

    // Electron desktop stores the refresh token in OS-level safeStorage vault
    if (isElectron) {
      body["refreshToken"] = newRefreshToken;
    }

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
// POST /api/auth/avatar — upload user profile avatar (max 2MB, jpg/png/webp)
// ---------------------------------------------------------------------------

router.post("/avatar", requireAuth, async (req: Request, res: Response) => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ message: "Content-Type must be multipart/form-data" });
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 1,
      },
    });

    let fileFound = false;
    let uploadPromise: Promise<string> | null = null;
    let fileError: string | null = null;

    bb.on("file", (_name, fileStream, info) => {
      fileFound = true;
      const { mimeType } = info;
      const allowedMimes: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const ext = allowedMimes[mimeType.toLowerCase()];
      if (!ext) {
        fileError = "Invalid file type. Allowed formats: JPEG, PNG, WebP.";
        fileStream.resume();
        return;
      }

      const filename = `avatar_${req.userId}_${Date.now()}.${ext}`;
      const logicalPath = `Avatars/${filename}`;

      uploadPromise = new Promise(async (resolve, reject) => {
        let sizeLimitExceeded = false;
        fileStream.on("limit", () => {
          sizeLimitExceeded = true;
          fileError = "Avatar file size exceeds the 2MB limit.";
        });

        try {
          await StorageService.save(logicalPath, fileStream);
          if (sizeLimitExceeded) {
            await StorageService.delete(logicalPath).catch(() => {});
            reject(new Error("Avatar file size exceeds the 2MB limit."));
          } else {
            resolve(filename);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    bb.on("close", async () => {
      try {
        if (!fileFound) {
          res.status(400).json({ message: "No avatar image provided" });
          return;
        }

        if (fileError) {
          res.status(400).json({ message: fileError });
          return;
        }

        if (!uploadPromise) {
          res.status(400).json({ message: "Failed to upload avatar" });
          return;
        }

        const filename = await uploadPromise;

        const user = await User.findById(req.userId);
        if (!user) {
          res.status(404).json({ message: "User not found" });
          return;
        }

        // Delete old avatar from storage if present
        if (user.avatarUrl && user.avatarUrl.startsWith("/api/auth/avatar/")) {
          const oldFilename = user.avatarUrl.replace("/api/auth/avatar/", "");
          if (/^avatar_[a-zA-Z0-9_\-\.]+$/.test(oldFilename)) {
            await StorageService.delete(`Avatars/${oldFilename}`).catch(() => {});
          }
        }

        user.avatarUrl = `/api/auth/avatar/${filename}`;
        await user.save();

        res.json({
          message: "Avatar uploaded successfully",
          avatarUrl: user.avatarUrl,
          user: user.toJSON(),
        });
      } catch (err: any) {
        console.error("[auth] Avatar upload close error:", err);
        res.status(500).json({ message: err?.message || "Failed to save avatar" });
      }
    });

    req.pipe(bb);
  } catch (err: any) {
    console.error("[auth] Avatar upload error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/avatar/:filename — stream avatar image securely
// ---------------------------------------------------------------------------

router.get("/avatar/:filename", async (req: Request, res: Response) => {
  try {
    const rawFilename = req.params["filename"];
    const filename = typeof rawFilename === "string" ? rawFilename : "";
    // Strict filename verification
    if (!/^avatar_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      res.status(400).json({ message: "Invalid avatar filename" });
      return;
    }

    const logicalPath = `Avatars/${filename}`;
    const exists = await StorageService.exists(logicalPath);
    if (!exists) {
      res.status(404).json({ message: "Avatar not found" });
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day client cache
    const stream = await StorageService.read(logicalPath);
    await pipeline(stream, res);
  } catch (err: any) {
    console.error("[auth] Avatar download error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to load avatar" });
    }
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/avatar — remove avatar image
// ---------------------------------------------------------------------------

router.delete("/avatar", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.avatarUrl && user.avatarUrl.startsWith("/api/auth/avatar/")) {
      const oldFilename = user.avatarUrl.replace("/api/auth/avatar/", "");
      if (/^avatar_[a-zA-Z0-9_\-\.]+$/.test(oldFilename)) {
        await StorageService.delete(`Avatars/${oldFilename}`).catch(() => {});
      }
    }

    user.avatarUrl = "";
    await user.save();

    res.json({ message: "Avatar removed successfully", user: user.toJSON() });
  } catch (err: any) {
    console.error("[auth] Delete avatar error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (
      !currentPassword ||
      !newPassword ||
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      res.status(400).json({ message: "Current and new password must be valid strings" });
      return;
    }

    const passwordPolicy = validatePasswordStrength(newPassword);
    if (!passwordPolicy.valid) {
      res.status(400).json({ message: passwordPolicy.message });
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
// POST /api/auth/forgot-password — request 6-digit OTP via phone or email
// ---------------------------------------------------------------------------

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const rawVal = req.body.phone ?? req.body.email ?? req.body.identifier;
    if (typeof rawVal !== "string" && typeof rawVal !== "number") {
      res.status(400).json({ message: "Phone number or email is required as text" });
      return;
    }

    const rawIdentifier = String(rawVal).trim();
    if (!rawIdentifier) {
      res.status(400).json({ message: "Phone number or email is required" });
      return;
    }

    let user = null;
    const isEmail = rawIdentifier.includes("@");

    if (isEmail) {
      user = await User.findOne({ email: rawIdentifier.toLowerCase() }).select(
        "+resetOtpHash +resetOtpExpires +resetOtpAttempts",
      );
    } else {
      // Clean phone number: remove non-digits
      const cleanDigits = rawIdentifier.replace(/\D/g, "");
      if (cleanDigits.length < 5) {
        res.status(400).json({ message: "Please provide a valid phone number" });
        return;
      }
      // Match phone allowing optional spaces/dashes between digits
      const lastDigits = cleanDigits.slice(-10);
      const flexiblePhoneRegex = lastDigits.split("").join("[\\s\\-\\(\\)\\+]*");
      user = await User.findOne({
        phone: { $regex: flexiblePhoneRegex, $options: "i" },
      }).select("+resetOtpHash +resetOtpExpires +resetOtpAttempts");
    }

    if (!user) {
      // Prevent account enumeration by returning a generic success response
      res.json({
        success: true,
        message: "If an account matching the provided details exists, a verification code has been dispatched.",
      });
      return;
    }

    // Cryptographically secure 6-digit numeric OTP
    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.resetOtpHash = await bcrypt.hash(otp, 12);
    user.resetOtpExpires = expiresAt;
    user.resetOtpAttempts = 0;
    await user.save();

    // Actual OTP delivery through configured provider
    try {
      const destination = isEmail ? user.email : (user.phone || user.email);
      await getPasswordResetDeliveryProvider().sendOtp({
        destination,
        otp,
        expiresAt,
        channel: isEmail ? "email" : "sms",
      });
    } catch (deliveryErr) {
      // Invalidate the saved OTP so an undelivered code cannot be used
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      await user.save();
      console.error("[auth] Failed to deliver password reset OTP:", (deliveryErr as Error).message);
      res.status(500).json({
        message: "Failed to dispatch verification code. Please try again or contact your administrator.",
      });
      return;
    }

    // Mask phone/email for privacy display without leaking full data
    const rawPhone = user.phone || "";
    let maskedDest = "";
    if (rawPhone.length >= 6) {
      maskedDest = `${rawPhone.slice(0, 3)}••••${rawPhone.slice(-4)}`;
    } else if (user.email) {
      const [local, domain] = user.email.split("@");
      maskedDest = `${(local || "").slice(0, 2)}••••@${domain}`;
    }

    res.json({
      success: true,
      message: "If an account matching the provided details exists, a verification code has been dispatched.",
      destination: maskedDest,
    });
  } catch (err) {
    console.error("[auth] Forgot password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password — verify 6-digit OTP and set new password
// ---------------------------------------------------------------------------

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const rawVal = req.body.phone ?? req.body.email ?? req.body.identifier;
    const otpVal = req.body.otp;
    const newPassVal = req.body.newPassword;

    if (
      (typeof rawVal !== "string" && typeof rawVal !== "number") ||
      (typeof otpVal !== "string" && typeof otpVal !== "number") ||
      typeof newPassVal !== "string"
    ) {
      res.status(400).json({ message: "Phone or email, OTP code, and new password are required." });
      return;
    }

    const rawIdentifier = String(rawVal).trim();
    const otp = String(otpVal).trim();
    const newPassword = String(newPassVal);

    if (!rawIdentifier || !otp || !newPassword) {
      res.status(400).json({ message: "Phone or email, OTP code, and new password are required." });
      return;
    }

    const passwordPolicy = validatePasswordStrength(newPassword);
    if (!passwordPolicy.valid) {
      res.status(400).json({ message: passwordPolicy.message });
      return;
    }

    const isEmail = rawIdentifier.includes("@");
    let user = null;

    if (isEmail) {
      user = await User.findOne({ email: rawIdentifier.toLowerCase() }).select(
        "+resetOtpHash +resetOtpExpires +resetOtpAttempts",
      );
    } else {
      const cleanDigits = rawIdentifier.replace(/\D/g, "");
      const lastDigits = cleanDigits.slice(-10);
      const flexiblePhoneRegex = lastDigits.split("").join("[\\s\\-\\(\\)\\+]*");
      user = await User.findOne({
        phone: { $regex: flexiblePhoneRegex, $options: "i" },
      }).select("+resetOtpHash +resetOtpExpires +resetOtpAttempts");
    }

    if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
      res.status(400).json({ message: "Invalid verification request. Please request a new code." });
      return;
    }

    // Maximum 5 attempts allowed per OTP
    if ((user.resetOtpAttempts || 0) >= 5) {
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      res.status(400).json({
        message: "Too many failed attempts. This verification code has been invalidated. Please request a new code.",
      });
      return;
    }

    if (new Date() > user.resetOtpExpires) {
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      await user.save();
      res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      return;
    }

    const isOtpValid = await bcrypt.compare(otp, user.resetOtpHash);
    if (!isOtpValid) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      res.status(400).json({ message: "Incorrect 6-digit verification code. Please check and try again." });
      return;
    }

    // Set new password and invalidate OTP
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetOtpHash = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    await user.save();

    // Revoke all existing sessions so old logins are terminated
    await Session.revokeAllForUser(user._id);

    // Disconnect active socket connections
    const io = req.app.get("io");
    if (io) {
      const userIdStr = user._id.toString();
      for (const s of io.sockets.sockets.values()) {
        if (s.data.userId === userIdStr) s.disconnect(true);
      }
    }

    res.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("[auth] Reset password error:", err);
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
      passwordHash: await bcrypt.hash("password123", 12),
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
