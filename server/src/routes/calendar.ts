import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { Case } from "../models/Case.js";
import { HearingRecord, type HearingStatus } from "../models/HearingRecord.js";
import { parseFlexibleDate } from "../utils/dateParser.js";
import { Reminder } from "../models/Reminder.js";
import { syncCallReminders, deleteCallReminders } from "../services/reminders.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth, requireAdminOrPermission } from "../middleware/auth.js";
import { canAccessCalendarEvent, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";
import { withTransactionOrFallback } from "../utils/dbTransaction.js";

const router = Router();
router.use(requireAuth);
// All calendar operations require the calendar module permission.
// Admins bypass this check via requireAdminOrPermission.
router.use(requireAdminOrPermission("calendar"));

// ---------------------------------------------------------------------------
// Audit & Diff Helpers for Calendar Operations
// ---------------------------------------------------------------------------

function formatAuditDate(d: Date | string | null | undefined): string {
  if (!d) return "None";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return String(d);
  return dateObj.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

interface CalendarDiffResult {
  hasChanges: boolean;
  changedFields: string[];
  diffs: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  summary: string;
}

function computeCalendarEventDiff(
  existing: any,
  updates: Record<string, any>
): CalendarDiffResult {
  const changedFields: string[] = [];
  const diffs: string[] = [];
  const previousValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  // Title
  if (updates["title"] !== undefined && updates["title"] !== existing.title) {
    changedFields.push("title");
    previousValues["title"] = existing.title;
    newValues["title"] = updates["title"];
    diffs.push(`Title: "${existing.title}" → "${updates["title"]}"`);
  }

  // Description / Remarks
  const effectiveNewDesc = updates["description"] !== undefined ? updates["description"] : updates["remarks"];
  if (effectiveNewDesc !== undefined && effectiveNewDesc !== existing.description) {
    changedFields.push("description");
    previousValues["description"] = existing.description || "";
    newValues["description"] = effectiveNewDesc;
    diffs.push(`Description: "${existing.description || "None"}" → "${effectiveNewDesc}"`);
  }

  // Type
  if (updates["type"] !== undefined && updates["type"] !== existing.type) {
    changedFields.push("type");
    previousValues["type"] = existing.type;
    newValues["type"] = updates["type"];
    diffs.push(`Event type: ${existing.type} → ${updates["type"]}`);
  }

  // Start Date / Time
  if (updates["start"] !== undefined) {
    const oldStart = new Date(existing.start).getTime();
    const newStart = new Date(updates["start"]).getTime();
    if (Math.abs(oldStart - newStart) > 1000) {
      changedFields.push("start");
      previousValues["start"] = new Date(existing.start).toISOString();
      newValues["start"] = new Date(updates["start"]).toISOString();
      diffs.push(`Start date: ${formatAuditDate(existing.start)} → ${formatAuditDate(updates["start"])}`);
    }
  }

  // End Date / Time
  if (Object.prototype.hasOwnProperty.call(updates, "end")) {
    const oldEnd = existing.end ? new Date(existing.end).getTime() : null;
    const newEnd = updates["end"] ? new Date(updates["end"]).getTime() : null;
    if (oldEnd !== newEnd) {
      changedFields.push("end");
      previousValues["end"] = existing.end ? new Date(existing.end).toISOString() : null;
      newValues["end"] = updates["end"] ? new Date(updates["end"]).toISOString() : null;
      diffs.push(`End date: ${formatAuditDate(existing.end)} → ${formatAuditDate(updates["end"])}`);
    }
  }

  // All Day
  if (updates["allDay"] !== undefined && Boolean(updates["allDay"]) !== Boolean(existing.allDay)) {
    changedFields.push("allDay");
    previousValues["allDay"] = Boolean(existing.allDay);
    newValues["allDay"] = Boolean(updates["allDay"]);
    diffs.push(`All day: ${existing.allDay ? "Yes" : "No"} → ${updates["allDay"] ? "Yes" : "No"}`);
  }

  // Hearing Status / Outcome
  if (updates["hearingStatus"] !== undefined && updates["hearingStatus"] !== existing.hearingStatus) {
    changedFields.push("hearingStatus");
    previousValues["hearingStatus"] = existing.hearingStatus || "scheduled";
    newValues["hearingStatus"] = updates["hearingStatus"];
    diffs.push(`Hearing status: ${existing.hearingStatus || "scheduled"} → ${updates["hearingStatus"]}`);
  }

  // Color
  if (updates["color"] !== undefined && updates["color"] !== existing.color) {
    changedFields.push("color");
    previousValues["color"] = existing.color || "";
    newValues["color"] = updates["color"];
    diffs.push(`Color: ${existing.color || "default"} → ${updates["color"]}`);
  }

  // Case ID
  if (updates["caseId"] !== undefined && String(updates["caseId"] || "") !== String(existing.caseId || "")) {
    changedFields.push("caseId");
    previousValues["caseId"] = existing.caseId ? existing.caseId.toString() : null;
    newValues["caseId"] = updates["caseId"] ? String(updates["caseId"]) : null;
    diffs.push(`Linked case: ${existing.caseId || "None"} → ${updates["caseId"] || "None"}`);
  }

  // Client ID
  if (updates["clientId"] !== undefined && String(updates["clientId"] || "") !== String(existing.clientId || "")) {
    changedFields.push("clientId");
    previousValues["clientId"] = existing.clientId ? existing.clientId.toString() : null;
    newValues["clientId"] = updates["clientId"] ? String(updates["clientId"]) : null;
    diffs.push(`Linked client: ${existing.clientId || "None"} → ${updates["clientId"] || "None"}`);
  }

  // Assigned To
  if (updates["assignedTo"] !== undefined) {
    const oldIds = Array.isArray(existing.assignedTo) ? existing.assignedTo.map((id: any) => id.toString()).sort() : [];
    const newIds = (Array.isArray(updates["assignedTo"]) ? updates["assignedTo"] : [updates["assignedTo"]].filter(Boolean))
      .map((id: any) => id.toString())
      .sort();
    if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
      changedFields.push("assignedTo");
      previousValues["assignedTo"] = oldIds;
      newValues["assignedTo"] = newIds;
      diffs.push(`Assigned staff changed (${oldIds.length} → ${newIds.length} assigned)`);
    }
  }

  const summary = diffs.length > 0 ? diffs.join(" · ") : "No field values changed";
  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    diffs,
    previousValues,
    newValues,
    summary,
  };
}

// ---------------------------------------------------------------------------
// GET /api/calendar/events — list by date range, employee filter
// Shared Firm Calendar: Both Admin and Members view all firm calendar events
// ---------------------------------------------------------------------------

router.get("/events", async (req: Request, res: Response) => {
  try {
    const { start, end, employeeId, type, caseId } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Date range filter
    if (start) {
      filter["start"] = { $gte: new Date(start) };
    }
    if (end) {
      filter["start"] = { ...(filter["start"] as Record<string, unknown>), $lte: new Date(end) };
    }

    // If no range given and no caseId filter, default to current month
    if (!start && !end && !caseId) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      filter["start"] = { $gte: firstDay, $lte: lastDay };
    }

    // Employee filter: All authenticated users can filter by specific employee or view all
    if (employeeId && employeeId !== "all") {
      filter["assignedTo"] = employeeId;
    }

    if (caseId) {
      filter["caseId"] = caseId;
    }

    if (type && type !== "all") {
      filter["type"] = type;
    }

    const events = await CalendarEvent.find(filter)
      .sort({ start: 1 })
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .populate("caseId", "title number")
      .lean();

    res.json({ events });
  } catch (err) {
    console.error("[calendar] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/calendar/events/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findById(req.params["id"])
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .populate("caseId", "title number");
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json({ event });
  } catch (err) {
    console.error("[calendar] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/calendar/events — create
// ---------------------------------------------------------------------------

router.post("/events", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      remarks,
      type,
      start: startStr,
      end: endStr,
      allDay,
      caseId,
      clientId,
      assignedTo,
      color,
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Event title is required" });
      return;
    }
    if (!startStr) {
      res.status(400).json({ message: "Start date is required" });
      return;
    }
    const parsedStart = new Date(startStr);
    if (isNaN(parsedStart.getTime())) {
      res.status(400).json({ message: "Invalid start date format" });
      return;
    }
    let parsedEnd: Date | undefined = undefined;
    if (endStr) {
      parsedEnd = new Date(endStr);
      if (isNaN(parsedEnd.getTime())) {
        res.status(400).json({ message: "Invalid end date format" });
        return;
      }
    }

    // All authenticated users can assign to any employee (firm-wide calendar access)
    const rawAssigned = Array.isArray(assignedTo) ? assignedTo : [assignedTo].filter(Boolean);
    const finalAssignedTo = rawAssigned.length > 0 ? rawAssigned : [req.userId];

    const event = await CalendarEvent.create({
      title: title.trim(),
      description: description ?? remarks ?? "",
      type: type ?? "personal",
      start: parsedStart,
      end: parsedEnd,
      allDay: allDay ?? false,
      caseId: caseId ?? null,
      clientId: clientId ?? null,
      createdBy: req.userId,
      assignedTo: finalAssignedTo,
      color: color ?? "",
    });

    // Synchronize multi-user Reminder documents if event is a call_reminder
    if (event.type === "call_reminder") {
      const targetUserIds = event.assignedTo && event.assignedTo.length > 0 ? event.assignedTo : [event.createdBy || req.userId];
      try {
        await syncCallReminders({
          sourceType: "event",
          sourceId: event._id,
          userIds: targetUserIds,
          clientName: event.title.replace(/^📞\s*(CALL:\s*)?/i, "").trim() || event.title,
          phone: "",
          notes: event.description || "",
          scheduledAt: event.start,
          status: "scheduled",
        });
      } catch (remErr) {
        console.error("[calendar] Failed to create synchronized reminders:", remErr);
      }
    }

    const linkedCase = caseId ? await Case.findById(caseId).select("title number").lean() : null;
    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: event.title,
      details: `Created calendar event: ${event.title}`,
      metadata: {
        actorRole: req.user?.role === "admin" ? "Admin" : "Member",
        actionType: "CREATE",
        eventTitle: event.title,
        eventType: event.type,
        eventDate: event.start,
        caseId: event.caseId ? event.caseId.toString() : null,
        caseTitle: linkedCase?.title || null,
        caseNumber: linkedCase?.number || null,
        changedFields: ["title", "description", "type", "start", "allDay", "caseId", "assignedTo"],
        previousValues: {},
        newValues: {
          title: event.title,
          description: event.description,
          type: event.type,
          start: event.start,
          allDay: event.allDay,
          caseId: event.caseId ? event.caseId.toString() : null,
          assignedTo: event.assignedTo,
        },
        diffs: [`Created ${event.type} event "${event.title}" on ${formatAuditDate(event.start)}`],
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Notify assigned staff
    const io = req.app.get("io");
    if (finalAssignedTo && finalAssignedTo.length > 0) {
      const { NotificationService } = await import("../services/notifications.js");
      for (const staffId of finalAssignedTo) {
        if (staffId && staffId.toString() !== req.userId) {
          await NotificationService.createNotification({
            userId: staffId,
            type: "HEARING_REMINDER",
            title: event.type === "hearing" ? "⚖️ Hearing Scheduled" : "Event Scheduled",
            message: `${req.user?.name ?? "Admin"} scheduled ${event.title} on ${new Date(event.start).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
            relatedId: event._id,
            relatedModel: "CalendarEvent",
            actorId: new Types.ObjectId(req.userId),
          }, io);
        }
      }
    }

    res.status(201).json({ event });
  } catch (err: any) {
    console.error("[calendar] Create error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/calendar/events/:id — update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const existingEvent = await CalendarEvent.findById(req.params["id"]);
    if (!existingEvent) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const updates: Record<string, unknown> = {};

    const allowed = ["title", "description", "type", "allDay", "caseId", "clientId", "assignedTo", "color", "hearingStatus"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // Accept remarks as alias for description and field on hearing
    if (req.body["remarks"] !== undefined) {
      updates["remarks"] = req.body["remarks"];
      if (updates["description"] === undefined) {
        updates["description"] = req.body["remarks"];
      }
    }
    if (req.body["start"]) {
      const parsedStart = parseFlexibleDate(req.body["start"]);
      if (!parsedStart) {
        res.status(400).json({ message: "Invalid start date format" });
        return;
      }
      updates["start"] = parsedStart;
    }
    // Use property presence rather than truthiness so callers can clear an end date
    // by sending null or an empty string when rescheduling an event.
    if (Object.prototype.hasOwnProperty.call(req.body, "end")) {
      if (req.body["end"] === null || req.body["end"] === "") {
        updates["end"] = null;
      } else {
        const parsedEnd = parseFlexibleDate(req.body["end"]);
        if (!parsedEnd) {
          res.status(400).json({ message: "Invalid end date format" });
          return;
        }
        updates["end"] = parsedEnd;
      }
    }

    // Calendar-to-case synchronization for hearings
    if (existingEvent.type === "hearing" && existingEvent.caseId) {
      const linkedCase = await Case.findById(existingEvent.caseId);
      if (linkedCase) {
        const oldStart = existingEvent.start;
        const newStart = updates["start"] as Date | undefined;

        // Check if event was canonical next hearing
        const isCanonical =
          existingEvent.isNextHearing === true ||
          (linkedCase.nextHearing && Math.abs(linkedCase.nextHearing.getTime() - oldStart.getTime()) <= 60000);

        if (newStart && Math.abs(oldStart.getTime() - newStart.getTime()) > 60000 && isCanonical) {
          // CANONICAL HEARING RESCHEDULE:
          // 1. Keep original event on original date (oldStart)
          // 2. Mark original event non-canonical: isNextHearing = false, hearingStatus = "rescheduled"
          // 3. Save HearingRecord for oldStart
          // 4. Update Case.nextHearing = newStart
          // 5. Create or promote separate upcoming event for newStart with isNextHearing = true

          let finalNewEvent: any = null;
          let finalOldEvent: any = null;

          await withTransactionOrFallback(async (session) => {
            // Update Case
            linkedCase.nextHearing = newStart;
            linkedCase.timeline.push({
              event: `Next hearing rescheduled to ${newStart.toLocaleDateString("en-IN")}`,
              by: req.user?.name ?? "Unknown",
              when: new Date(),
            });
            await linkedCase.save({ session: session || undefined });

            // Preserve original event on oldStart
            existingEvent.isNextHearing = false;
            if (existingEvent.hearingStatus !== "held") {
              existingEvent.hearingStatus = "rescheduled";
            }
            if (typeof req.body["remarks"] === "string" && req.body["remarks"].trim()) {
              existingEvent.remarks = req.body["remarks"].trim();
            }
            await existingEvent.save({ session: session || undefined });
            finalOldEvent = existingEvent;

            // Save HearingRecord (update if existing for this date, or create new)
            let existingRecord = await HearingRecord.findOne({
              caseId: linkedCase._id,
              hearingDate: oldStart,
            }).session(session);

            if (existingRecord) {
              existingRecord.status = existingEvent.hearingStatus;
              if (typeof req.body["remarks"] === "string" && req.body["remarks"].trim()) {
                existingRecord.remarks = req.body["remarks"].trim();
              }
              existingRecord.nextHearingDate = newStart;
              existingRecord.recordedBy = new Types.ObjectId(req.userId!);
              existingRecord.calendarEventId = existingEvent._id;
              await existingRecord.save({ session: session || undefined });
            } else {
              const hist = (
                await HearingRecord.create(
                  [
                    {
                      caseId: linkedCase._id,
                      hearingDate: oldStart,
                      status: existingEvent.hearingStatus,
                      remarks: (typeof req.body["remarks"] === "string" ? req.body["remarks"].trim() : "") || "Rescheduled via Calendar edit",
                      nextHearingDate: newStart,
                      recordedBy: new Types.ObjectId(req.userId!),
                      calendarEventId: existingEvent._id,
                    },
                  ],
                  { session: session || undefined },
                )
              )[0];
              existingEvent.hearingRecordId = hist._id as Types.ObjectId;
              await existingEvent.save({ session: session || undefined });
            }

            // Demote other canonical events for this case
            await CalendarEvent.updateMany(
              { caseId: linkedCase._id, type: "hearing", isNextHearing: true },
              { $set: { isNextHearing: false } },
              { session: session || undefined },
            );

            // Check if an upcoming event for newStart already exists
            const existingNext = await CalendarEvent.findOne({
              caseId: linkedCase._id,
              type: "hearing",
              start: newStart,
            }).session(session);

            if (existingNext) {
              if (typeof updates["title"] === "string") existingNext.title = updates["title"];
              if (typeof updates["description"] === "string") existingNext.description = updates["description"];
              existingNext.isNextHearing = true;
              existingNext.hearingStatus = "scheduled";
              if (Array.isArray(updates["assignedTo"])) existingNext.assignedTo = updates["assignedTo"] as any;
              await existingNext.save({ session: session || undefined });
              finalNewEvent = existingNext;
            } else {
              try {
                finalNewEvent = (
                  await CalendarEvent.create(
                    [
                      {
                        title: (updates["title"] as string) || existingEvent.title,
                        description: typeof updates["description"] === "string" ? updates["description"] : existingEvent.description,
                        type: "hearing",
                        start: newStart,
                        end: (updates["end"] as Date) || newStart,
                        allDay: typeof updates["allDay"] === "boolean" ? updates["allDay"] : existingEvent.allDay,
                        caseId: linkedCase._id,
                        clientId: existingEvent.clientId || null,
                        createdBy: new Types.ObjectId(req.userId!),
                        assignedTo: (updates["assignedTo"] as Types.ObjectId[]) || existingEvent.assignedTo,
                        color: (updates["color"] as string) || existingEvent.color || "#7C3AED",
                        isNextHearing: true,
                        hearingStatus: "scheduled",
                      },
                    ],
                    { session: session || undefined },
                  )
                )[0];
              } catch (createErr: any) {
                if (createErr.code === 11000) {
                  const concurrentlyCreated = await CalendarEvent.findOne({
                    caseId: linkedCase._id,
                    type: "hearing",
                    isNextHearing: true,
                  }).session(session);
                  if (concurrentlyCreated) {
                    if (Math.abs(new Date(concurrentlyCreated.start).getTime() - newStart.getTime()) <= 60000) {
                      if (typeof updates["title"] === "string") concurrentlyCreated.title = updates["title"];
                      await concurrentlyCreated.save({ session: session || undefined });
                      finalNewEvent = concurrentlyCreated;
                    } else {
                      concurrentlyCreated.isNextHearing = false;
                      await concurrentlyCreated.save({ session: session || undefined });
                      finalNewEvent = (
                        await CalendarEvent.create(
                          [
                            {
                              title: (updates["title"] as string) || existingEvent.title,
                              description: typeof updates["description"] === "string" ? updates["description"] : existingEvent.description,
                              type: "hearing",
                              start: newStart,
                              end: (updates["end"] as Date) || newStart,
                              allDay: typeof updates["allDay"] === "boolean" ? updates["allDay"] : existingEvent.allDay,
                              caseId: linkedCase._id,
                              clientId: existingEvent.clientId || null,
                              createdBy: new Types.ObjectId(req.userId!),
                              assignedTo: (updates["assignedTo"] as Types.ObjectId[]) || existingEvent.assignedTo,
                              color: (updates["color"] as string) || existingEvent.color || "#7C3AED",
                              isNextHearing: true,
                              hearingStatus: "scheduled",
                            },
                          ],
                          { session: session || undefined },
                        )
                      )[0];
                    }
                  } else {
                    throw createErr;
                  }
                } else {
                  throw createErr;
                }
              }
            }
          });

          // Post-transaction emissions
          const io = req.app.get("io");
          if (io) {
            io.emit("calendar:event:updated", {
              eventId: finalOldEvent._id.toString(),
              caseId: linkedCase._id.toString(),
              isNextHearing: false,
            });
            io.emit("calendar:event:created", {
              eventId: finalNewEvent._id.toString(),
              caseId: linkedCase._id.toString(),
              start: newStart.toISOString(),
              isNextHearing: true,
            });
            io.emit("case:updated", {
              caseId: linkedCase._id.toString(),
              number: linkedCase.number,
              title: linkedCase.title,
              nextHearing: newStart.toISOString(),
            });
          }

          const oldStartDateStr = formatAuditDate(oldStart);
          const newStartDateStr = formatAuditDate(newStart);
          const rescheduleDiffs: string[] = [
            `Hearing rescheduled from ${oldStartDateStr} to ${newStartDateStr}`,
          ];
          const rescheduleChangedFields = ["start", "hearingStatus"];
          const reschedulePrevValues: Record<string, unknown> = {
            start: oldStart,
            hearingStatus: existingEvent.hearingStatus,
          };
          const rescheduleNewValues: Record<string, unknown> = {
            start: newStart,
            hearingStatus: "scheduled",
          };
          if (typeof req.body["remarks"] === "string" && req.body["remarks"].trim()) {
            rescheduleChangedFields.push("remarks");
            reschedulePrevValues["remarks"] = existingEvent.remarks || "";
            rescheduleNewValues["remarks"] = req.body["remarks"].trim();
            rescheduleDiffs.push(`Remarks: "${reschedulePrevValues["remarks"]}" → "${rescheduleNewValues["remarks"]}"`);
          }
          if (updates["title"] && updates["title"] !== existingEvent.title) {
            rescheduleChangedFields.push("title");
            reschedulePrevValues["title"] = existingEvent.title;
            rescheduleNewValues["title"] = updates["title"];
            rescheduleDiffs.push(`Title: "${existingEvent.title}" → "${updates["title"]}"`);
          }

          await AuditLog.create({
            userId: req.userId,
            userName: req.user?.name ?? "Unknown",
            action: "reschedule",
            resource: "calendar",
            resourceId: finalNewEvent._id.toString(),
            resourceName: finalNewEvent.title,
            details: `Hearing rescheduled from ${oldStartDateStr} to ${newStartDateStr}${linkedCase ? ` for matter ${linkedCase.number || linkedCase.title}` : ""}`,
            metadata: {
              actorRole: req.user?.role === "admin" ? "Admin" : "Member",
              actionType: "RESCHEDULE",
              isRescheduled: true,
              eventTitle: finalNewEvent.title,
              eventType: "hearing",
              eventDate: newStart,
              previousEventDate: oldStart,
              caseId: linkedCase._id.toString(),
              caseTitle: linkedCase.title,
              caseNumber: linkedCase.number,
              changedFields: rescheduleChangedFields,
              previousValues: reschedulePrevValues,
              newValues: rescheduleNewValues,
              diffs: rescheduleDiffs,
            },
            ip: req.ip,
            userAgent: req.headers["user-agent"],
          });

          res.json({ event: finalNewEvent, originalEvent: finalOldEvent });
          return;
        } else if (updates["type"] !== undefined && updates["type"] !== "hearing" && isCanonical) {
          updates["isNextHearing"] = false;
          const nextHearingEvent = await CalendarEvent.findOne({
            caseId: existingEvent.caseId,
            type: "hearing",
            _id: { $ne: existingEvent._id },
            start: { $gte: new Date() },
          }).sort({ start: 1 });

          linkedCase.nextHearing = nextHearingEvent ? nextHearingEvent.start : null;
          await linkedCase.save();

          if (nextHearingEvent) {
            nextHearingEvent.isNextHearing = true;
            await nextHearingEvent.save();
          }

          const io = req.app.get("io");
          if (io) {
            io.emit("case:updated", {
              caseId: linkedCase._id.toString(),
              number: linkedCase.number,
              title: linkedCase.title,
              nextHearing: linkedCase.nextHearing ? linkedCase.nextHearing.toISOString() : null,
            });
          }
        }
      }
    }

    const diffResult = computeCalendarEventDiff(existingEvent, updates);

    const event = await CalendarEvent.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // Synchronize multi-user Reminder documents if event is or was a call_reminder
    if (event.type === "call_reminder") {
      const targetUserIds = event.assignedTo && event.assignedTo.length > 0 ? event.assignedTo : [event.createdBy || req.userId];
      try {
        await syncCallReminders({
          sourceType: "event",
          sourceId: event._id,
          userIds: targetUserIds,
          clientName: event.title.replace(/^📞\s*(CALL:\s*)?/i, "").trim() || event.title,
          phone: "",
          notes: event.description || "",
          scheduledAt: event.start,
          status: "scheduled",
        });
      } catch (remErr) {
        console.error("[calendar] Failed to update synchronized reminders:", remErr);
      }
    } else if (updates["type"] !== undefined) {
      try {
        await deleteCallReminders("event", event._id);
      } catch (remErr) {
        console.error("[calendar] Failed to delete reminders when event type changed:", remErr);
      }
    }

    const linkedCase = event.caseId ? await Case.findById(event.caseId).select("title number").lean() : null;
    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: event.title,
      details: diffResult.summary || `Updated calendar event ${event.title}`,
      metadata: {
        actorRole: req.user?.role === "admin" ? "Admin" : "Member",
        actionType: "UPDATE",
        eventTitle: event.title,
        eventType: event.type,
        eventDate: event.start,
        caseId: event.caseId ? event.caseId.toString() : null,
        caseTitle: linkedCase?.title || null,
        caseNumber: linkedCase?.number || null,
        changedFields: diffResult.changedFields,
        previousValues: diffResult.previousValues,
        newValues: diffResult.newValues,
        diffs: diffResult.diffs,
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("calendar:event:updated", {
        eventId: event._id.toString(),
        caseId: event.caseId ? event.caseId.toString() : undefined,
      });
    }

    res.json({ event });
  } catch (err) {
    console.error("[calendar] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/calendar/events/:id/record-hearing — dedicated Record Hearing & Add Next Date
// ---------------------------------------------------------------------------

router.post("/events/:id/record-hearing", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findById(req.params["id"]);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.type !== "hearing" || !event.caseId) {
      res.status(400).json({ message: "Event is not a court hearing linked to a case" });
      return;
    }

    const caseRecord = await Case.findById(event.caseId);
    if (!caseRecord) {
      res.status(404).json({ message: "Linked case not found" });
      return;
    }

    const ALLOWED_HEARING_STATUSES = ["held", "rescheduled", "cancelled", "scheduled"];
    if (req.body.status !== undefined && !ALLOWED_HEARING_STATUSES.includes(req.body.status)) {
      res.status(400).json({ message: "Invalid hearing status value" });
      return;
    }
    const status: HearingStatus = (req.body.status as HearingStatus) || "held";
    const remarks = typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

    let parsedNextHearing: Date | null = null;
    if (
      Object.prototype.hasOwnProperty.call(req.body, "nextHearingDate") &&
      req.body.nextHearingDate !== undefined &&
      req.body.nextHearingDate !== null &&
      req.body.nextHearingDate !== ""
    ) {
      parsedNextHearing = parseFlexibleDate(req.body.nextHearingDate);
      if (!parsedNextHearing) {
        res.status(400).json({ message: "Invalid next hearing date format" });
        return;
      }
    }

    let hearingDate = event.start;
    if (
      Object.prototype.hasOwnProperty.call(req.body, "hearingDate") &&
      req.body.hearingDate !== undefined
    ) {
      const parsedHearingDate = parseFlexibleDate(req.body.hearingDate);
      if (!parsedHearingDate) {
        res.status(400).json({ message: "Invalid hearing date format" });
        return;
      }
      hearingDate = parsedHearingDate;
    }

    // 1. Transactional / safe sequence execution
    let historyRecord: any = null;
    let nextEvent: any = null;

    await withTransactionOrFallback(async (session) => {
      // Find existing HearingRecord or create new
      historyRecord = await HearingRecord.findOne({
        caseId: caseRecord._id,
        hearingDate,
      }).session(session);

      if (historyRecord) {
        historyRecord.status = status;
        historyRecord.remarks = remarks;
        historyRecord.nextHearingDate = parsedNextHearing;
        historyRecord.recordedBy = new Types.ObjectId(req.userId!);
        historyRecord.calendarEventId = event._id as Types.ObjectId;
        await historyRecord.save({ session: session || undefined });
      } else {
        historyRecord = (
          await HearingRecord.create(
            [
              {
                caseId: caseRecord._id,
                hearingDate,
                status,
                remarks,
                nextHearingDate: parsedNextHearing,
                recordedBy: new Types.ObjectId(req.userId!),
                calendarEventId: event._id as Types.ObjectId,
              },
            ],
            { session: session || undefined },
          )
        )[0];
      }

      // 2. Preserve original calendar entry
      event.isNextHearing = false;
      event.hearingStatus = status;
      event.remarks = remarks;
      if (remarks && !event.description.includes(remarks)) {
        event.description = event.description
          ? `${event.description}\n\nOutcome / Remarks: ${remarks}`
          : `Outcome / Remarks: ${remarks}`;
      }
      event.hearingRecordId = historyRecord._id as Types.ObjectId;
      await event.save({ session: session || undefined });

      // 3. Demote other canonical events for this case
      await CalendarEvent.updateMany(
        { caseId: caseRecord._id, type: "hearing", isNextHearing: true },
        { $set: { isNextHearing: false } },
        { session: session || undefined },
      );

      // 4. If nextHearingDate provided, create separate upcoming event
      if (parsedNextHearing) {
        const eventTitle = `Hearing: ${caseRecord.number || "Case"} — ${caseRecord.title}`;
        const eventDesc = `Court hearing for matter ${caseRecord.number || ""}. Court: ${caseRecord.court || "Court"}${caseRecord.judge ? `, Judge: ${caseRecord.judge}` : ""}.`;

        // Resolve primary client party
        const primaryParty = (caseRecord.parties || []).find(
          (p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId,
        );
        const clientId = primaryParty?.clientId ? ((primaryParty.clientId as any)._id ?? primaryParty.clientId) : null;

        // Check if an event for this exact date already exists (e.g. on retry / repeated submission)
        const existingNext = await CalendarEvent.findOne({
          caseId: caseRecord._id,
          type: "hearing",
          start: parsedNextHearing,
        }).session(session);

        if (existingNext) {
          existingNext.title = eventTitle;
          existingNext.description = eventDesc;
          existingNext.isNextHearing = true;
          existingNext.hearingStatus = "scheduled";
          existingNext.assignedTo =
            event.assignedTo && event.assignedTo.length > 0
              ? event.assignedTo
              : [new Types.ObjectId(req.userId!)];
          if (clientId) existingNext.clientId = clientId;
          await existingNext.save({ session: session || undefined });
          nextEvent = existingNext;
        } else {
          try {
            nextEvent = (
              await CalendarEvent.create(
                [
                  {
                    title: eventTitle,
                    description: eventDesc,
                    type: "hearing",
                    start: parsedNextHearing,
                    end: parsedNextHearing,
                    allDay: false,
                    caseId: caseRecord._id,
                    clientId: clientId || null,
                    createdBy: new Types.ObjectId(req.userId!),
                    assignedTo:
                      event.assignedTo && event.assignedTo.length > 0
                        ? event.assignedTo
                        : [new Types.ObjectId(req.userId!)],
                    color: "#7C3AED",
                    isNextHearing: true,
                    hearingStatus: "scheduled",
                  },
                ],
                { session: session || undefined },
              )
            )[0];
          } catch (createErr: any) {
            if (createErr.code === 11000) {
              const concurrentlyCreated = await CalendarEvent.findOne({
                caseId: caseRecord._id,
                type: "hearing",
                isNextHearing: true,
              }).session(session);

              if (concurrentlyCreated) {
                if (Math.abs(new Date(concurrentlyCreated.start).getTime() - parsedNextHearing.getTime()) <= 60000) {
                  concurrentlyCreated.title = eventTitle;
                  concurrentlyCreated.description = eventDesc;
                  if (clientId) concurrentlyCreated.clientId = clientId;
                  await concurrentlyCreated.save({ session: session || undefined });
                  nextEvent = concurrentlyCreated;
                } else {
                  concurrentlyCreated.isNextHearing = false;
                  await concurrentlyCreated.save({ session: session || undefined });
                  nextEvent = (
                    await CalendarEvent.create(
                      [
                        {
                          title: eventTitle,
                          description: eventDesc,
                          type: "hearing",
                          start: parsedNextHearing,
                          end: parsedNextHearing,
                          allDay: false,
                          caseId: caseRecord._id,
                          clientId: clientId || null,
                          createdBy: new Types.ObjectId(req.userId!),
                          assignedTo:
                            event.assignedTo && event.assignedTo.length > 0
                              ? event.assignedTo
                              : [new Types.ObjectId(req.userId!)],
                          color: "#7C3AED",
                          isNextHearing: true,
                          hearingStatus: "scheduled",
                        },
                      ],
                      { session: session || undefined },
                    )
                  )[0];
                }
              } else {
                throw createErr;
              }
            } else {
              throw createErr;
            }
          }
        }

        caseRecord.nextHearing = parsedNextHearing;
        caseRecord.timeline.push({
          event: `Hearing ${status} on ${hearingDate.toLocaleDateString("en-IN")}. Next hearing set to ${parsedNextHearing.toLocaleDateString("en-IN")}${remarks ? `: ${remarks}` : ""}`,
          by: req.user?.name ?? "Unknown",
          when: new Date(),
        });
        await caseRecord.save({ session: session || undefined });
      } else {
        caseRecord.nextHearing = null;
        caseRecord.timeline.push({
          event: `Hearing ${status} on ${hearingDate.toLocaleDateString("en-IN")}${remarks ? `: ${remarks}` : ""}`,
          by: req.user?.name ?? "Unknown",
          when: new Date(),
        });
        await caseRecord.save({ session: session || undefined });
      }
    });

    const recordDiffs: string[] = [
      `Hearing outcome recorded as "${status}" for ${formatAuditDate(hearingDate)}`,
    ];
    if (remarks) {
      recordDiffs.push(`Remarks / work done: "${remarks}"`);
    }
    if (parsedNextHearing) {
      recordDiffs.push(`Next hearing date scheduled: ${formatAuditDate(parsedNextHearing)}`);
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: parsedNextHearing ? "reschedule" : "update",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: `Hearing recorded: ${caseRecord.number || caseRecord.title}`,
      details: recordDiffs.join(" · "),
      metadata: {
        actorRole: req.user?.role === "admin" ? "Admin" : "Member",
        actionType: "RECORD_HEARING",
        isRescheduled: Boolean(parsedNextHearing),
        eventTitle: event.title,
        eventType: "hearing",
        eventDate: hearingDate,
        nextHearingDate: parsedNextHearing,
        caseId: caseRecord._id.toString(),
        caseTitle: caseRecord.title,
        caseNumber: caseRecord.number,
        changedFields: ["hearingStatus", "remarks", ...(parsedNextHearing ? ["nextHearingDate"] : [])],
        previousValues: {
          hearingStatus: event.hearingStatus,
          remarks: event.remarks || "",
          nextHearingDate: caseRecord.nextHearing,
        },
        newValues: {
          hearingStatus: status,
          remarks,
          nextHearingDate: parsedNextHearing,
        },
        diffs: recordDiffs,
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("calendar:event:updated", {
        eventId: event._id.toString(),
        caseId: caseRecord._id.toString(),
        isNextHearing: false,
      });
      if (nextEvent) {
        io.emit("calendar:event:created", {
          eventId: nextEvent._id.toString(),
          caseId: caseRecord._id.toString(),
          start: parsedNextHearing!.toISOString(),
          isNextHearing: true,
        });
      }
      io.emit("case:updated", {
        caseId: caseRecord._id.toString(),
        number: caseRecord.number,
        title: caseRecord.title,
        nextHearing: caseRecord.nextHearing ? caseRecord.nextHearing.toISOString() : null,
      });
    }

    res.status(200).json({
      success: true,
      hearingRecord: historyRecord,
      currentEvent: event,
      nextEvent,
      case: caseRecord,
    });
  } catch (err: any) {
    console.error("[calendar] Record hearing error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/calendar/events/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const existing = await CalendarEvent.findById(req.params["id"]);
    if (!existing) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const linkedCase = existing.caseId ? await Case.findById(existing.caseId).select("title number").lean() : null;

    // Phase 5 rule: For a case-linked hearing event, ordinary removal / cancelling
    // must NOT silently hard-delete the historical calendar entry!
    if (existing.type === "hearing" && existing.caseId) {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "delete",
        resource: "calendar",
        resourceId: existing._id.toString(),
        resourceName: existing.title,
        details: `Hearing cancelled: ${existing.title} (${formatAuditDate(existing.start)})`,
        metadata: {
          actorRole: req.user?.role === "admin" ? "Admin" : "Member",
          actionType: "DELETE",
          eventTitle: existing.title,
          eventType: existing.type,
          eventDate: existing.start,
          caseId: existing.caseId.toString(),
          caseTitle: linkedCase?.title || null,
          caseNumber: linkedCase?.number || null,
          changedFields: ["hearingStatus", "remarks"],
          previousValues: {
            hearingStatus: existing.hearingStatus,
            remarks: existing.remarks || "",
            start: existing.start,
          },
          newValues: {
            hearingStatus: "cancelled",
            remarks: "Hearing cancelled",
          },
          diffs: [`Hearing "${existing.title}" on ${formatAuditDate(existing.start)} cancelled and preserved in history`],
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      existing.isNextHearing = false;
      existing.hearingStatus = "cancelled";
      if (!existing.remarks || !existing.remarks.includes("cancelled")) {
        existing.remarks = existing.remarks ? `${existing.remarks} (Hearing cancelled)` : "Hearing cancelled";
      }
      await existing.save();

      // Record cancellation in hearing history
      const existingHistory = await HearingRecord.findOne({
        caseId: existing.caseId,
        hearingDate: existing.start,
      });
      if (!existingHistory) {
        await HearingRecord.create({
          caseId: existing.caseId,
          hearingDate: existing.start,
          status: "cancelled",
          remarks: "Hearing cancelled via Calendar",
          recordedBy: new Types.ObjectId(req.userId!),
          calendarEventId: existing._id,
        });
      } else {
        existingHistory.status = "cancelled";
        await existingHistory.save();
      }

      // If it was the canonical next hearing, promote the next upcoming future hearing or null
      const nextUpcomingHearing = await CalendarEvent.findOne({
        caseId: existing.caseId,
        type: "hearing",
        _id: { $ne: existing._id },
        start: { $gte: new Date() },
        hearingStatus: { $ne: "cancelled" },
      }).sort({ start: 1 });

      const linkedCaseDoc = await Case.findById(existing.caseId);
      if (linkedCaseDoc) {
        linkedCaseDoc.nextHearing = nextUpcomingHearing ? nextUpcomingHearing.start : null;
        await linkedCaseDoc.save();
        if (nextUpcomingHearing) {
          nextUpcomingHearing.isNextHearing = true;
          await nextUpcomingHearing.save();
        }
        const io = req.app.get("io");
        if (io) {
          io.emit("case:updated", {
            caseId: linkedCaseDoc._id.toString(),
            number: linkedCaseDoc.number,
            title: linkedCaseDoc.title,
            nextHearing: linkedCaseDoc.nextHearing ? linkedCaseDoc.nextHearing.toISOString() : null,
          });
        }
      }

      const io = req.app.get("io");
      if (io) {
        io.emit("calendar:event:updated", {
          eventId: existing._id.toString(),
          caseId: existing.caseId.toString(),
          isNextHearing: false,
          hearingStatus: "cancelled",
        });
      }

      res.json({ message: "Hearing cancelled and preserved in history", event: existing });
      return;
    }

    // Permanent delete: Log BEFORE deletion
    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "calendar",
      resourceId: existing._id.toString(),
      resourceName: existing.title,
      details: `Permanently deleted calendar event "${existing.title}"`,
      metadata: {
        actorRole: req.user?.role === "admin" ? "Admin" : "Member",
        actionType: "DELETE",
        eventTitle: existing.title,
        eventType: existing.type,
        eventDate: existing.start,
        caseId: existing.caseId ? existing.caseId.toString() : null,
        caseTitle: linkedCase?.title || null,
        caseNumber: linkedCase?.number || null,
        changedFields: ["deleted"],
        previousValues: {
          title: existing.title,
          type: existing.type,
          start: existing.start,
          end: existing.end,
          assignedTo: existing.assignedTo,
          caseId: existing.caseId ? existing.caseId.toString() : null,
        },
        newValues: {},
        diffs: [`Permanently deleted event "${existing.title}" scheduled for ${formatAuditDate(existing.start)}`],
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const event = await CalendarEvent.findByIdAndDelete(req.params["id"]);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // If canonical next hearing was deleted, update case nextHearing
    if (event.type === "hearing" && event.caseId && event.isNextHearing) {
      const nextUpcomingHearing = await CalendarEvent.findOne({
        caseId: event.caseId,
        type: "hearing",
        _id: { $ne: event._id },
        start: { $gte: new Date() },
      }).sort({ start: 1 });

      const linkedCase = await Case.findById(event.caseId);
      if (linkedCase) {
        linkedCase.nextHearing = nextUpcomingHearing ? nextUpcomingHearing.start : null;
        await linkedCase.save();
        if (nextUpcomingHearing) {
          nextUpcomingHearing.isNextHearing = true;
          await nextUpcomingHearing.save();
        }
        const io = req.app.get("io");
        if (io) {
          io.emit("case:updated", {
            caseId: linkedCase._id.toString(),
            number: linkedCase.number,
            title: linkedCase.title,
            nextHearing: linkedCase.nextHearing ? linkedCase.nextHearing.toISOString() : null,
          });
        }
      }
    }

    // Clean up associated reminders atomically
    try {
      await deleteCallReminders("event", event._id);
    } catch (remErr) {
      console.error("[calendar] Failed to delete synchronized reminders on event delete:", remErr);
    }

    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("[calendar] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;