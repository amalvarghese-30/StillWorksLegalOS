import { createServer } from "node:http";
import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import clientsRoutes from "./routes/clients.js";
import casesRoutes from "./routes/cases.js";
import tasksRoutes from "./routes/tasks.js";
import calendarRoutes from "./routes/calendar.js";
import documentsRoutes from "./routes/documents.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import notificationsRoutes from "./routes/notifications.js";
import searchRoutes from "./routes/search.js";
import { ChatGroup, ChatMessage } from "./models/Chat.js";
import { Session } from "./models/Session.js";
import { User } from "./models/User.js";
import { getJwtSecret } from "./middleware/auth.js";
import { NotificationScheduler } from "./services/notificationScheduler.js";
import rateLimit from "express-rate-limit";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Handle both ESM (dev) and bundled CommonJS (production) for dotenv path
function getDirname(): string {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  // In bundled CommonJS, __dirname is available as a global
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _global = global as any;
  return _global.__dirname ?? process.cwd();
}

const __dirname = getDirname();
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PORT = parseInt(process.env["SERVER_PORT"] ?? "3001", 10);
const HOST = process.env["SERVER_HOST"] ?? "0.0.0.0"; // Listen on all interfaces by default
const MONGODB_URI = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017/stillworks";

// ---------------------------------------------------------------------------
// CORS origins — Recommendation #3: allow both Vite dev & Electron
// ---------------------------------------------------------------------------

const rawOrigins = process.env["CORS_ORIGINS"] ?? "http://localhost:5173,app://.,https://legalos.stillworks.in";
const ALLOWED_ORIGINS = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow all origins when CORS_ORIGINS=* (local testing only)
      if (ALLOWED_ORIGINS.includes("*")) return callback(null, true);
      // Same logic as Express CORS - allow dev + Electron origins
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // Allow file:// protocol for Electron production (loadFile)
      if (origin.startsWith("file://")) return callback(null, true);
      if (
        process.env["NODE_ENV"] === "development" &&
        (origin.startsWith("http://localhost:") ||
         origin.startsWith("http://127.0.0.1:") ||
         origin.startsWith("http://192.168.") ||
         origin.startsWith("http://10.") ||
         origin.startsWith("http://172.16.") ||
         origin.startsWith("[::1]:") ||
         origin.startsWith("http://[::1]:"))
      ) {
        return callback(null, true);
      }
      callback(new Error("Socket.io origin not allowed"));
    },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client-type"],
};

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Security: Helmet for standard HTTP headers
// Configure specifically for our needs (CSP handled by Electron in production)
app.use(
  helmet({
    contentSecurityPolicy: false, // Handled by Electron's session.webRequest
    crossOriginEmbedderPolicy: false, // Can break file: protocol in Electron
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: "deny" },
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // certificate pinning must be handled at reverse proxy / load balancer level
    // expectCt: { enforce: true, maxAge: 86400 }, // Only with valid certs
  }),
);

// Trust proxy for accurate IP detection behind reverse proxy
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// CORS must run BEFORE rate limiters so that rate-limited/preflight responses
// still include Access-Control-Allow-Origin headers.
// ---------------------------------------------------------------------------
app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

// Global rate limiter: generous for a local single-user desktop app.
// The server runs on localhost serving one Electron renderer, so every request
// shares a single IP. A dashboard load fires 15-20 parallel requests; 100 per
// 15 min would break normal use. Use a high ceiling + short window instead.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  skip: (req) => req.path === "/api/health", // Don't rate limit health checks
});
app.use(globalLimiter);

// Auth endpoints: 30 attempts per 15 minutes (still blocks brute force,
// but allows normal retries after a typo or password manager hiccup).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
});
app.use("/api/auth", authLimiter);

// Admin endpoints: 300 requests per minute (dashboard fires many reports)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: "Too many admin requests" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
});
app.use("/api/admin", adminLimiter);

// Document operations: 120 per minute (list + upload + versions)
const documentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: "Too many document operations" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
});
app.use("/api/documents/upload", documentLimiter);
app.use("/api/documents", documentLimiter);

// Health check (no auth, no rate limit)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/search", searchRoutes);

// ---------------------------------------------------------------------------
// Static web app (same-origin hosting for the web/mobile version)
// ---------------------------------------------------------------------------
// Set WEB_DIST_PATH to the directory containing the built index.html (e.g. the
// frontend `dist/` folder). Hash-based routing means no SPA fallback is needed
// — deep links live entirely in the URL fragment.
const webDistPath = process.env["WEB_DIST_PATH"] || (process.env["NODE_ENV"] === "production" ? path.resolve(__dirname, "..", "..", "dist") : null);
if (webDistPath && existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  console.log(`[server] Serving static web app from: ${webDistPath}`);
}

// ---------------------------------------------------------------------------
// HTTP server + Socket.io
// ---------------------------------------------------------------------------

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins when CORS_ORIGINS=* (local testing only)
      if (ALLOWED_ORIGINS.includes("*")) return callback(null, true);
      // Same logic as Express CORS - allow dev + Electron origins
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // Allow file:// protocol for Electron production (loadFile)
      if (origin.startsWith("file://")) return callback(null, true);
      if (
        process.env["NODE_ENV"] === "development" &&
        (origin.startsWith("http://localhost:") ||
         origin.startsWith("http://127.0.0.1:") ||
         origin.startsWith("http://192.168.") ||
         origin.startsWith("http://10.") ||
         origin.startsWith("http://172.16.") ||
         origin.startsWith("[::1]:") ||
         origin.startsWith("http://[::1]:"))
      ) {
        return callback(null, true);
      }
      callback(new Error("Socket.io origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Make io accessible to route handlers
app.set("io", io);

const MAX_SOCKETS_PER_USER = 5;

// ---------------------------------------------------------------------------
// Socket.io Authentication Middleware
// ---------------------------------------------------------------------------
// Validates JWT on connection handshake — fails fast, no anonymous connections

io.use(async (socket, next) => {
  try {
    // Token comes from handshake auth (sent by client on connect)
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.warn("[socket] Connection rejected: no token provided", socket.id);
      return next(new Error("Authentication required"));
    }

    // Verify JWT with explicit HS256 enforcement
    const secret = getJwtSecret();
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, secret, { algorithms: ["HS256"] }) as {
      userId: string;
      email: string;
      role: string;
    };

    // Validate the session is still live in the DB — a revoked/expired session
    // must not be able to open a socket even with a cryptographically valid JWT.
    const session = await Session.findOne({
      token,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });
    if (!session) {
      console.warn("[socket] Connection rejected: session revoked/expired", socket.id);
      return next(new Error("Session revoked or expired"));
    }

    // Per-user connection cap — prevents a single account from exhausting
    // sockets / file descriptors.
    let userConnections = 0;
    for (const s of io.sockets.sockets.values()) {
      if (s.data.userId === payload.userId) userConnections += 1;
    }
    if (userConnections >= MAX_SOCKETS_PER_USER) {
      console.warn("[socket] Connection rejected: too many connections", socket.id);
      return next(new Error("Too many connections"));
    }

    // Attach user info to socket (sessionId stays stable across token refresh,
    // enabling precise per-session revocation).
    socket.data.userId = payload.userId;
    socket.data.email = payload.email;
    socket.data.role = payload.role;
    socket.data.sessionId = session._id.toString();

    // Auto-join user-specific room for direct messages/notifications
    socket.join(`user:${payload.userId}`);

    // Admin users auto-join the live-feed room
    if (payload.role === "admin") {
      socket.join("admin:live-feed");
    }

    console.log(`[socket] authenticated: ${payload.userId} (${payload.role})`);
    next();
  } catch (err) {
    console.warn("[socket] Connection rejected: invalid token", socket.id);
    next(new Error("Invalid or expired token"));
  }
});

// ---------------------------------------------------------------------------
// Socket.io connection handling
// ---------------------------------------------------------------------------

// Simple in-memory per-user token bucket for chat socket events (rate limiting).
const socketRateBuckets = new Map<string, { count: number; windowStart: number }>();

function allowSocketEvent(userId: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = socketRateBuckets.get(userId);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    socketRateBuckets.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id} (${socket.data.userId})`);

  // Resolve the user's display name once (used for typing indicators) and
  // persist presence so the chat UI can show "online / last seen" correctly.
  User.findById(socket.data.userId)
    .select("name")
    .then((user) => {
      socket.data.userName = user?.name ?? "Unknown";
      return User.updateOne(
        { _id: socket.data.userId },
        { status: "online" },
      );
    })
    .catch((err) => console.error("[socket] presence init error:", err));

  // Broadcast online status to others
  socket.broadcast.emit("user:online", {
    userId: socket.data.userId,
    status: "online",
  });

  // Join/leave chat rooms WITH authorization check
  socket.on("chat:join", async (roomId: string) => {
    try {
      if (!roomId) {
        socket.emit("error", { message: "Room ID required" });
        return;
      }

      // Verify user is member of this chat group
      const group = await ChatGroup.findById(roomId).lean();
      if (!group) {
        socket.emit("error", { message: "Group not found" });
        return;
      }

      // Admins can join any group
      const isAdmin = socket.data.role === "admin";
      const isMember = group.members.some((m) => m.userId.toString() === socket.data.userId);

      if (!isAdmin && !isMember) {
        socket.emit("error", { message: "Access denied: not a member of this chat" });
        return;
      }

      socket.join(`chat:${roomId}`);
      console.log(`[socket] ${socket.data.userId} joined chat:${roomId}`);
    } catch (err) {
      console.error("[socket] chat:join error:", err);
      socket.emit("error", { message: "Failed to join chat" });
    }
  });

  socket.on("chat:leave", (roomId: string) => {
    socket.leave(`chat:${roomId}`);
    console.log(`[socket] ${socket.data.userId} left chat:${roomId}`);
  });

  // NOTE: Message sending is handled exclusively via REST (POST /api/chat/...).
  // The socket only broadcasts real-time events (typing, presence, deletes,
  // reactions) so there is a single source of truth for message persistence.

  // Live activity telemetry
  socket.on("activity", (data: { action: string; resourceId?: string }) => {
    if (socket.data.userId && allowSocketEvent(socket.data.userId, 20, 60_000)) {
      io.to("admin:live-feed").emit("activity:event", {
        userId: socket.data.userId,
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Typing indicators
  const typingTimers = new Map<string, NodeJS.Timeout>();

  socket.on("chat:typing", (data: { groupId: string }) => {
    const { groupId } = data;
    if (!groupId || !socket.rooms.has(`chat:${groupId}`)) return;
    if (!allowSocketEvent(socket.data.userId, 30, 60_000)) return;

    // Broadcast to others in the room
    socket.to(`chat:${groupId}`).emit("chat:typing", {
      groupId,
      userId: socket.data.userId,
      userName: socket.data.userName ?? "Someone",
    });

    // Clear existing timer
    const timerKey = `${socket.data.userId}:${groupId}`;
    if (typingTimers.has(timerKey)) {
      clearTimeout(typingTimers.get(timerKey)!);
    }

    // Auto-stop typing after 3 seconds
    const timer = setTimeout(() => {
      socket.to(`chat:${groupId}`).emit("chat:stop-typing", {
        groupId,
        userId: socket.data.userId,
      });
      typingTimers.delete(timerKey);
    }, 3000);

    typingTimers.set(timerKey, timer);
  });

  socket.on("chat:stop-typing", (data: { groupId: string }) => {
    const { groupId } = data;
    if (!groupId || !socket.rooms.has(`chat:${groupId}`)) return;

    const timerKey = `${socket.data.userId}:${groupId}`;
    if (typingTimers.has(timerKey)) {
      clearTimeout(typingTimers.get(timerKey)!);
      typingTimers.delete(timerKey);
    }

    socket.to(`chat:${groupId}`).emit("chat:stop-typing", {
      groupId,
      userId: socket.data.userId,
    });
  });

  // Emoji reactions via socket (alternative to REST)
  socket.on("chat:reaction", async (data: { messageId: string; emoji: string; groupId: string }) => {
    try {
      const { messageId, emoji, groupId } = data;
      if (!messageId || !emoji || !groupId) return;
      if (!allowSocketEvent(socket.data.userId, 30, 60_000)) return;

      // Verify membership
      const group = await ChatGroup.findById(groupId).lean();
      if (!group) return;

      const isAdmin = socket.data.role === "admin";
      const isMember = group.members.some((m) => m.userId.toString() === socket.data.userId);
      if (!isAdmin && !isMember) return;

      const message = await ChatMessage.findById(messageId);
      if (!message) return;

      const existingIdx = message.reactions.findIndex(
        (r: any) => r.userId.toString() === socket.data.userId && r.emoji === emoji
      );

      if (existingIdx >= 0) {
        message.reactions.splice(existingIdx, 1);
      } else {
        const mongoose = await import("mongoose");
        message.reactions.push({ userId: new mongoose.Types.ObjectId(socket.data.userId), emoji });
      }

      await message.save();

      // Broadcast to room
      io.to(`chat:${groupId}`).emit("chat:reaction", {
        messageId,
        emoji,
        userId: socket.data.userId,
        action: existingIdx >= 0 ? "remove" : "add",
      });
    } catch (err) {
      console.error("[socket] Reaction error:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.data.userId) {
      // Persist offline presence + last seen timestamp
      User.updateOne(
        { _id: socket.data.userId },
        { status: "offline", lastActiveAt: new Date() },
      ).catch((err) => console.error("[socket] presence clear error:", err));

      socket.broadcast.emit("user:offline", {
        userId: socket.data.userId,
        status: "offline",
      });
    }
    console.log(`[socket] disconnected: ${socket.id} (${socket.data.userId})`);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  try {
    await connectDB(MONGODB_URI);
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`[server] StillWorks LegalOS API running on http://localhost:${PORT}`);
      console.log(`[server] CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
      console.log(`[server] Environment: ${process.env["NODE_ENV"] ?? "development"}`);
      // Start the notification scheduler
      NotificationScheduler.start(io);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

start();