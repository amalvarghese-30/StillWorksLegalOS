import mongoose, { ClientSession } from "mongoose";

/**
 * Checks if the underlying MongoDB connection supports multi-document transactions.
 * Transactions require a ReplicaSet or Sharded topology (mongos).
 * Standalone MongoDB servers (topology type "Single") throw
 * "Transaction numbers are only allowed on a replica set member or mongos".
 */
export function isTransactionSupported(): boolean {
  try {
    const topologyType = (mongoose.connection as any)?.client?.topology?.description?.type;
    return topologyType === "ReplicaSetWithPrimary" || topologyType === "Sharded";
  } catch {
    return false;
  }
}

/**
 * Executes a callback within a MongoDB transaction if replica set/sharded cluster
 * topology supports transactions. If running on standalone MongoDB where transactions
 * are unsupported, gracefully falls back to executing without a transaction
 * using safe, idempotent operation ordering.
 */
export async function withTransactionOrFallback<T>(
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  if (!isTransactionSupported()) {
    return await fn(null);
  }

  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
  } catch {
    return await fn(null);
  }

  try {
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (txnErr: any) {
      await session.abortTransaction();
      // If error indicates standalone topology despite topology check, fall back to non-transactional
      if (
        typeof txnErr?.message === "string" &&
        (txnErr.message.includes("Transaction numbers are only allowed") ||
          txnErr.message.includes("replica set"))
      ) {
        return await fn(null);
      }
      throw txnErr;
    }
  } finally {
    await session.endSession();
  }
}
