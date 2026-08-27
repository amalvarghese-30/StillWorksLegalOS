import { Readable, Transform, Writable } from "node:stream";
import { createHash } from "node:crypto";
import { createClient, type WebDAVClient, type FileStat } from "webdav";
import { AppSettings, type SynologyConfig } from "../models/AppSettings.js";
import { decryptSecret } from "./encryption.js";

// ---------------------------------------------------------------------------
// Unified WebDAV service wrapper for the on-premise Synology NAS.
//
// The client is instantiated dynamically from the active SynologyConfig in
// MongoDB (set via Admin Settings → Storage). All paths are resolved relative
// to the configured LegalOS root folder on the NAS, so callers work with
// logical paths (e.g. "/Cases/Case-01") rather than absolute NAS paths.
// ---------------------------------------------------------------------------

export interface WebDavContext {
  client: WebDAVClient;
  config: SynologyConfig;
}

function joinPath(root: string, path: string): string {
  const base = root.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const joined = `${base}${rel}`.replace(/\/{2,}/g, "/");
  return joined || "/";
}

/** Returns the parent logical path of a file path (e.g. "/a/b/c.pdf" → "/a/b"). */
function parentPath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  return idx <= 0 ? "/" : normalized.slice(0, idx);
}

function createClientFromConfig(config: SynologyConfig): WebDAVClient {
  const password = config.passwordEncrypted ? decryptSecret(config.passwordEncrypted) : "";
  return createClient(config.url, {
    username: config.username || undefined,
    password: password || undefined,
  });
}

/** Loads the active config from the DB and returns a ready-to-use client. */
export async function getWebDavClient(): Promise<WebDavContext> {
  const config = await AppSettings.getSynologyConfig();
  if (!config || !config.url) {
    throw new Error("Synology WebDAV is not configured. Set it in Admin Settings → Storage.");
  }
  return { client: createClientFromConfig(config), config };
}

/** Lists entries in a directory relative to the LegalOS root. */
export async function listDirectory(path: string): Promise<FileStat[]> {
  const { client, config } = await getWebDavClient();
  return client.getDirectoryContents(joinPath(config.rootPath, path));
}

/** Checks whether a file or directory exists. */
export async function pathExists(path: string): Promise<boolean> {
  const { client, config } = await getWebDavClient();
  return client.exists(joinPath(config.rootPath, path));
}

/** Creates a directory (optionally creating missing parents). */
export async function createDirectory(path: string, recursive = false): Promise<void> {
  const { client, config } = await getWebDavClient();
  await client.createDirectory(joinPath(config.rootPath, path), { recursive });
}

/** Deletes a file or directory. */
export async function deletePath(path: string): Promise<void> {
  const { client, config } = await getWebDavClient();
  await client.deleteFile(joinPath(config.rootPath, path));
}

/** Moves/renames a file or directory. */
export async function movePath(from: string, to: string): Promise<void> {
  const { client, config } = await getWebDavClient();
  await client.moveFile(joinPath(config.rootPath, from), joinPath(config.rootPath, to));
}

export interface UploadResult {
  size: number;
  sha256: string;
}

/**
 * Streams a readable source to the NAS while hashing the bytes as they pass
 * through. The file is never buffered in memory — chunks are forwarded
 * directly into the WebDAV PUT stream, so this scales to large files.
 */
export async function uploadStream(path: string, source: Readable): Promise<UploadResult> {
  const { client, config } = await getWebDavClient();
  const fullPath = joinPath(config.rootPath, path);

  // Ensure the parent folder exists (recursively) before writing.
  await client.createDirectory(joinPath(config.rootPath, parentPath(path)), { recursive: true });

  const hash = createHash("sha256");
  let size = 0;
  const hasher = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let writeStream: Writable | null = null;

    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const fail = (err: unknown) => {
      if (!settled) {
        settled = true;
        hasher.destroy();
        // Abort the in-flight PUT so the NAS discards the partial file.
        writeStream?.destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    // The write stream's callback fires only after the PUT response is received
    // and validated (non-2xx responses are surfaced as `error` events).
    writeStream = client.createWriteStream(fullPath, { overwrite: true }, () => done());
    writeStream.on("error", fail);
    hasher.on("error", fail);
    source.on("error", fail);

    source.pipe(hasher).pipe(writeStream);
  });

  return { size, sha256: hash.digest("hex") };
}

/** Opens a read stream for a file on the NAS (relative to the LegalOS root). */
export async function downloadStream(path: string): Promise<Readable> {
  const { client, config } = await getWebDavClient();
  return client.createReadStream(joinPath(config.rootPath, path));
}

export interface TestConnectionResult {
  ok: boolean;
  url: string;
  server?: string;
  compliance?: string[];
  rootExists?: boolean;
  error?: string;
}

export interface TestConnectionInput {
  url: string;
  username: string;
  password: string;
  rootPath: string;
}

/**
 * Verifies a WebDAV endpoint is reachable, speaking DAV, and that the
 * configured LegalOS root folder exists.
 *
 * Pass an override to test unsaved values (the admin settings form); otherwise
 * the saved config is loaded from the DB and its password decrypted.
 */
export async function testConnection(override?: TestConnectionInput): Promise<TestConnectionResult> {
  let url = "";
  try {
    let client: WebDAVClient;
    let rootPath = "";

    if (override?.url) {
      url = override.url;
      rootPath = override.rootPath || "";
      let password = override.password || "";
      // Fall back to the saved (decrypted) password when testing with a blank
      // one, so "Test connection" works without re-entering credentials.
      if (!password) {
        const saved = await AppSettings.getSynologyConfig();
        if (saved?.passwordEncrypted) password = decryptSecret(saved.passwordEncrypted);
      }
      client = createClient(url, {
        username: override.username || undefined,
        password: password || undefined,
      });
    } else {
      const config = await AppSettings.getSynologyConfig();
      url = config?.url ?? "";
      if (!config || !url) {
        return { ok: false, url, error: "Synology WebDAV is not configured." };
      }
      rootPath = config.rootPath || "";
      client = createClientFromConfig(config);
    }

    const compliance = await client.getDAVCompliance("/");
    const rootExists = rootPath ? await client.exists(rootPath) : undefined;

    return {
      ok: true,
      url,
      server: compliance.server,
      compliance: compliance.compliance,
      rootExists,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, url, error: message };
  }
}
