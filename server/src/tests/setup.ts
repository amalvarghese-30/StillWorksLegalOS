import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach } from "vitest";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Set JWT_SECRET before any imports that call getJwtSecret()
  process.env["JWT_SECRET"] = "test-secret-that-is-at-least-64-characters-long-for-vitest-runs-ok";
  process.env["NODE_ENV"] = "test";

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: "test_stillworks" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clear all collections between tests for isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
});
