import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Socket.io client — real-time chat, presence, and live activity.
 *
 * Provides a SocketProvider (wrap the app in _shell.tsx) and two hooks:
 * - useSocket()        → socket instance + connection status
 * - useSocketEvent()   → subscribe to a single event
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef, } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "@/services/api";
const SOCKET_URL = import.meta.env["VITE_SOCKET_URL"] ?? "http://localhost:3001";
// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const SocketCtx = createContext({
    socket: null,
    status: "disconnected",
});
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function SocketProvider({ children }) {
    const [status, setStatus] = useState("disconnected");
    const socketRef = useRef(null);
    useEffect(() => {
        const token = getAccessToken();
        if (!token) {
            setStatus("disconnected");
            return;
        }
        setStatus("connecting");
        const socket = io(SOCKET_URL, {
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
        socket.on("error", (err) => {
            console.warn("[socket] Server error:", err?.message ?? err);
        });
        return () => {
            socket.disconnect();
            socketRef.current = null;
            setStatus("disconnected");
        };
    }, []);
    return (_jsx(SocketCtx.Provider, { value: { socket: socketRef.current, status }, children: children }));
}
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
/** Get the raw socket instance + connection status. */
export function useSocket() {
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
export function useSocketEvent(event, handler, deps = []) {
    const { socket } = useSocket();
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    useEffect(() => {
        if (!socket || !event)
            return;
        const listener = (data) => handlerRef.current(data);
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
    return useCallback((event, ...args) => {
        return new Promise((resolve, reject) => {
            if (!socket || !socket.connected) {
                reject(new Error("Socket not connected"));
                return;
            }
            socket.emit(event, ...args, (ack) => resolve(ack));
        });
    }, [socket]);
}
