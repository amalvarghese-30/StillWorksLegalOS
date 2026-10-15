import { Types } from "mongoose";
import { User } from "../models/User.js";

export interface ActiveSession {
  socketId: string;
  sessionId: string;
  userId: string;
  clientType: "web" | "electron" | "unknown";
  connectedAt: Date;
  lastHeartbeat: number; // Date.now() timestamp
}

export interface UserPresenceState {
  userId: string;
  status: "online" | "away" | "offline";
  lastActiveAt: Date;
  sessionCount: number;
}

class PresenceService {
  // Map of socketId -> ActiveSession
  private sessionsBySocketId = new Map<string, ActiveSession>();

  // Map of userId -> Set of socketIds
  private socketsByUserId = new Map<string, Set<string>>();

  // Stale threshold: 75 seconds without heartbeat = session expired
  public readonly STALE_THRESHOLD_MS = 75_000;

  // Cleanup check interval: 30 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  private io: any = null;

  constructor() {
    this.startCleanupInterval();
  }

  public setIo(io: any): void {
    this.io = io;
  }

  public startCleanupInterval(intervalMs: number = 30_000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.expireStaleSessions(this.io);
    }, intervalMs);
    // Unref so it does not block Node process exit in test runners
    this.cleanupInterval.unref?.();
  }

  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Register a new active session for a connected socket.
   * Returns true if this is the user's FIRST active session (transition from offline to online).
   */
  public async registerSession(params: {
    socketId: string;
    sessionId?: string;
    userId: string;
    clientType?: "web" | "electron" | "unknown";
    io?: any;
  }): Promise<{ becameOnline: boolean; sessionCount: number }> {
    const { socketId, sessionId = socketId, userId, clientType = "unknown", io } = params;

    const existingSocketSet = this.socketsByUserId.get(userId) ?? new Set<string>();
    const isFirstSession = existingSocketSet.size === 0;

    const session: ActiveSession = {
      socketId,
      sessionId,
      userId,
      clientType,
      connectedAt: new Date(),
      lastHeartbeat: Date.now(),
    };

    this.sessionsBySocketId.set(socketId, session);
    existingSocketSet.add(socketId);
    this.socketsByUserId.set(userId, existingSocketSet);

    if (isFirstSession) {
      try {
        await User.updateOne(
          { _id: new Types.ObjectId(userId) },
          { status: "online", lastActiveAt: new Date() }
        );
      } catch (err) {
        console.error(`[presence] Failed to update user status in DB for ${userId}:`, err);
      }

      if (io) {
        const payload = {
          userId,
          status: "online" as const,
          lastActiveAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        };
        io.emit("presence:changed", payload);
        io.emit("user:online", { userId, status: "online" });
      }
    }

    return { becameOnline: isFirstSession, sessionCount: existingSocketSet.size };
  }

  /**
   * Record a heartbeat from a connected socket session.
   */
  public recordHeartbeat(socketId: string): boolean {
    const session = this.sessionsBySocketId.get(socketId);
    if (!session) return false;

    session.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Remove a session when a socket disconnects.
   * Returns true if the user transitioned from online to offline (0 remaining sessions).
   */
  public async removeSession(
    socketId: string,
    io?: any
  ): Promise<{ becameOffline: boolean; userId?: string }> {
    const session = this.sessionsBySocketId.get(socketId);
    if (!session) return { becameOffline: false };

    const { userId } = session;
    this.sessionsBySocketId.delete(socketId);

    const userSockets = this.socketsByUserId.get(userId);
    let becameOffline = false;

    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.socketsByUserId.delete(userId);
        becameOffline = true;
      }
    } else {
      becameOffline = true;
    }

    if (becameOffline) {
      const now = new Date();
      try {
        await User.updateOne(
          { _id: new Types.ObjectId(userId) },
          { status: "offline", lastActiveAt: now }
        );
      } catch (err) {
        console.error(`[presence] Failed to clear user status in DB for ${userId}:`, err);
      }

      if (io) {
        const payload = {
          userId,
          status: "offline" as const,
          lastActiveAt: now.toISOString(),
          timestamp: now.toISOString(),
        };
        io.emit("presence:changed", payload);
        io.emit("user:offline", { userId, status: "offline" });
      }
    }

    return { becameOffline, userId };
  }

  /**
   * Sweep and expire sessions that haven't heartbeated within STALE_THRESHOLD_MS.
   */
  public async expireStaleSessions(io?: any): Promise<number> {
    const now = Date.now();
    const staleSocketIds: string[] = [];

    for (const [socketId, session] of this.sessionsBySocketId.entries()) {
      if (now - session.lastHeartbeat > this.STALE_THRESHOLD_MS) {
        staleSocketIds.push(socketId);
      }
    }

    for (const socketId of staleSocketIds) {
      await this.removeSession(socketId, io);
    }

    return staleSocketIds.length;
  }

  /**
   * Check if a user currently has at least one active, live session.
   */
  public isUserOnline(userId: string): boolean {
    const sockets = this.socketsByUserId.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Get active session count for a user.
   */
  public getUserSessionCount(userId: string): number {
    return this.socketsByUserId.get(userId)?.size ?? 0;
  }

  /**
   * Get current presence map of all users who are currently online.
   */
  public getLivePresenceMap(): Record<string, { status: "online"; lastHeartbeat: number }> {
    const map: Record<string, { status: "online"; lastHeartbeat: number }> = {};
    for (const [userId, sockets] of this.socketsByUserId.entries()) {
      if (sockets.size > 0) {
        // Find latest heartbeat among active sockets for this user
        let latestHb = 0;
        for (const sId of sockets) {
          const s = this.sessionsBySocketId.get(sId);
          if (s && s.lastHeartbeat > latestHb) {
            latestHb = s.lastHeartbeat;
          }
        }
        map[userId] = { status: "online", lastHeartbeat: latestHb };
      }
    }
    return map;
  }

  /**
   * Reset all in-memory presence tracking (used in tests or server restart).
   */
  public reset(): void {
    this.sessionsBySocketId.clear();
    this.socketsByUserId.clear();
  }
}

export const presenceService = new PresenceService();
