import crypto from "node:crypto";
import { Request } from "express";
import { Case } from "../models/Case.js";

/**
 * NAS Security Service
 *
 * Handles secure file operations with:
 * - Path traversal prevention
 * - SHA-256 integrity verification
 * - Access control based on case membership
 *
 * Actual read/write streams against the office Synology NAS live in
 * `services/webdav.ts` (WebDAV over HTTPS via Cloudflare Tunnel).
 */

export interface FileIntegrityResult {
  valid: boolean;
  expectedHash: string;
  actualHash?: string;
  error?: string;
}

export interface NasFolderNode {
  name: string;
  path: string;
  children?: NasFolderNode[];
  isCaseFolder?: boolean;
  caseId?: string;
}

/**
 * NAS base path from environment
 */
const NAS_BASE_PATH = process.env["NAS_BASE_PATH"] ?? "/mnt/legal-docs";

/**
 * Sanitize and validate a file path to prevent traversal attacks
 * Returns normalized path relative to NAS base, or throws error
 */
export function sanitizeNasPath(inputPath: string, basePath: string = NAS_BASE_PATH): string {
  // Resolve to absolute path
  const resolvedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const requestedPath = inputPath.startsWith("/") ? inputPath : `/${inputPath}`;

  // Normalize (resolve .. and .)
  let normalized = requestedPath;
  const parts = normalized.split("/").filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      // Only pop if we're not at base
      if (stack.length > 0) stack.pop();
    } else if (part !== ".") {
      stack.push(part);
    }
  }

  normalized = "/" + stack.join("/");

  // Ensure the resolved path is within base
  const fullPath = `${resolvedBase}${normalized}`;
  const realBase = resolvedBase;
  const realFull = fullPath;

  if (!realFull.startsWith(realBase)) {
    throw new Error("Path traversal attempt detected");
  }

  return normalized; // Return path relative to base
}

/**
 * Generate a secure case folder path
 * Format: /Cases/{caseNumber}-{caseId}
 */
export function getCaseFolderPath(caseNumber: string, caseId: string): string {
  // Sanitize case number for filesystem
  const safeNumber = caseNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitizeNasPath(`/Cases/${safeNumber}-${caseId}`);
}

/**
 * Generate a secure document path within a case folder
 * Format: /Cases/{caseNumber}-{caseId}/{documentId}-{sanitizedName}
 */
export function getDocumentPath(caseNumber: string, caseId: string, documentId: string, originalName: string): string {
  const ext = originalName.includes(".") ? originalName.substring(originalName.lastIndexOf(".")) : "";
  const safeName = originalName
    .replace(/\.[^.]+$/, "") // remove extension
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 100);
  return sanitizeNasPath(`/Cases/${caseNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}-${caseId}/${documentId}-${safeName}${ext}`);
}

/**
 * Compute SHA-256 hash of a file buffer
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Compute SHA-256 hash of a file stream (for large files)
 */
export async function computeFileHashStream(readable: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    readable.on("data", (chunk) => hash.update(chunk));
    readable.on("end", () => resolve(hash.digest("hex")));
    readable.on("error", reject);
  });
}

/**
 * Verify file integrity against stored hash
 */
export function verifyFileIntegrity(buffer: Buffer, expectedHash: string): FileIntegrityResult {
  const actualHash = computeFileHash(buffer);
  return {
    valid: actualHash === expectedHash,
    expectedHash,
    actualHash,
    error: actualHash === expectedHash ? undefined : "File integrity check failed - hash mismatch",
  };
}

/**
 * Verify file integrity from stream
 */
export async function verifyFileIntegrityStream(
  readable: NodeJS.ReadableStream,
  expectedHash: string
): Promise<FileIntegrityResult> {
  const actualHash = await computeFileHashStream(readable);
  return {
    valid: actualHash === expectedHash,
    expectedHash,
    actualHash,
    error: actualHash === expectedHash ? undefined : "File integrity check failed - hash mismatch",
  };
}

/**
 * Build NAS folder tree for a user (only shows accessible cases)
 */
export async function buildAccessibleNasTree(userId: string, userRole: string): Promise<NasFolderNode[]> {
  let accessibleCaseIds: string[] = [];

  if (userRole !== "admin") {
    const cases = await Case.find({
      $or: [{ assignedTo: userId }, { createdBy: userId }],
    })
      .select("number _id")
      .lean();
    accessibleCaseIds = cases.map((c) => c._id.toString());
  }

  const rootFolders: NasFolderNode[] = [
    { name: "Templates", path: "/Templates" },
    { name: "Firm Knowledge Base", path: "/Knowledge" },
    { name: "Archives", path: "/Archives" },
  ];

  if (userRole === "admin" || accessibleCaseIds.length > 0) {
    const cases = userRole === "admin"
      ? await Case.find({}).select("number _id").lean()
      : await Case.find({ _id: { $in: accessibleCaseIds } }).select("number _id").lean();

    const caseFolders: NasFolderNode[] = cases.map((c) => ({
      name: c.number,
      path: `/Cases/${c.number.replace(/[^a-zA-Z0-9_-]/g, "_")}-${c._id}`,
      isCaseFolder: true,
      caseId: c._id.toString(),
    }));

    rootFolders.unshift({
      name: "Cases",
      path: "/Cases",
      children: caseFolders,
    });
  }

  return rootFolders;
}

/**
 * Validate MIME type against allowed document types
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/tiff",
];

export function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` };
  }
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSizeMB: number = 100): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }
  return { valid: true };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Audit log helper for document operations
 */
export function createDocumentAuditLog(
  userId: string,
  userName: string,
  action: string,
  documentId: string,
  documentName: string,
  req: Request,
  details?: string
) {
  return {
    userId,
    userName,
    action,
    resource: "document",
    resourceId: documentId,
    resourceName: documentName,
    details,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date(),
  };
}