/**
 * Socket.io client — real-time chat, presence, and live activity.
 *
 * Provides a SocketProvider (wrap the app in _shell.tsx) and two hooks:
 * - useSocket()        → socket instance + connection status
 * - useSocketEvent()   → subscribe to a single event
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
}

function getSocketUrl(): string {
  if (import.meta.env["VITE_SOCKET_URL"]) {
    return import.meta.env["VITE_SOCKET_URL"];
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Local dev ONLY
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
  // Electron (file:// or custom protocol) or production remote default:
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
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      // Read the token fresh on every (re)connection attempt — the access
      // token rotates on refresh, so a captured value goes stale after ~15m.
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Token is sent in handshake auth; server middleware validates it
      setStatus("connected");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[socket] Connection error:", err.message);
      setStatus("error");
    });

    socket.on("error", (err: { message?: string }) => {
      console.warn("[socket] Server error:", err?.message ?? err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setStatus("disconnected");
    };
  }, []);

  return (
    <SocketCtx.Provider value={{ socket: socketRef.current, status }}>
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
 * @param event  Event name (e.g. "chat:message", "user:online")
 * @param handler Callback invoked with the event payload
 * @param deps   React deps array — handler is re-bound when these change
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
 * Emit a socket.io event and get an ack (if the server responds).
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
