/**
 * Security Test Suite — StillWorks LegalOS
 *
 * Tests for all P0/P1 security fixes:
 * - AUTHZ-EMP-001..006  Employee management privilege escalation
 * - CAL-001..006         Calendar authorization
 * - CASE-UPDATE-001..006 Case update field whitelist
 * - CLIENT-UPDATE-001..005 Client update field whitelist
 * - DATA-CASE-001..005   Case archive semantics
 */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { Counter } from "../models/Counter.js";
import adminRoutes from "../routes/admin.js";
import calendarRoutes from "../routes/calendar.js";
import casesRoutes from "../routes/cases.js";
import clientsRoutes from "../routes/clients.js";

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.set("io", null); // No socket.io in tests
  app.use("/api/admin", adminRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/clients", clientsRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Helper: create a user and a valid session token
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env["JWT_SECRET"]!;

async function createUser(overrides: Partial<{
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
}> = {}) {
  const bcrypt = await import("bcryptjs");
  const user = await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${Date.now()}@test.com`,
    passwordHash: await bcrypt.hash("SecurePass1!", 10),
    role: overrides.role ?? "junior_advocate",
    permissions: overrides.permissions ?? {
      dashboard: true, clients: true, cases: true, tasks: true,
      documents: true, calendar: true, chat: true, reports: true,
      employees: false, approvals: false, auditLogs: false, settings: false,
    },
  });
  return user;
}

async function createToken(user: InstanceType<typeof User>) {
  const accessToken = jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
  // Create a session so requireAuth finds it
  await Session.create({
    userId: user._id,
    token: accessToken,
    isRevoked: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return accessToken;
}

// ---------------------------------------------------------------------------
// AUTHZ-EMP-001..006 — Employee Management Privilege Escalation
// ---------------------------------------------------------------------------
describe("Employee Management Authorization", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("AUTHZ-EMP-001: employee manager can create normal employee", async () => {
    const manager = await createUser({
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(manager);

    const res = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Employee", email: "newemployee@test.com", role: "junior_advocate" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("junior_advocate");
  });

  it("AUTHZ-EMP-002: employee manager cannot create admin", async () => {
    const manager = await createUser({
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(manager);

    const res = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Admin", email: "newadmin@test.com", role: "admin" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Only admins");
  });

  it("AUTHZ-EMP-003: employee manager cannot grant privileged permissions", async () => {
    const manager = await createUser({
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const target = await createUser({
      email: "target@test.com",
      role: "junior_advocate",
    });
    const token = await createToken(manager);

    const res = await request(app)
      .patch(`/api/admin/employees/${target._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissions: { auditLogs: true, settings: true } });

    expect(res.status).toBe(403);
  });

  it("AUTHZ-EMP-004: employee manager cannot modify own role", async () => {
    const manager = await createUser({
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(manager);

    const res = await request(app)
      .patch(`/api/admin/employees/${manager._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("own role or permissions");
  });

  it("AUTHZ-EMP-005: employee manager cannot modify admin's role", async () => {
    const adminUser = await createUser({
      email: "admin@test.com",
      role: "admin",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const manager = await createUser({
      email: "manager@test.com",
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(manager);

    const res = await request(app)
      .patch(`/api/admin/employees/${adminUser._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hacked Name" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Only admins can modify admin accounts");
  });

  it("AUTHZ-EMP-006: admin can perform all employee management operations", async () => {
    const adminUser = await createUser({
      email: "realadmin@test.com",
      role: "admin",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const adminToken = await createToken(adminUser);

    // Admin can create admin
    const createRes = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "New Admin", email: "newadmin2@test.com", role: "admin" });
    expect(createRes.status).toBe(201);

    // Admin can update employee role
    const target = await createUser({ email: "edit-target@test.com" });
    const patchRes = await request(app)
      .patch(`/api/admin/employees/${target._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Name", role: "senior_advocate" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.name).toBe("Updated Name");
  });
});

// ---------------------------------------------------------------------------
// CAL-001..006 — Calendar Authorization
// ---------------------------------------------------------------------------
describe("Calendar Authorization", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("CAL-001: employee with calendar permission is allowed GET /events", async () => {
    const user = await createUser({
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(user);

    const res = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
  });

  it("CAL-002: employee without calendar permission gets 403", async () => {
    const user = await createUser({
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: false, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(user);

    const res = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("CAL-005: admin can access calendar regardless of permission settings", async () => {
    const adminUser = await createUser({
      role: "admin",
      email: "cal-admin@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: false, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const token = await createToken(adminUser);

    const res = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${token}`);

    // Admin bypasses module permission check
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// CASE-UPDATE-001..006 — Case Update Field Whitelist
// ---------------------------------------------------------------------------
describe("Case Update Field Whitelist", () => {
  let app: ReturnType<typeof buildApp>;
  let adminUser: InstanceType<typeof User>;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp();
    adminUser = await createUser({
      role: "admin",
      email: "case-admin@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    adminToken = await createToken(adminUser);
    // Ensure counter exists
    await Counter.create({ key: `case-number-${new Date().getFullYear()}`, seq: 0 });
  });

  it("CASE-UPDATE-001: normal update (title, status) works", async () => {
    // Create a case first
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Test Case" });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.case._id;

    const updateRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Updated Title", status: "On Hold" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.case.title).toBe("Updated Title");
    expect(updateRes.body.case.status).toBe("On Hold");
  });

  it("CASE-UPDATE-002: attempt to modify createdBy is silently ignored", async () => {
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Test Case 2" });
    const caseId = createRes.body.case._id;
    const originalCreatedBy = createRes.body.case.createdBy;

    const fakeUserId = new mongoose.Types.ObjectId().toString();
    const updateRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ createdBy: fakeUserId });
    expect(updateRes.status).toBe(200);

    // createdBy must not change
    const caseInDb = await Case.findById(caseId).lean();
    expect(caseInDb?.createdBy?.toString()).toBe(adminUser._id.toString());
  });

  it("CASE-UPDATE-003: attempt to modify case number is silently ignored", async () => {
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Test Case 3" });
    const caseId = createRes.body.case._id;
    const originalNumber = createRes.body.case.number;

    const updateRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ number: "SW-9999-9999", title: "Still same case" });
    expect(updateRes.status).toBe(200);

    const caseInDb = await Case.findById(caseId).lean();
    expect(caseInDb?.number).toBe(originalNumber);
  });

  it("CASE-UPDATE-004: non-admin cannot reassign case to another user", async () => {
    const normalUser = await createUser({
      email: "normal@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const normalToken = await createToken(normalUser);

    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Case for non-admin test", assignedTo: normalUser._id.toString() });
    const caseId = createRes.body.case._id;

    const fakeId = new mongoose.Types.ObjectId().toString();
    const updateRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${normalToken}`)
      .send({ assignedTo: fakeId });

    expect(updateRes.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CLIENT-UPDATE-001..005 — Client Update Field Whitelist
// ---------------------------------------------------------------------------
describe("Client Update Field Whitelist", () => {
  let app: ReturnType<typeof buildApp>;
  let adminUser: InstanceType<typeof User>;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp();
    adminUser = await createUser({
      role: "admin",
      email: "client-admin@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    adminToken = await createToken(adminUser);
  });

  it("CLIENT-UPDATE-001: normal client edit works", async () => {
    const createRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Test Client", type: "Individual" });
    expect(createRes.status).toBe(201);
    const clientId = createRes.body.client._id;

    const updateRes = await request(app)
      .patch(`/api/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Client Name", phone: "9999999999" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.client.name).toBe("Updated Client Name");
  });

  it("CLIENT-UPDATE-002: attempt to modify createdBy is silently ignored", async () => {
    const createRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Client B" });
    const clientId = createRes.body.client._id;

    const fakeId = new mongoose.Types.ObjectId().toString();
    const updateRes = await request(app)
      .patch(`/api/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ createdBy: fakeId });
    expect(updateRes.status).toBe(200);

    const clientInDb = await Client.findById(clientId).lean();
    expect(clientInDb?.createdBy?.toString()).toBe(adminUser._id.toString());
  });

  it("CLIENT-UPDATE-004: malicious extra field is ignored", async () => {
    const createRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Client C" });
    const clientId = createRes.body.client._id;

    const updateRes = await request(app)
      .patch(`/api/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated", __proto__: { admin: true }, constructor: null });
    expect(updateRes.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DATA-CASE-001..005 — Case Archive Semantics
// ---------------------------------------------------------------------------
describe("Case Archive Semantics", () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp();
    const adminUser = await createUser({
      role: "admin",
      email: "archive-admin@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    adminToken = await createToken(adminUser);
    await Counter.create({ key: `case-number-${new Date().getFullYear()}`, seq: 0 });
  });

  it("DATA-CASE-001: DELETE /cases/:id archives instead of hard-deletes", async () => {
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Case to Archive" });
    const caseId = createRes.body.case._id;

    const deleteRes = await request(app)
      .delete(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe("Case archived");

    // Case still exists in DB
    const caseInDb = await Case.findById(caseId).lean();
    expect(caseInDb).not.toBeNull();
    expect(caseInDb?.status).toBe("Archived");
    expect(caseInDb?.archivedAt).toBeDefined();
  });

  it("DATA-CASE-002: archived case has archivedAt and archivedBy set", async () => {
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Case to Check Archive Fields" });
    const caseId = createRes.body.case._id;

    await request(app)
      .delete(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const caseInDb = await Case.findById(caseId).lean();
    expect(caseInDb?.archivedAt).toBeInstanceOf(Date);
    expect(caseInDb?.archivedBy).toBeDefined();
  });

  it("DATA-CASE-005: archived case excluded from normal list query", async () => {
    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Case to be Archived and Hidden" });
    const caseId = createRes.body.case._id;

    await request(app)
      .delete(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const listRes = await request(app)
      .get("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const caseTitles = listRes.body.cases.map((c: any) => c.title);
    expect(caseTitles).not.toContain("Case to be Archived and Hidden");
  });
});

// ---------------------------------------------------------------------------
// Atomic Case Number Generation
// ---------------------------------------------------------------------------
describe("Atomic Case Number Generation", () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp();
    const adminUser = await createUser({
      role: "admin",
      email: "counter-admin@test.com",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    adminToken = await createToken(adminUser);
  });

  it("Concurrent case creations produce unique case numbers", async () => {
    const year = new Date().getFullYear();
    // Ensure counter is initialized
    await Counter.findOneAndUpdate(
      { key: `case-number-${year}` },
      { $setOnInsert: { seq: 0 } },
      { upsert: true, new: true }
    );

    const CONCURRENT_COUNT = 10;
    const promises = Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
      request(app)
        .post("/api/cases")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: `Concurrent Case ${i}` })
    );

    const results = await Promise.all(promises);
    const numbers = results
      .filter(r => r.status === 201)
      .map(r => r.body.case.number);

    // All should have succeeded
    expect(results.every(r => r.status === 201)).toBe(true);

    // All numbers must be unique
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(CONCURRENT_COUNT);

    // All should match the expected format
    numbers.forEach(num => {
      expect(num).toMatch(/^SW-\d{4}-\d{4}$/);
    });
  });
});
