declare const __APP_VERSION__: string | undefined;

/**
 * Current application release version.
 * Auto-injected at build time by Vite from package.json, with fallback.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "1.0.16";
