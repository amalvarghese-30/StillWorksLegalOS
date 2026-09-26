/**
 * Socket.io client — real-time chat, presence, and live activity.
 *
 * Provides a SocketProvider (wrap the app in __root.tsx) and two hooks:
 * - useSocket()        → socket instance + connection status
 * - useSocketEvent()   → subscribe to a single event
 *
 * IMPORTANT: SocketProvider must be nested INSIDE AuthProvider so it can
 * call useAuth() to know when a user is logged in and connect accordingly.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/services/api";
import { useAuth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
}

function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window as any).STILLWORKS_ENV?.isElectron === true ||
    window.location.protocol === "file:" ||
    window.location.protocol === "app:" ||
    (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron"))
  );
}

function getSocketUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Local dev: any port on localhost or 127.0.0.1
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001";
    }
    // Local LAN IP (testing on same WiFi)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return `${window.location.protocol}//${host}:3001`;
    }
    // Web browser domain
    if (host.includes("stillworks.in")) {
      return window.location.origin;
    }
  }
  if (isElectron()) {
    return "https://legalos.stillworks.in";
  }
  if (import.meta.env["VITE_SOCKET_URL"]) {
    return import.meta.env["VITE_SOCKET_URL"];
  }
  // Production remote default:
  return "https://legalos.stillworks.in";
}

const SOCKET_URL = getSocketUrl();

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SocketCtx = createContext<SocketContextValue>({
  socket: null,
  status: "disconnected",
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SocketProvider({ children }: { children: ReactNode }) {
  // CRITICAL: use useState (not useRef) so consumers re-render when socket connects
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  // Subscribe to auth so we know when a user logs in/out
  const { user, ready } = useAuth();

  useEffect(() => {
    // Wait until AuthProvider has finished its async init()
    if (!ready) return;

    // User logged out — disconnect any existing socket
    if (!user) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      setStatus("disconnected");
      return;
    }

    // User is authenticated — grab the in-memory access token
    const token = getAccessToken();
    if (!token) {
      // Rare edge-case: auth is ready but token refresh is still in-flight
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const newSocket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      // Read the token fresh on every (re)connection — it rotates on refresh
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
    });

    newSocket.on("connect", () => {
      console.log("[socket] connected:", newSocket.id, "user:", user._id);
      setStatus("connected");
    });

    newSocket.on("disconnect", () => {
      setStatus("disconnected");
    });

    newSocket.on("connect_error", (err) => {
      console.warn("[socket] Connection error:", err.message);
      setStatus("error");
    });

    newSocket.on("error", (err: { message?: string }) => {
      console.warn("[socket] Server error:", err?.message ?? err);
    });

    // Publish new socket instance to context (triggers consumer re-renders)
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setStatus("disconnected");
    };
    // Re-run whenever the authenticated user changes (login / logout / switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, ready]);

  return (
    <SocketCtx.Provider value={{ socket, status }}>
      {children}
    </SocketCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Get the raw socket instance + connection status. */
export function useSocket(): SocketContextValue {
  return useContext(SocketCtx);
}

/**
 * Subscribe to a socket.io event. Automatically cleans up on unmount
 * or when `event` / `deps` change.
 *
 * @param event   Event name (e.g. "chat:message", "notification:new")
 * @param handler Callback invoked with the event payload
 * @param deps    React deps array — handler is re-bound when these change
 */
export function useSocketEvent<T = unknown>(
  event: string | null,
  handler: (data: T) => void,
  deps: unknown[] = [],
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !event) return;

    const listener = (data: T) => handlerRef.current(data);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event, ...deps]);
}

/**
 * Emit a socket.io event and optionally await an acknowledgement.
 */
export function useSocketEmit() {
  const { socket } = useSocket();

  return useCallback(
    <T = unknown>(event: string, ...args: unknown[]): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
          reject(new Error("Socket not connected"));
          return;
        }
        socket.emit(event, ...args, (ack: T) => resolve(ack));
      });
    },
    [socket],
  );
}
