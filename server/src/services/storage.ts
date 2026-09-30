import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Production VPS / Cloud Filesystem Storage Service
// All application documents and attachments are stored on the VPS disk within
// the application-controlled STORAGE_ROOT directory.
// Clients NEVER specify or control storage paths.
// ---------------------------------------------------------------------------

export const STORAGE_ROOT = process.env["STORAGE_DIR"]
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

/**
 * Resolves a logical storage path to a safe, canonical absolute path on the VPS disk.
 * Strictly defends against:
 * - Null byte injection
 * - Multi-pass URL encoded traversal (%252e%252e, %2e%2e)
 * - Windows drive letters (C:, D:)
 * - Backslashes and UNC network paths
 * - Directory traversal (../, ..\)
 * - Symlink escapes
 */
export function getLocalPath(logicalPath: string, allowRoot = false): string {
  if (typeof logicalPath !== "string") {
    throw new Error("Invalid storage path: path must be a string");
  }

  // 1. Remove null bytes
  let decoded = logicalPath.replace(/\0/g, "");

  // 2. Decode nested URL encoded segments to prevent double-encoding evasion
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  // 3. Normalize backslashes and strip Windows drive letters or UNC prefixes
  decoded = decoded.replace(/\\+/g, "/").replace(/^[a-zA-Z]:/, "");

  // 4. Strip leading slashes to make path relative to STORAGE_ROOT
  const relPath = decoded.replace(/^\/+/, "");

  // 5. Canonical containment check
  const resolved = path.resolve(canonicalRoot, relPath);
  const relative = path.relative(canonicalRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: Invalid storage path traversal attempt");
  }

  if (relative === "" && !allowRoot) {
    throw new Error("Access denied: Target cannot be the storage root directory");
  }

  // 6. Check symlinks if the target already exists
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    const realRel = path.relative(canonicalRoot, realTarget);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
      throw new Error("Access denied: Symlink escapes storage root boundary");
    }
    return realTarget;
  } else {
    // For new files, verify existing parent directories don't escape via symlinks
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

export interface FileMetadata {
  size: number;
  lastModified: Date;
  isFile: boolean;
  isDirectory: boolean;
}

export interface StorageDirectoryEntry {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "directory" | "file";
  etag: null;
}

/**
 * StorageService abstraction providing secure VPS filesystem operations
 */
export class StorageService {
  /**
   * Save a stream to VPS disk while computing SHA-256 in transit
   */
  static async save(logicalPath: string, source: Readable): Promise<UploadResult> {
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

  /**
   * Open a readable stream for a file on VPS disk
   */
  static async read(logicalPath: string): Promise<Readable> {
    const fullPath = getLocalPath(logicalPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${logicalPath}`);
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Delete a file or directory from VPS disk
   */
  static async delete(logicalPath: string): Promise<void> {
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

  /**
   * Check if a path exists on VPS disk
   */
  static async exists(logicalPath: string): Promise<boolean> {
    try {
      return fs.existsSync(getLocalPath(logicalPath, true));
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for a file
   */
  static async getMetadata(logicalPath: string): Promise<FileMetadata | null> {
    try {
      const fullPath = getLocalPath(logicalPath, true);
      if (!fs.existsSync(fullPath)) return null;
      const stat = await fsp.stat(fullPath);
      return {
        size: stat.size,
        lastModified: stat.mtime,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolves safe local path
   */
  static getPath(logicalPath: string, allowRoot = false): string {
    return getLocalPath(logicalPath, allowRoot);
  }

  /**
   * List entries in a directory
   */
  static async list(logicalPath: string): Promise<StorageDirectoryEntry[]> {
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

  /**
   * Create a directory
   */
  static async createDirectory(logicalPath: string, recursive = false): Promise<void> {
    await fsp.mkdir(getLocalPath(logicalPath, true), { recursive });
  }

  /**
   * Move or rename a file or directory
   */
  static async move(from: string, to: string): Promise<void> {
    const src = getLocalPath(from);
    const dst = getLocalPath(to);
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
  }

  /**
   * Verify storage health and write capability
   */
  static async testConnection(_override?: TestConnectionInput): Promise<TestConnectionResult> {
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
}

// ---------------------------------------------------------------------------
// Convenience functional exports matching previous interface for zero regressions
// ---------------------------------------------------------------------------
export const uploadStream = StorageService.save;
export const downloadStream = StorageService.read;
export const deletePath = StorageService.delete;
export const pathExists = StorageService.exists;
export const listDirectory = StorageService.list;
export const createDirectory = StorageService.createDirectory;
export const movePath = StorageService.move;
export const testConnection = StorageService.testConnection;
