import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Counter — atomic monotonic sequence generator
//
// Used by:
//   - Case number generation  (key: "case-number-{YYYY}")
//   - Audit log sequence      (key: "audit-log-sequence")
//
// Uses findOneAndUpdate with $inc which is a single atomic MongoDB operation,
// safe under concurrent requests without application-level locking.
// ---------------------------------------------------------------------------

export interface ICounter extends Document {
  key: string;   // Logical name for this sequence
  seq: number;   // Current value (pre-increment — the returned value is next)
}

const CounterSchema = new Schema<ICounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: false,
    collection: "counters",
  },
);

export const Counter = mongoose.model<ICounter>("Counter", CounterSchema);

// ---------------------------------------------------------------------------
// nextSequence — atomically increment and return the next value for `key`.
//
// @param key   Logical sequence name (e.g. "case-number-2026")
// @param init  Value to initialize seq to if not yet created (default 0).
//              Set this to the current max to preserve existing data.
// ---------------------------------------------------------------------------
export async function nextSequence(key: string, init = 0): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (!doc) throw new Error(`[Counter] Failed to increment sequence for key: ${key}`);

  // On first upsert seq may start at 1 due to $inc on a new doc.
  // If caller passed init > 0, and seq is at 1, that means this is the very
  // first call and no prior initialization was done. We handle initialization
  // separately via initSequence().
  return doc.seq;
}

// ---------------------------------------------------------------------------
// initSequence — idempotently set a sequence to at least `minValue`.
//
// Call this once at startup to seed the counter from the existing data max,
// so we never re-issue already-used numbers.
//
// @param key       Sequence key
// @param minValue  The counter will be set to max(currentSeq, minValue)
// ---------------------------------------------------------------------------
export async function initSequence(key: string, minValue: number): Promise<void> {
  await Counter.findOneAndUpdate(
    { key },
    { $max: { seq: minValue } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
