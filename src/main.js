import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
const router = getRouter();
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(RouterProvider, { router: router }) }));
// Register the service worker for PWA installability (web/mobile only).
// Service workers are unavailable on file:// (Electron) and in dev, so this
// is gated to production builds in a secure context.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
            // PWA is a progressive enhancement — a failed registration is non-fatal.
        });
    });
}
