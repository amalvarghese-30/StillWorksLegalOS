/**
 * Legacy WebDAV Compatibility Layer
 * Re-exports from the authoritative VPS StorageService in `./storage.js`.
 * Direct production operations use local VPS filesystem storage.
 */
export * from "./storage.js";

export interface WebDavContext {
  client: any;
  config: { url: string; rootPath: string; username?: string };
}

export async function getWebDavClient(): Promise<WebDavContext> {
  const { STORAGE_ROOT } = await import("./storage.js");
  return {
    client: {} as any,
    config: { url: "local", rootPath: STORAGE_ROOT },
  };
}
