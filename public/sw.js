// StillWorks LegalOS — minimal service worker for PWA installability.
//
// The app is fully online (live case/chat data), so we deliberately do NOT
// cache API responses. This worker only enables install-to-homescreen on
// mobile; all requests pass through to the network.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
