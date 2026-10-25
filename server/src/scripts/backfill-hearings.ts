/**
 * StillWorks LegalOS — Hearing Calendar Backfill Script
 *
 * Creates or repairs CalendarEvent records for cases that have a nextHearing
 * date but are missing (or have a stale) linked CalendarEvent.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-hearings.ts           # dry-run (safe, no writes)
 *   npx tsx src/scripts/backfill-hearings.ts --apply   # apply changes
 *
 * Idempotent: running --apply multiple times produces the same result.
 * The script only adopts a legacy hearing when the relationship is unambiguous;
 * otherwise it creates a separately marked next-hearing event and preserves history.
 * Skips cases with status "Archived" or soft-deleted.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../db.js";
import { User } from "../models/User.js";
import { Client } from "../models/Client.js";
import { Case } from "../models/Case.js";
import { CalendarEvent } from "../models/CalendarEvent.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const DRY_RUN = !process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// Flexible date parser (mirrors server/src/routes/cases.ts)
// ---------------------------------------------------------------------------

function parseFlexibleDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 10;
    const minutes = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] !== undefined ? parseInt(ymdMatch[4], 10) : 10;
    const minutes = ymdMatch[5] !== undefined ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] !== undefined ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }

  const standard = new Date(s);
  return isNaN(standard.getTime()) ? null : standard;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mongoUri = process.env["MONGODB_URI"] || process.env["MONGO_URI"] || "";
  if (!mongoUri) {
    console.error("[backfill] ERROR: MONGODB_URI not set in environment. Aborting.");
    process.exit(1);
  }

  console.log(`\n[backfill] Hearing Calendar Backfill — ${DRY_RUN ? "DRY RUN (no writes)" : "APPLYING CHANGES"}`);
  console.log("[backfill] Connecting to MongoDB…");
  await connectDB(mongoUri);
  console.log("[backfill] Connected.\n");

  // Find all non-archived, non-deleted cases with a nextHearing date
  const cases = await Case.find({
    nextHearing: { $ne: null, $exists: true },
    status: { $nin: ["Archived"] },
    deletedAt: { $exists: false },
  }).lean();

  console.log(`[backfill] Found ${cases.length} case(s) with nextHearing date.`);

  let skipped = 0;
  let created = 0;
  let updated = 0;
  let invalid = 0;
  let errors = 0;

  for (const c of cases) {
    const caseId = c._id as mongoose.Types.ObjectId;
    const hearingDate = parseFlexibleDate(c.nextHearing as unknown);

    if (!hearingDate) {
      console.log(`  [SKIP-INVALID] ${c.number} — could not parse nextHearing: ${JSON.stringify(c.nextHearing)}`);
      invalid++;
      continue;
    }

    try {
      // Prefer the explicitly marked next-hearing event. Legacy unmarked
      // events are only adopted when date matching identifies exactly one
      // candidate, or the case has exactly one historical hearing.
      let existingEvent = await CalendarEvent.findOne({
        caseId,
        type: "hearing",
        isNextHearing: true,
      });

      const unmarkedEvents = existingEvent
        ? []
        : await CalendarEvent.find({
            caseId,
            type: "hearing",
            isNextHearing: { $ne: true },
          }).sort({ start: -1 });

      const sameLocalDate = (left: Date, right: Date) =>
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate();

      if (!existingEvent) {
        const sameDateEvents = unmarkedEvents.filter((event) =>
          sameLocalDate(new Date(event.start), hearingDate)
        );
        if (sameDateEvents.length === 1) {
          existingEvent = sameDateEvents[0];
        } else if (sameDateEvents.length === 0 && unmarkedEvents.length === 1) {
          existingEvent = unmarkedEvents[0];
        } else if (sameDateEvents.length > 1 || unmarkedEvents.length > 1) {
          console.warn(
            `  [AMBIGUOUS] ${c.number} has multiple unmarked hearing events. Historical events will be preserved; a separate next-hearing event will be created if applying.`
          );
        }
      }

      // Build assigned users set
      const assignedUserIds = new Set<string>();
      if (Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0) {
        for (const u of c.assignedUsers as any[]) {
          const id = String(u?._id ?? u);
          if (id && mongoose.Types.ObjectId.isValid(id)) assignedUserIds.add(id);
        }
      }
      if (c.assignedTo) {
        const id = String((c.assignedTo as any)?._id ?? c.assignedTo);
        if (id && mongoose.Types.ObjectId.isValid(id)) assignedUserIds.add(id);
      }
      // Also add createdBy so it shows in their personal calendar
      if (c.createdBy) {
        const id = String((c.createdBy as any)?._id ?? c.createdBy);
        if (id && mongoose.Types.ObjectId.isValid(id)) assignedUserIds.add(id);
      }
      const assignedTo = Array.from(assignedUserIds).map((id) => new mongoose.Types.ObjectId(id));

      // Resolve primary client
      const primaryParty = (c.parties || []).find(
        (p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId
      );
      const clientId = primaryParty ? (primaryParty.clientId as any)?._id ?? primaryParty.clientId : null;

      const eventTitle = `Hearing: ${c.number || "Case"} — ${c.title}`;
      const eventDesc = `Court hearing for matter ${c.number || ""}. Court: ${c.court || "Court"}${c.judge ? `, Judge: ${c.judge}` : ""}.`;

      if (!existingEvent) {
        // No hearing event at all — create one
        console.log(
          `  [CREATE] ${c.number} "${c.title}" → hearing on ${hearingDate.toLocaleDateString("en-IN")} (${hearingDate.toISOString()})`
        );
        if (!DRY_RUN) {
          const creatorId = c.createdBy
            ? ((c.createdBy as any)?._id ?? c.createdBy)
            : assignedTo[0] ?? new mongoose.Types.ObjectId();

          await CalendarEvent.create({
            title: eventTitle,
            description: eventDesc,
            type: "hearing",
            start: hearingDate,
            end: hearingDate,
            allDay: false,
            caseId,
            clientId: clientId || null,
            createdBy: creatorId,
            assignedTo,
            isNextHearing: true,
            color: "#6366f1",
          });
        }
        created++;
      } else {
        // Event exists — check if start date is significantly different (>1 minute)
        const existingStart = existingEvent.start;
        const diffMs = Math.abs(existingStart.getTime() - hearingDate.getTime());
        const ONE_MINUTE_MS = 60 * 1000;

        if (diffMs > ONE_MINUTE_MS) {
          console.log(
            `  [UPDATE] ${c.number} "${c.title}" → existing: ${existingStart.toLocaleDateString("en-IN")} → new: ${hearingDate.toLocaleDateString("en-IN")}`
          );
          if (!DRY_RUN) {
            existingEvent.title = eventTitle;
            existingEvent.description = eventDesc;
            existingEvent.start = hearingDate;
            existingEvent.end = hearingDate;
            existingEvent.assignedTo = assignedTo;
            existingEvent.clientId = clientId || null;
            existingEvent.isNextHearing = true;
            await existingEvent.save();
          }
          updated++;
        } else {
          if (!DRY_RUN && existingEvent.isNextHearing !== true) {
            existingEvent.isNextHearing = true;
            existingEvent.clientId = clientId || null;
            existingEvent.assignedTo = assignedTo;
            await existingEvent.save();
          }
          console.log(
            `  [OK]     ${c.number} "${c.title}" → canonical next-hearing event is current (${existingStart.toLocaleDateString("en-IN")})`
          );
          skipped++;
        }
      }
    } catch (err) {
      console.error(`  [ERROR]  ${c.number} "${c.title}":`, (err as Error).message);
      errors++;
    }
  }

  console.log("\n[backfill] ─────────────────────────────────────────────────────");
  console.log(`[backfill] Summary:`);
  console.log(`  Cases processed : ${cases.length}`);
  console.log(`  Already OK      : ${skipped}`);
  console.log(`  Created         : ${created}`);
  console.log(`  Updated         : ${updated}`);
  console.log(`  Invalid dates   : ${invalid}`);
  console.log(`  Errors          : ${errors}`);
  if (DRY_RUN) {
    console.log(`\n  ℹ  This was a DRY RUN. No changes were written.`);
    console.log(`     To apply changes, run: npx tsx src/scripts/backfill-hearings.ts --apply`);
  } else {
    console.log(`\n  ✓  Changes applied successfully.`);
  }
  console.log("[backfill] ─────────────────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
