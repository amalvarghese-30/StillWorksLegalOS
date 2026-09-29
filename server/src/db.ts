import mongoose from "mongoose";

let listenersAttached = false;

/**
 * Connect to MongoDB with retry logic.
 * Mongoose 8+ handles buffering, but explicit retry gives better startup logs.
 */
export async function connectDB(uri: string, maxRetries = 5, retryDelayMs = 3000): Promise<void> {
  const dbName = process.env["MONGODB_DB_NAME"] || "stillworks_legalos";

  // Register connection event listeners once
  if (!listenersAttached) {
    mongoose.connection.on("disconnected", () => {
      console.warn("[db] MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[db] MongoDB reconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("[db] MongoDB connection error:", err.message);
    });

    listenersAttached = true;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      });
      console.log(`[db] Connected to MongoDB database: ${mongoose.connection.name} on host: ${mongoose.connection.host}`);

      // Initialize atomic counters from existing data.
      // This is idempotent: initSequence only raises the counter, never lowers it.
      // Must run AFTER connection is established but BEFORE any writes.
      await initCounters();
      return;
    } catch (err) {
      console.error(`[db] Connection attempt ${attempt}/${maxRetries} failed:`, (err as Error).message);
      if (attempt === maxRetries) {
        console.error("[db] All connection attempts exhausted. Exiting.");
        throw err;
      }
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
}

// ---------------------------------------------------------------------------
// initCounters — seed atomic counters from existing data.
// Called once at startup. Ensures the Counter collection always reflects the
// true current maximum, so new records never collide with existing ones.
// ---------------------------------------------------------------------------
async function initCounters(): Promise<void> {
  try {
    const { initSequence } = await import("./models/Counter.js");
    const { Case } = await import("./models/Case.js");
    const { AuditLog } = await import("./models/AuditLog.js");

    // Seed case-number counter from existing max for the current year
    const year = new Date().getFullYear();
    const counterKey = `case-number-${year}`;
    const prefix = `SW-${year}-`;

    const existingCases = await Case.find(
      { number: { $regex: `^${prefix}` } },
      { number: 1 }
    ).lean();

    let maxCaseSeq = 0;
    for (const c of existingCases) {
      if (c.number && c.number.startsWith(prefix)) {
        const numPart = parseInt(c.number.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxCaseSeq) maxCaseSeq = numPart;
      }
    }

    await initSequence(counterKey, maxCaseSeq);
    console.log(`[db] Case counter initialized: ${counterKey} = ${maxCaseSeq}`);

    // Seed audit-log-sequence counter from existing max
    const lastAuditLog = await AuditLog.findOne().sort({ sequence: -1 }).select("sequence").lean();
    const maxAuditSeq = lastAuditLog?.sequence ?? 0;
    await initSequence("audit-log-sequence", maxAuditSeq);
    console.log(`[db] Audit log counter initialized: audit-log-sequence = ${maxAuditSeq}`);
  } catch (err) {
    // Non-fatal: log and continue. Counter failures will be caught at write time.
    console.error("[db] Counter initialization error:", (err as Error).message);
  }
}
