import path from "node:path";
import fs from "node:fs";

export interface ResolveEnvPathOptions {
  required?: boolean;
}

/**
 * Sanitizes and normalizes the project root directory path.
 * Trims leading/trailing whitespace and resolves to an absolute path.
 */
export function sanitizeProjectRoot(rawRoot?: string): string {
  const root = (rawRoot ?? process.cwd()).trim();
  if (!root) {
    return path.resolve(process.cwd());
  }
  return path.resolve(root);
}

/**
 * Resolves and normalizes an environment file path.
 * Strips accidental leading/trailing whitespace, prevents invalid concatenation,
 * supports both absolute and relative paths, and validates required files if requested.
 */
export function resolveEnvPath(
  projectRoot: string,
  filename: string,
  options: ResolveEnvPathOptions = {}
): string {
  if (typeof filename !== "string") {
    throw new TypeError("Environment filename must be a string.");
  }

  const normalizedFilename = filename.trim();

  if (!normalizedFilename) {
    throw new Error("Environment filename cannot be empty.");
  }

  const cleanRoot = sanitizeProjectRoot(projectRoot);
  const resolved = path.isAbsolute(normalizedFilename)
    ? path.normalize(normalizedFilename)
    : path.resolve(cleanRoot, normalizedFilename);

  if (options.required && !fs.existsSync(resolved)) {
    throw new Error(`Required environment file "${normalizedFilename}" not found at ${resolved}`);
  }

  return resolved;
}

/**
 * Returns candidate environment file paths for a given mode,
 * strictly sanitized without accidental trailing spaces.
 */
export function getValidEnvFiles(projectRoot: string, mode: string = "development"): string[] {
  const cleanRoot = sanitizeProjectRoot(projectRoot);
  const cleanMode = (mode || "development").trim();

  const names = [
    ".env",
    ".env.local",
    `.env.${cleanMode}`,
    `.env.${cleanMode}.local`,
  ];

  return names.map((name) => resolveEnvPath(cleanRoot, name));
}
