/**
 * PresenceProvider — server-authoritative, multi-session online/offline tracking.
 *
 * Sends a presence:heartbeat every 25 s while connected.
 * Subscribes to presence:initial, presence:changed, user:online, user:offline.
 * Exposes usePresence() so any component can check whether a given userId is online.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSocket } from "@/lib/socket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceContextValue {
  /** Map of userId → true when that user currently has an active session */
  onlineMap: Record<string, boolean>;
  /** Convenience: true if the given userId is online */
  isOnline: (userId: string | undefined | null) => boolean;
  /** The raw Set of online user IDs */
  onlineIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PresenceCtx = createContext<PresenceContextValue>({
  onlineMap: {},
  isOnline: () => false,
  onlineIds: new Set(),
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 25_000;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived: stable Set for O(1) lookups
  const onlineIds = new Set(Object.keys(onlineMap).filter((k) => onlineMap[k]));

  const isOnline = useCallback(
    (userId: string | undefined | null): boolean => {
      if (!userId) return false;
      return Boolean(onlineMap[userId]);
    },
    [onlineMap],
  );

  useEffect(() => {
    if (!socket) return;

    // ── Subscribe: request current online map from server ──────────────────
    socket.emit("presence:subscribe");

    // ── presence:initial — full map seed ───────────────────────────────────
    const handleInitial = (map: Record<string, { status: "online"; lastHeartbeat: number }>) => {
      const next: Record<string, boolean> = {};
      for (const [uid, entry] of Object.entries(map)) {
        next[uid] = entry.status === "online";
      }
      setOnlineMap(next);
    };

    // ── presence:changed — single user status change ───────────────────────
    const handleChanged = (payload: { userId: string; status: "online" | "offline" }) => {
      setOnlineMap((prev) => ({
        ...prev,
        [payload.userId]: payload.status === "online",
      }));
    };

    // ── Legacy events: user:online / user:offline ──────────────────────────
    const handleOnline = (data: { userId: string }) => {
      setOnlineMap((prev) => ({ ...prev, [data.userId]: true }));
    };
    const handleOffline = (data: { userId: string }) => {
      setOnlineMap((prev) => ({ ...prev, [data.userId]: false }));
    };

    socket.on("presence:initial", handleInitial);
    socket.on("presence:changed", handleChanged);
    socket.on("user:online", handleOnline);
    socket.on("user:offline", handleOffline);

    // Re-subscribe on reconnect
    const handleConnect = () => {
      socket.emit("presence:subscribe");
    };
    socket.on("connect", handleConnect);

    // ── Heartbeat ──────────────────────────────────────────────────────────
    // Clear any previous interval first
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit("presence:heartbeat");
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      socket.off("presence:initial", handleInitial);
      socket.off("presence:changed", handleChanged);
      socket.off("user:online", handleOnline);
      socket.off("user:offline", handleOffline);
      socket.off("connect", handleConnect);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [socket]);

  return (
    <PresenceCtx.Provider value={{ onlineMap, isOnline, onlineIds }}>
      {children}
    </PresenceCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Access real-time presence for any userId. */
export function usePresence(): PresenceContextValue {
  return useContext(PresenceCtx);
}
