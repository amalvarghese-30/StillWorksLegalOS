import mongoose from "mongoose";

/**
 * Connect to MongoDB with retry logic.
 * Mongoose 8+ handles buffering, but explicit retry gives better startup logs.
 */
export async function connectDB(uri: string, maxRetries = 5, retryDelayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        // Mongoose 8 defaults are fine; explicit for clarity
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      });
      console.log(`[db] Connected to MongoDB: ${mongoose.connection.host}`);
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

  // Connection event listeners
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[db] MongoDB reconnected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[db] MongoDB connection error:", err.message);
  });
}
