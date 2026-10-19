/**
 * assigneeNormalization.ts
 *
 * Shared utility for normalising task/case assignment inputs.
 *
 * Accepted input formats (for maximum legacy compatibility):
 *   - A single ObjectId string:          "507f1f77bcf86cd799439011"
 *   - An array of ObjectId strings:      ["507f…", "6acb…"]
 *   - A comma-separated legacy string:   "507f…,6acb…"
 *   - null / undefined / empty string:   treated as "no assignees"
 *
 * All accepted inputs are normalised to a **deduplicated** array of valid
 * mongoose.Types.ObjectId instances.
 *
 * The caller chooses whether to require at least one assignee and whether
 * every supplied ID must exist in the database.
 */

import mongoose from "mongoose";
import { User } from "../models/User.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalisedAssignees {
  /** Validated, deduplicated ObjectId array – may be empty */
  assignedUsers: mongoose.Types.ObjectId[];
  /** First item in assignedUsers, or null when the list is empty */
  assignedTo: mongoose.Types.ObjectId | null;
}

export interface NormaliseOptions {
  /**
   * When true every supplied ID is verified to exist in the Users collection
   * and an error is returned for any unknown / invalid ID.
   *
   * Default: false  (IDs are only format-validated, not DB-validated)
   */
  validateExistence?: boolean;

  /**
   * When the raw input is completely absent / null / empty the caller may
   * supply a fallback ObjectId that becomes the sole assignee.  Typically
   * this is the creator's userId.
   *
   * When undefined and the list is empty the function returns an empty list
   * (caller decides what to do with an unassigned task).
   */
  fallbackUserId?: string | mongoose.Types.ObjectId;
}

export interface NormaliseResult {
  ok: true;
  data: NormalisedAssignees;
}

export interface NormaliseError {
  ok: false;
  /** Human-readable client error (safe to return directly in API response) */
  message: string;
  /** HTTP status code to use */
  status: 400 | 403;
}

export type NormaliseOutcome = NormaliseResult | NormaliseError;

// ---------------------------------------------------------------------------
// Core normaliser
// ---------------------------------------------------------------------------

/**
 * Normalise any assignment input into a clean, deduplicated ObjectId array.
 *
 * @param raw   The raw value from req.body (any shape is accepted).
 * @param opts  Optional configuration.
 */
export async function normaliseAssignees(
  raw: unknown,
  opts: NormaliseOptions = {}
): Promise<NormaliseOutcome> {
  // ── Step 1: flatten to an array of raw strings ──────────────────────────
  let rawStrings: string[] = [];

  if (raw === null || raw === undefined || raw === "") {
    // deliberate empty — fall through to fallback handling
  } else if (Array.isArray(raw)) {
    // Accept: ["id1", "id2"]  or  [{ _id: "id1" }, …]  (populated objects)
    rawStrings = raw
      .map((item: any) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          // populated mongoose document or plain object with _id
          return String(item._id || item.id || "").trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  } else if (typeof raw === "string") {
    if (raw.includes(",")) {
      // Legacy comma-separated format
      rawStrings = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      rawStrings = [raw.trim()];
    }
  } else if (typeof raw === "object" && raw !== null) {
    // Single populated object: { _id: "…", name: "…" }
    const id = String((raw as any)._id || (raw as any).id || "").trim();
    if (id) rawStrings = [id];
  }

  // ── Step 2: format-validate every candidate ──────────────────────────────
  const invalid = rawStrings.filter((s) => !mongoose.Types.ObjectId.isValid(s));
  if (invalid.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Invalid assignee ID format: ${invalid.join(", ")}`,
    };
  }

  // ── Step 3: deduplicate ──────────────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueIds: mongoose.Types.ObjectId[] = [];
  for (const s of rawStrings) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueIds.push(new mongoose.Types.ObjectId(s));
    }
  }

  // ── Step 4: optional existence check ─────────────────────────────────────
  if (opts.validateExistence && uniqueIds.length > 0) {
    const found = await User.find({ _id: { $in: uniqueIds } })
      .select("_id")
      .lean();
    const foundSet = new Set(found.map((u: any) => u._id.toString()));
    const missing = uniqueIds.filter((id) => !foundSet.has(id.toString()));
    if (missing.length > 0) {
      return {
        ok: false,
        status: 400,
        message: `Unknown assignee ID(s): ${missing.map((id) => id.toString()).join(", ")}. Each selected employee must exist.`,
      };
    }
  }

  // ── Step 5: apply fallback when list is empty ────────────────────────────
  if (uniqueIds.length === 0 && opts.fallbackUserId) {
    const fb = String(opts.fallbackUserId).trim();
    if (mongoose.Types.ObjectId.isValid(fb)) {
      uniqueIds.push(new mongoose.Types.ObjectId(fb));
    }
  }

  return {
    ok: true,
    data: {
      assignedUsers: uniqueIds,
      assignedTo: uniqueIds.length > 0 ? uniqueIds[0] : null,
    },
  };
}

/**
 * Build the initial assignmentHistory entries for a newly created task.
 * One entry is created per assignee.
 *
 * @param assignedUsers   The final normalised assignee list.
 * @param assignedByUserId  The ObjectId of the user performing the assignment.
 * @param actorName       Human-readable name of the assigning actor.
 */
export function buildInitialAssignmentHistory(
  assignedUsers: mongoose.Types.ObjectId[],
  assignedByUserId: mongoose.Types.ObjectId | string,
  actorName = "Staff"
): Array<{
  fromUser: null;
  toUser: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  action: "assigned";
  note: string;
  timestamp: Date;
}> {
  const assignedByObjectId =
    assignedByUserId instanceof mongoose.Types.ObjectId
      ? assignedByUserId
      : new mongoose.Types.ObjectId(String(assignedByUserId));

  const now = new Date();
  return assignedUsers.map((toUser) => ({
    fromUser: null,
    toUser,
    assignedBy: assignedByObjectId,
    action: "assigned" as const,
    note: `Initial task assignment by ${actorName}`,
    timestamp: now,
  }));
}
