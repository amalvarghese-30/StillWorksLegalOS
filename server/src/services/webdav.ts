import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import type { FileStat } from "webdav";

// ---------------------------------------------------------------------------
// Local VPS Disk Storage Provider.
// All files are stored directly on the VPS disk in the configured STORAGE_DIR
// (defaults to "./uploads" relative to process.cwd()).
// ---------------------------------------------------------------------------

const STORAGE_ROOT = process.env["STORAGE_DIR"]
  ? path.resolve(process.env["STORAGE_DIR"])
  : path.resolve(process.cwd(), "uploads");

// Ensure base upload directory exists synchronously on load
try {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
} catch (err) {
  console.error("[storage] Failed to ensure STORAGE_ROOT directory:", STORAGE_ROOT, err);
}

const canonicalRoot = fs.existsSync(STORAGE_ROOT)
  ? fs.realpathSync(STORAGE_ROOT)
  : path.resolve(STORAGE_ROOT);

/** Resolves a logical path to a safe absolute VPS disk path with canonical containment & symlink checks */
export function getLocalPath(logicalPath: string, allowRoot = false): string {
  if (typeof logicalPath !== "string") {
    throw new Error("Invalid storage path: path must be a string");
  }

  // Remove null bytes
  let decoded = logicalPath.replace(/\0/g, "");

  // Decode nested URL encoded segments to prevent double-encoding evasion (%252e%252e)
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  // Normalize separators and strip Windows drive letters
  decoded = decoded.replace(/\\+/g, "/").replace(/^[a-zA-Z]:/, "");

  // Strip leading slashes to make relative to STORAGE_ROOT
  const relPath = decoded.replace(/^\/+/, "");

  const resolved = path.resolve(canonicalRoot, relPath);
  const relative = path.relative(canonicalRoot, resolved);

  // Strict containment check: cannot traverse outside canonical root
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: Invalid storage path traversal attempt");
  }

  if (relative === "" && !allowRoot) {
    throw new Error("Access denied: Target cannot be the storage root directory");
  }

  // Check symlinks if the target already exists
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    const realRel = path.relative(canonicalRoot, realTarget);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
      throw new Error("Access denied: Symlink escapes storage root boundary");
    }
    return realTarget;
  } else {
    // For pending uploads / new files, verify existing parent directory doesn't escape via symlink
    let ancestor = path.dirname(resolved);
    while (ancestor.length >= canonicalRoot.length && fs.existsSync(ancestor)) {
      const realAncestor = fs.realpathSync(ancestor);
      const realRel = path.relative(canonicalRoot, realAncestor);
      if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
        throw new Error("Access denied: Symlink parent directory escapes storage root boundary");
      }
      break;
    }
  }

  return resolved;
}

export interface WebDavContext {
  client: any;
  config: { url: string; rootPath: string; username?: string };
}

export interface UploadResult {
  size: number;
  sha256: string;
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
  url?: string;
  username?: string;
  password?: string;
  rootPath?: string;
}

/** Compatible context helper */
export async function getWebDavClient(): Promise<WebDavContext> {
  return {
    client: {} as any,
    config: { url: "local", rootPath: STORAGE_ROOT },
  };
}

/** Lists entries in a directory relative to the LegalOS root on VPS disk. */
export async function listDirectory(logicalPath: string): Promise<FileStat[]> {
  const fullPath = getLocalPath(logicalPath, true);
  if (!fs.existsSync(fullPath)) return [];

  const entries = await fsp.readdir(fullPath, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (ent) => {
      const entPath = path.join(fullPath, ent.name);
      const stat = await fsp.stat(entPath).catch(() => null);
      return {
        filename: path.posix.join(logicalPath.startsWith("/") ? logicalPath : `/${logicalPath}`, ent.name),
        basename: ent.name,
        lastmod: stat ? stat.mtime.toUTCString() : new Date().toUTCString(),
        size: stat ? stat.size : 0,
        type: (ent.isDirectory() ? "directory" : "file") as "directory" | "file",
        etag: null,
      };
    })
  );
  return results;
}

/** Checks whether a file or directory exists on VPS disk. */
export async function pathExists(logicalPath: string): Promise<boolean> {
  return fs.existsSync(getLocalPath(logicalPath, true));
}

/** Creates a directory (optionally creating missing parents). */
export async function createDirectory(logicalPath: string, recursive = false): Promise<void> {
  await fsp.mkdir(getLocalPath(logicalPath, true), { recursive });
}

/** Deletes a file or directory from VPS disk. */
export async function deletePath(logicalPath: string): Promise<void> {
  const fullPath = getLocalPath(logicalPath);
  if (fs.existsSync(fullPath)) {
    const stat = await fsp.stat(fullPath);
    if (stat.isDirectory()) {
      await fsp.rm(fullPath, { recursive: true, force: true });
    } else {
      await fsp.unlink(fullPath);
    }
  }
}

/** Moves/renames a file or directory on VPS disk. */
export async function movePath(from: string, to: string): Promise<void> {
  const src = getLocalPath(from);
  const dst = getLocalPath(to);
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await fsp.rename(src, dst);
}

/**
 * Streams a readable source directly to VPS local disk while hashing bytes in transit.
 */
export async function uploadStream(logicalPath: string, source: Readable): Promise<UploadResult> {
  const fullPath = getLocalPath(logicalPath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });

  const hash = createHash("sha256");
  let size = 0;
  const hasher = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  const writeStream = fs.createWriteStream(fullPath);

  await pipeline(source, hasher, writeStream);

  return { size, sha256: hash.digest("hex") };
}

/** Opens a read stream for a file on the VPS local disk. */
export async function downloadStream(logicalPath: string): Promise<Readable> {
  const fullPath = getLocalPath(logicalPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${logicalPath}`);
  }
  return fs.createReadStream(fullPath);
}

/**
 * Verifies VPS local storage is writable and healthy.
 */
export async function testConnection(_override?: TestConnectionInput): Promise<TestConnectionResult> {
  try {
    if (!fs.existsSync(STORAGE_ROOT)) {
      await fsp.mkdir(STORAGE_ROOT, { recursive: true });
    }
    const testFile = path.join(STORAGE_ROOT, `.test-write-${Date.now()}`);
    await fsp.writeFile(testFile, "ok");
    await fsp.unlink(testFile);

    return {
      ok: true,
      url: STORAGE_ROOT,
      server: `VPS Local Storage (${STORAGE_ROOT})`,
      compliance: ["1", "2"],
      rootExists: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, url: STORAGE_ROOT, error: message };
  }
}
