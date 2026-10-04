/**
 * Node test runner using tsx for StillWorks LegalOS security tests.
 * Runs independently of Vitest/Vite/rolldown bundler issues on Windows.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

// Set environment before imports
process.env["JWT_SECRET"] = "test-secret-that-is-at-least-64-characters-long-for-test-runs-12345";
process.env["NODE_ENV"] = "test";

const { User } = await import("../models/User.js");
const { Session } = await import("../models/Session.js");
const { Case } = await import("../models/Case.js");
const { Client } = await import("../models/Client.js");
const { Counter } = await import("../models/Counter.js");
const { Task } = await import("../models/Task.js");
const { Reminder } = await import("../models/Reminder.js");
const { CalendarEvent } = await import("../models/CalendarEvent.js");
const { default: adminRoutes } = await import("../routes/admin.js");
const { default: authRoutes } = await import("../routes/auth.js");
const { deliveredOtpsForTesting } = await import("../services/passwordResetDelivery.js");
const { default: calendarRoutes } = await import("../routes/calendar.js");
const { default: casesRoutes } = await import("../routes/cases.js");
const { default: clientsRoutes } = await import("../routes/clients.js");
const { default: tasksRoutes } = await import("../routes/tasks.js");
const { default: remindersRoutes } = await import("../routes/reminders.js");
const { default: documentsRoutes } = await import("../routes/documents.js");
const { default: chatRoutes } = await import("../routes/chat.js");
const { default: searchRoutes } = await import("../routes/search.js");
const { ChatGroup, ChatMessage } = await import("../models/Chat.js");
const { getLocalPath } = await import("../services/storage.js");
const { DocumentModel } = await import("../models/Document.js");
const { processDueReminders } = await import("../services/reminderScheduler.js");
const { syncCallReminders, deleteCallReminders } = await import("../services/reminders.js");
const { validateMimeType } = await import("../services/nas.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set("io", null);

  app.get("/api/ready", (_req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      res.json({ ready: true, database: "connected" });
    } else {
      res.status(503).json({ ready: false, database: "disconnected" });
    }
  });

  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/clients", clientsRoutes);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/reminders", remindersRoutes);
  app.use("/api/documents", documentsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/search", searchRoutes);

  app.all("/api/*", (_req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!res.headersSent) {
      const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
      res.status(status).json({
        message: status < 500 && err?.message ? err.message : "Internal server error",
      });
    }
  });

  return app;
}

const JWT_SECRET = process.env["JWT_SECRET"]!;

async function createUser(overrides: Record<string, any> = {}) {
  return await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${Date.now()}-${Math.random()}@test.com`,
    passwordHash: await bcrypt.hash("SecurePass1!", 10),
    role: overrides.role ?? "junior_advocate",
    permissions: overrides.permissions ?? {
      dashboard: true, clients: true, cases: true, tasks: true,
      documents: true, calendar: true, chat: true, reports: true,
      employees: false, approvals: false, auditLogs: false, settings: false,
    },
  });
}

async function createToken(user: any) {
  const accessToken = jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
  await Session.create({
    userId: user._id,
    token: accessToken,
    refreshTokenHash: "test_dummy_refresh_hash",
    isRevoked: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return accessToken;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    failed++;
  }
}

async function run() {
  let mongod: any = null;
  const testDbName = `legalos_test_${Date.now()}`;

  // Try local MongoDB server first for immediate execution, fallback to MongoMemoryServer
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${testDbName}`, { serverSelectionTimeoutMS: 1500 });
    console.log(`\nConnected to local MongoDB Server (database: ${testDbName})\n`);
  } catch {
    console.log("\n--- Starting In-Memory MongoDB ---");
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: "test_db" });
    console.log("Connected to MongoDB Memory Server\n");
  }

  const app = buildApp();

  // Test suite 1: AUTHZ-EMP
  console.log("Suite: Employee Management Authorization");
  {
    const manager = await createUser({
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: false, auditLogs: false, settings: false,
      },
    });
    const token = await createToken(manager);

    // AUTHZ-EMP-001
    const res1 = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Emp1", email: "emp1@test.com", role: "junior_advocate" });
    assert(res1.status === 201 && res1.body.user.role === "junior_advocate", "AUTHZ-EMP-001: manager can create normal employee");

    // AUTHZ-EMP-002
    const res2 = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Emp2", email: "emp2@test.com", role: "admin" });
    assert(res2.status === 403, "AUTHZ-EMP-002: manager CANNOT create admin");

    // AUTHZ-EMP-003
    const target = await createUser({ email: "target@test.com" });
    const res3 = await request(app)
      .patch(`/api/admin/employees/${target._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });
    assert(res3.status === 403, "AUTHZ-EMP-003: manager CANNOT grant admin role via PATCH");

    // AUTHZ-EMP-004
    const res4 = await request(app)
      .patch(`/api/admin/employees/${manager._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });
    assert(res4.status === 403, "AUTHZ-EMP-004: manager CANNOT self-escalate");

    // AUTHZ-EMP-005
    const admin = await createUser({ role: "admin", email: "admin@test.com" });
    const res5 = await request(app)
      .patch(`/api/admin/employees/${admin._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hacked" });
    assert(res5.status === 403, "AUTHZ-EMP-005: manager CANNOT edit admin account");

    // AUTHZ-EMP-006: Admin can do all
    const adminToken = await createToken(admin);
    const res6 = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Admin2", email: "admin2@test.com", role: "admin" });
    assert(res6.status === 201, "AUTHZ-EMP-006: admin CAN create admin");
  }

  // Test suite 2: CAL
  console.log("\nSuite: Calendar Authorization");
  {
    const userWithCal = await createUser({
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const tokenWithCal = await createToken(userWithCal);

    const userNoCal = await createUser({
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: false, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const tokenNoCal = await createToken(userNoCal);

    const res1 = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${tokenWithCal}`);
    assert(res1.status === 200, "CAL-001: user with calendar permission allowed");

    const res2 = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${tokenNoCal}`);
    assert(res2.status === 403, "CAL-002: user without calendar permission gets 403");
  }

  // Test suite 3: CASE WHITELIST & ARCHIVE
  console.log("\nSuite: Case Whitelist & Archive Semantics");
  {
    const admin = await createUser({ role: "admin", email: "caseadmin@test.com" });
    const adminToken = await createToken(admin);

    const createRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Case Alpha" });
    assert(createRes.status === 201, "CASE: Created test case");
    const caseId = createRes.body.case._id;
    const originalNumber = createRes.body.case.number;

    // CASE-UPDATE-002: createdBy ignored
    const fakeId = new mongoose.Types.ObjectId().toString();
    await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ createdBy: fakeId });
    const c1 = await Case.findById(caseId).lean();
    assert(c1?.createdBy?.toString() === admin._id.toString(), "CASE-UPDATE-002: createdBy not modified via PATCH");

    // CASE-UPDATE-003: number ignored
    await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ number: "SW-0000-0000" });
    const c2 = await Case.findById(caseId).lean();
    assert(c2?.number === originalNumber, "CASE-UPDATE-003: case number not modified via PATCH");

    // DATA-CASE-001: archive instead of hard-delete
    const delRes = await request(app)
      .delete(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(delRes.status === 200 && delRes.body.message === "Case archived", "DATA-CASE-001: DELETE archives case");

    const archivedCase = await Case.findById(caseId).lean();
    assert(archivedCase?.status === "Archived", "DATA-CASE-002: archived case status is 'Archived'");
    assert(archivedCase?.archivedAt != null, "DATA-CASE-003: archivedAt timestamp is set");

    // DATA-CASE-005: excluded from default list
    const listRes = await request(app)
      .get("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`);
    const found = listRes.body.cases.some((c: any) => c._id === caseId);
    assert(!found, "DATA-CASE-005: archived case excluded from default list query");
  }

  // Test suite 4: ATOMIC CONCURRENCY
  console.log("\nSuite: Atomic Concurrency (Case Numbers)");
  {
    const admin = await createUser({ role: "admin", email: "concurradmin@test.com" });
    const adminToken = await createToken(admin);

    const N = 8;
    const promises = Array.from({ length: N }, (_, i) =>
      request(app)
        .post("/api/cases")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: `Concurrent ${i}` })
    );

    const results = await Promise.all(promises);
    const numbers = results.map(r => r.body.case?.number).filter(Boolean);
    const unique = new Set(numbers);
    assert(results.every(r => r.status === 201), `CONCURRENCY: all ${N} creations succeeded (201)`);
    assert(unique.size === N, `CONCURRENCY: all ${N} case numbers are distinct (no collision)`);
  }

  // Test suite 5: CLIENT WHITELIST & ARCHIVE
  console.log("\nSuite: Client Whitelist & Archive Semantics");
  {
    const admin = await createUser({ role: "admin", email: "clientadmin@test.com" });
    const adminToken = await createToken(admin);

    const createRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Client Gamma", type: "Individual" });
    assert(createRes.status === 201, "CLIENT: Created test client");
    const clientId = createRes.body.client._id;

    // CLIENT-UPDATE-002: createdBy ignored
    const fakeId = new mongoose.Types.ObjectId().toString();
    await request(app)
      .patch(`/api/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ createdBy: fakeId });
    const cl1 = await Client.findById(clientId).lean();
    assert(cl1?.createdBy?.toString() === admin._id.toString(), "CLIENT-UPDATE-002: createdBy not modified via PATCH");

    // DATA-CLIENT-001: archive client
    const delRes = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(delRes.status === 200 && delRes.body.message === "Client archived", "DATA-CLIENT-001: DELETE archives client");

    const archivedClient = await Client.findById(clientId).lean();
    assert(archivedClient?.tag === "Archived", "DATA-CLIENT-002: archived client tag is 'Archived'");
  }

  // Test suite 6: AUDIT LOG SEQUENCE ATOMICITY
  console.log("\nSuite: Audit Log Sequence Atomicity");
  {
    const { AuditLog } = await import("../models/AuditLog.js");
    const user = await createUser({ email: "audituser@test.com" });

    // Seed counter
    const { initSequence } = await import("../models/Counter.js");
    await initSequence("audit-log-sequence", 0);

    // Create 10 audit logs concurrently
    const M = 10;
    const promises = Array.from({ length: M }, (_, i) =>
      AuditLog.create({
        userId: user._id,
        userName: user.name,
        action: "create",
        resource: "case",
        resourceId: new mongoose.Types.ObjectId().toString(),
        resourceName: `Audit Test ${i}`,
        ip: "127.0.0.1",
      })
    );

    const logs = await Promise.all(promises);
    const sequences = logs.map(l => l.sequence);
    const uniqueSeqs = new Set(sequences);
    assert(uniqueSeqs.size === M, `AUDIT CONCURRENCY: all ${M} audit logs have unique sequence numbers`);
  }

  // Test suite 7: TASK COMPLETION & APPROVAL WORKFLOW
  console.log("\nSuite: Task Completion & Approval Workflow");
  {
    const admin = await createUser({
      name: "Admin Approver",
      email: "adminapprover@test.com",
      role: "admin",
      permissions: { employees: true, approvals: true, auditLogs: true, settings: true, tasks: true },
    });
    const adminToken = await createToken(admin);

    const employee = await createUser({
      name: "Associate Staff",
      email: "associatestaff@test.com",
      role: "junior_advocate",
      permissions: { tasks: true, dashboard: true },
    });
    const employeeToken = await createToken(employee);

    // 1. Create a task assigned to employee
    const task = await Task.create({
      title: "Draft Initial Written Statement",
      description: "Prepare and review statement draft",
      category: "Drafting",
      priority: "High",
      status: "in_progress",
      deadline: new Date(Date.now() - 3600000), // 1 hour ago
      assignedTo: employee._id,
      createdBy: admin._id,
      checklist: [
        { text: "Collect facts from client", done: true },
        { text: "Draft preliminary arguments", done: true },
      ],
    });

    // 2. Employee submits task as completed via PATCH
    const submitRes = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ status: "completed" });

    assert(submitRes.status === 200, "TASK-APPR-001: Employee PATCH status: completed succeeds");
    assert(submitRes.body.task.status === "pending_approval", "TASK-APPR-002: Non-admin completion request routes to pending_approval");

    // Verify overdue hook does not mark pending_approval as overdue
    const refreshed = await Task.findById(task._id);
    assert(refreshed?.status === "pending_approval", "TASK-APPR-003: Task with past deadline remains in pending_approval");

    // 3. Admin checks approvals queue
    const approvalsRes = await request(app)
      .get("/api/admin/approvals")
      .set("Authorization", `Bearer ${adminToken}`);

    assert(approvalsRes.status === 200, "TASK-APPR-004: Admin GET /api/admin/approvals succeeds");
    const taskApproval = approvalsRes.body.approvals.find((a: any) => a._id === `task_${task._id}`);
    assert(Boolean(taskApproval), "TASK-APPR-005: Task completion appears in approvals queue");
    assert(taskApproval?.kind === "Task Completion", "TASK-APPR-006: Approval kind is 'Task Completion'");

    // 4. Admin approves the task
    const approveRes = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "completed" });

    assert(approveRes.status === 200, "TASK-APPR-007: Admin PATCH status: completed succeeds");
    assert(approveRes.body.task.status === "completed", "TASK-APPR-008: Admin approval transitions task to completed");

    // 5. Verify task is no longer in pending_approval
    const approvalsAfterRes = await request(app)
      .get("/api/admin/approvals")
      .set("Authorization", `Bearer ${adminToken}`);
    const taskApprovalAfter = approvalsAfterRes.body.approvals.find((a: any) => a._id === `task_${task._id}`);
    assert(!taskApprovalAfter, "TASK-APPR-009: Completed task cleared from approvals queue");
  }

  // ---------------------------------------------------------------------------
  // Suite: Reminders & Call Synchronization
  // ---------------------------------------------------------------------------
  {
    console.log(`\nSuite: Reminders & Call Synchronization`);

    const adminUser = await createUser({ role: "admin", name: "Reminders Admin", email: "remadmin@test.com" });
    const adminToken = await createToken(adminUser);
    const employeeUser = await createUser({ role: "junior_advocate", name: "Reminders Employee", email: "rememp@test.com" });

    // REM-001: Public health check returns 200 without auth
    const healthRes = await request(app).get("/api/reminders/health");
    assert(healthRes.status === 200, "REM-001: GET /api/reminders/health returns 200");
    assert(healthRes.body.ok === true && healthRes.body.service === "reminders", "REM-002: Health check body contains ok:true and service:reminders");

    // REM-003: Due reminders endpoint requires authentication
    const unauthDueRes = await request(app).get("/api/reminders/due");
    assert(unauthDueRes.status === 401, "REM-003: GET /api/reminders/due returns 401 without auth");

    // REM-004: Due reminders endpoint succeeds with auth
    const authDueRes = await request(app)
      .get("/api/reminders/due")
      .set("Authorization", `Bearer ${adminToken}`);
    assert(authDueRes.status === 200, "REM-004: GET /api/reminders/due returns 200 with auth");
    assert(Array.isArray(authDueRes.body.reminders), "REM-005: Returns reminders array");

    // REM-006: Task creation rejects invalid scheduledAt
    const invalidDateRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "📞 CALL: Ramesh Kumar",
        callReminder: {
          clientName: "Ramesh Kumar",
          scheduledAt: "invalid-date-string",
        },
      });
    assert(invalidDateRes.status === 400, "REM-006: Rejects invalid scheduledAt with 400");

    // REM-007: Task creation with valid callReminder creates synchronized Reminder with correct userId
    const scheduledTime = new Date(Date.now() + 3600000).toISOString();
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "📞 CALL: Ramesh Kumar",
        assignedTo: employeeUser._id,
        callReminder: {
          clientName: "Ramesh Kumar",
          phone: "+91-9876543210",
          notes: "Initial consultation",
          scheduledAt: scheduledTime,
        },
      });
    assert(taskRes.status === 201, "REM-007: Task created successfully");
    const createdTaskId = taskRes.body.task._id;

    // Verify synchronized Reminder document in DB
    const syncReminder = await Reminder.findOne({ sourceType: "task", sourceId: createdTaskId });
    assert(Boolean(syncReminder), "REM-008: Synchronized Reminder document created in DB");
    assert(syncReminder?.userId.toString() === employeeUser._id.toString(), "REM-009: Reminder assigned to correct userId");
    assert(syncReminder?.clientName === "Ramesh Kumar", "REM-010: Reminder has clientName");
    assert(syncReminder?.phone === "+91-9876543210", "REM-011: Reminder has phone");

    // REM-012: Task update clears optional fields (notes and phone set to "") and updates scheduledAt
    const newScheduledTime = new Date(Date.now() + 7200000).toISOString();
    const updateRes = await request(app)
      .patch(`/api/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        callReminder: {
          clientName: "Ramesh Kumar Updated",
          phone: "",
          notes: "",
          scheduledAt: newScheduledTime,
        },
      });
    assert(updateRes.status === 200, "REM-012: Task update succeeds with cleared optional fields");
    const updatedReminder = await Reminder.findOne({ sourceType: "task", sourceId: createdTaskId });
    assert(updatedReminder?.clientName === "Ramesh Kumar Updated", "REM-013: Synchronized Reminder updated clientName");
    assert(updatedReminder?.phone === "", "REM-014: Synchronized Reminder cleared phone");
    assert(updatedReminder?.notes === "", "REM-015: Synchronized Reminder cleared notes");

    // REM-016: Task deletion deletes synchronized Reminder
    const deleteRes = await request(app)
      .delete(`/api/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(deleteRes.status === 200, "REM-016: Task deleted successfully");
    const reminderAfterTaskDelete = await Reminder.findOne({ sourceType: "task", sourceId: createdTaskId });
    assert(!reminderAfterTaskDelete, "REM-017: Synchronized Reminder deleted on task deletion");
  }

  // Test suite: Authentication, Session Revocation & Password Reset Delivery
  console.log("\nSuite: Authentication, Session Revocation & Password Reset Delivery");
  {
    const authUser = await createUser({
      name: "Auth Test User",
      email: "authuser@stillworks.legal",
      role: "junior_advocate",
    });
    const authToken = await createToken(authUser);

    // AUTH-006: POST /api/auth/logout with valid token revokes session in DB
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${authToken}`)
      .send();
    assert(logoutRes.status === 200, "AUTH-006: POST /api/auth/logout returns 200");
    const sessionInDb = await Session.findOne({ token: authToken });
    assert(sessionInDb?.isRevoked === true, "AUTH-007: Session marked isRevoked:true in MongoDB");

    // AUTH-008: Revoked token cannot access protected endpoint
    const postLogoutAccess = await request(app)
      .get("/api/reminders/due")
      .set("Authorization", `Bearer ${authToken}`);
    assert(postLogoutAccess.status === 401, "AUTH-008: Revoked session yields 401 on protected endpoint");

    // AUTH-009: POST /api/auth/forgot-password sends OTP via provider
    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "authuser@stillworks.legal" });
    assert(forgotRes.status === 200, "AUTH-009: POST /api/auth/forgot-password returns 200");
    const deliveredRecord = deliveredOtpsForTesting.find((d) => d.destination === "authuser@stillworks.legal");
    assert(Boolean(deliveredRecord?.otp), "AUTH-010: Real OTP was dispatched and captured by provider");
    const validOtp = deliveredRecord!.otp;

    // AUTH-011: POST /api/auth/reset-password rejects invalid OTP
    const invalidResetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "authuser@stillworks.legal",
        otp: "000000",
        newPassword: "BrandNewSecurePassword123!",
      });
    assert(invalidResetRes.status === 400, "AUTH-011: Rejects invalid OTP with 400");

    // AUTH-012: POST /api/auth/reset-password with valid OTP succeeds
    const validResetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "authuser@stillworks.legal",
        otp: validOtp,
        newPassword: "BrandNewSecurePassword123!",
      });
    assert(validResetRes.status === 200, "AUTH-012: Resets password successfully with valid OTP");

    // AUTH-013: Login with old password fails
    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "authuser@stillworks.legal",
        password: "SecurePass1!",
      });
    assert(oldLoginRes.status === 401, "AUTH-013: Login with old password rejected with 401");

    // AUTH-014: Login with new password succeeds
    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "authuser@stillworks.legal",
        password: "BrandNewSecurePassword123!",
      });
    assert(newLoginRes.status === 200 && Boolean(newLoginRes.body.accessToken), "AUTH-014: Login with new password succeeds and returns access token");
  }

  // Test suite: Reminders Lifecycle, Snooze, Complete, Atomic Claim & Calendar Sync
  console.log("\nSuite: Reminders Lifecycle, Snooze, Complete, Atomic Claim & Calendar Sync");
  {
    const remUser = await createUser({
      name: "Reminder Lifecycle User",
      email: "remlifecycle@stillworks.legal",
      role: "admin",
      permissions: {
        calendar: true,
        tasks: true,
        dashboard: true,
        clients: true,
        cases: true,
        documents: true,
        chat: true,
        reports: true,
        employees: true,
        approvals: true,
        auditLogs: true,
        settings: true,
      },
    });
    const remToken = await createToken(remUser);

    // Create a standalone reminder
    const testReminder = await Reminder.create({
      userId: remUser._id,
      sourceType: "custom",
      sourceId: null,
      clientName: "Snooze Test Client",
      phone: "+91-9999888877",
      notes: "Follow up call",
      scheduledAt: new Date(Date.now() - 5000),
      status: "scheduled",
    });

    // REM-018: POST /api/reminders/:id/snooze updates status to snoozed and sets snoozedUntil
    const snoozeRes = await request(app)
      .post(`/api/reminders/${testReminder._id}/snooze`)
      .set("Authorization", `Bearer ${remToken}`)
      .send({ minutes: 15 });
    assert(snoozeRes.status === 200, "REM-018: POST /api/reminders/:id/snooze returns 200");
    const snoozedDoc = await Reminder.findById(testReminder._id);
    assert(snoozedDoc?.status === "snoozed", "REM-019: Reminder status changed to snoozed in DB");
    assert(Boolean(snoozedDoc?.snoozedUntil), "REM-020: Reminder snoozedUntil is set in DB");

    // REM-021: POST /api/reminders/:id/complete updates status to completed
    const completeRes = await request(app)
      .post(`/api/reminders/${testReminder._id}/complete`)
      .set("Authorization", `Bearer ${remToken}`)
      .send();
    assert(completeRes.status === 200, "REM-021: POST /api/reminders/:id/complete returns 200");
    const completedDoc = await Reminder.findById(testReminder._id);
    assert(completedDoc?.status === "completed", "REM-022: Reminder status changed to completed in DB");
    assert(Boolean(completedDoc?.completedAt), "REM-023: Reminder completedAt timestamp recorded in DB");

    // REM-024: Atomic claim concurrency test
    const dueReminder = await Reminder.create({
      userId: remUser._id,
      sourceType: "custom",
      sourceId: null,
      clientName: "Concurrency Client",
      scheduledAt: new Date(Date.now() - 10000),
      status: "scheduled",
    });

    // Simulate 5 simultaneous worker threads trying to atomically claim this due reminder
    const claimPromises = Array.from({ length: 5 }, () =>
      Reminder.findOneAndUpdate(
        {
          _id: dueReminder._id,
          status: { $in: ["scheduled", "snoozed"] },
        },
        {
          $set: {
            status: "notified",
            notifiedAt: new Date(),
          },
        },
        { new: true }
      )
    );
    const claimResults = await Promise.all(claimPromises);
    const successfulClaims = claimResults.filter(Boolean);
    assert(successfulClaims.length === 1, "REM-024: Atomic claim ensures exactly ONE scheduler worker claims due reminder");

    // REM-025: Calendar event with type 'call_reminder' creates synchronized Reminder document
    const calEventRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${remToken}`)
      .send({
        title: "📞 CALL: Advocate Sharma",
        description: "Review case strategy",
        type: "call_reminder",
        start: new Date(Date.now() + 1800000).toISOString(),
      });
    assert(calEventRes.status === 201, "REM-025: Calendar call_reminder event created successfully");
    const createdEventId = calEventRes.body.event._id;
    const syncCalReminder = await Reminder.findOne({ sourceType: "event", sourceId: createdEventId });
    assert(Boolean(syncCalReminder), "REM-026: Synchronized Reminder created for calendar call_reminder event");

    // REM-027: Deleting calendar event deletes synchronized Reminder
    const delCalEventRes = await request(app)
      .delete(`/api/calendar/events/${createdEventId}`)
      .set("Authorization", `Bearer ${remToken}`);
    assert(delCalEventRes.status === 200, "REM-027: Calendar event deleted successfully");
    const calReminderAfterDelete = await Reminder.findOne({ sourceType: "event", sourceId: createdEventId });
    assert(!calReminderAfterDelete, "REM-028: Synchronized Reminder deleted on calendar event deletion");

    // =========================================================================
    // Test suite 11: Reminder State Machine (409 Conflict) & Metadata Updates
    // =========================================================================
    console.log("\n--- Suite 11: Reminder State Machine & Concurrency ---");
    const stmReminder = await Reminder.create({
      userId: remUser._id,
      sourceType: "custom",
      clientName: "State Machine Client",
      scheduledAt: new Date(),
      status: "completed",
    });

    // REM-STM-001: Cannot snooze a completed reminder -> 409 Conflict
    const snoozeConflictRes = await request(app)
      .post(`/api/reminders/${stmReminder._id}/snooze`)
      .set("Authorization", `Bearer ${remToken}`)
      .send({ minutes: 10 });
    assert(snoozeConflictRes.status === 409, "REM-STM-001: Snoozing a completed reminder returns 409 Conflict");

    // REM-STM-002: Cannot acknowledge a completed reminder -> 409 Conflict
    const ackConflictRes = await request(app)
      .post(`/api/reminders/${stmReminder._id}/acknowledge`)
      .set("Authorization", `Bearer ${remToken}`)
      .send();
    assert(ackConflictRes.status === 409, "REM-STM-002: Acknowledging a completed reminder returns 409 Conflict");

    // REM-STM-003: Rescheduling a completed reminder returns 409 Conflict
    const rescheduleConflictRes = await request(app)
      .patch(`/api/reminders/${stmReminder._id}`)
      .set("Authorization", `Bearer ${remToken}`)
      .send({ scheduledAt: new Date(Date.now() + 600000).toISOString() });
    assert(rescheduleConflictRes.status === 409, "REM-STM-003: Rescheduling a completed reminder returns 409 Conflict");

    // REM-STM-004: Updating metadata on active reminder does not alter status
    const metaReminder = await Reminder.create({
      userId: remUser._id,
      sourceType: "custom",
      clientName: "Initial Client",
      notes: "Initial notes",
      scheduledAt: new Date(Date.now() + 3600000),
      status: "acknowledged",
    });
    const metaUpdateRes = await request(app)
      .patch(`/api/reminders/${metaReminder._id}`)
      .set("Authorization", `Bearer ${remToken}`)
      .send({ notes: "Updated call notes only" });
    assert(metaUpdateRes.status === 200, "REM-STM-004: Updating notes returns 200");
    const metaDoc = await Reminder.findById(metaReminder._id);
    assert(metaDoc?.notes === "Updated call notes only", "REM-STM-005: Notes updated in DB");
    assert(metaDoc?.status === "acknowledged", "REM-STM-006: Status remained 'acknowledged' after metadata update");

    // REM-SCHED-001: Direct test of processDueReminders with mock time
    const schedReminder = await Reminder.create({
      userId: remUser._id,
      sourceType: "custom",
      clientName: "Scheduler Test Client",
      scheduledAt: new Date(Date.now() - 5000),
      status: "scheduled",
    });
    const claimedCount = await processDueReminders(null, new Date());
    assert(claimedCount >= 1, "REM-SCHED-001: processDueReminders claimed at least 1 due reminder");
    const claimedDoc = await Reminder.findById(schedReminder._id);
    assert(claimedDoc?.status === "triggered", "REM-SCHED-002: Due reminder status transitioned to 'triggered'");
    assert(Boolean(claimedDoc?.deliveryId), "REM-SCHED-003: Delivery ID attached to claimed reminder");

    // =========================================================================
    // Test suite 12: Truthful Health / Ready Endpoints
    // =========================================================================
    console.log("\n--- Suite 12: Health & Readiness Endpoints ---");
    const readyRes = await request(app).get("/api/ready");
    assert(readyRes.status === 200, "HEALTH-READY-001: GET /api/ready returns 200 when connected to DB");
    assert(readyRes.body.ready === true, "HEALTH-READY-002: Response reports ready: true");
    assert(readyRes.body.database === "connected", "HEALTH-READY-003: Response reports database: connected");

    // =========================================================================
    // Test suite 13: Document Security & Integrity
    // =========================================================================
    console.log("\n--- Suite 13: Document Security & Integrity ---");
    const docCase = await Case.create({
      title: "Doc Test Case",
      number: "SW-2026-9999",
      client: (await Client.create({ name: "Doc Client", createdBy: remUser._id }))._id,
      assignedLawyer: remUser._id,
      assignedTeam: [remUser._id],
      status: "Active",
    });

    const testDoc = await DocumentModel.create({
      name: "Secret Contract.pdf",
      originalName: "Secret Contract.pdf",
      kind: "pdf",
      sizeFormatted: "1 KB",
      caseId: docCase._id,
      uploadedBy: remUser._id,
      nasPath: "cases/SW-2026-9999/Secret Contract.pdf",
      nasFolder: "cases/SW-2026-9999",
      size: 1024,
      mimeType: "application/pdf",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      state: "Pending",
    });

    // DOC-SEC-001: Client cannot modify nasPath via PATCH /api/documents/:id
    const patchDocRes = await request(app)
      .patch(`/api/documents/${testDoc._id}`)
      .set("Authorization", `Bearer ${remToken}`)
      .send({
        name: "Renamed Contract.pdf",
        nasPath: "malicious/traversal/path/contract.pdf",
      });
    assert(patchDocRes.status === 200, "DOC-SEC-001: PATCH /api/documents/:id returns 200 for valid name update");
    const refreshedDoc = await DocumentModel.findById(testDoc._id);
    assert(refreshedDoc?.name === "Renamed Contract.pdf", "DOC-SEC-002: Document name was updated");
    assert(refreshedDoc?.nasPath === "cases/SW-2026-9999/Secret Contract.pdf", "DOC-SEC-003: nasPath was NOT modified by client PATCH");

    // DOC-INT-001: POST /api/documents/:id/verify returns verification payload
    const verifyDocRes = await request(app)
      .post(`/api/documents/${testDoc._id}/verify`)
      .set("Authorization", `Bearer ${remToken}`);
    assert(verifyDocRes.status === 200, "DOC-INT-001: POST /api/documents/:id/verify returns 200");
    assert(verifyDocRes.body.documentId === testDoc._id.toString(), "DOC-INT-002: Response has documentId");
    assert(Boolean(verifyDocRes.body.expectedHash), "DOC-INT-003: Response has expectedHash");
    assert(["verified", "tampered", "missing"].includes(verifyDocRes.body.status), "DOC-INT-004: Status is valid integrity state");
  }

  // --- Suite 14: Authorization Separation & Document BOLA (Phase 2 & 3) ---
  console.log("\n--- Suite 14: Authorization Separation & Document BOLA ---");
  {
    // Create Employee A (uploader)
    const userA = await createUser({
      name: "Advocate Alice",
      email: "alice@test.com",
      role: "junior_advocate",
      permissions: { documents: true, cases: true },
    });
    const tokenA = await createToken(userA);

    // Create Employee B (unauthorized attacker / third party)
    // Note: Employee B HAS documents: true and cases: true module permissions!
    // But they must NOT be able to access Alice's private documents or cases.
    const userB = await createUser({
      name: "Advocate Bob",
      email: "bob@test.com",
      role: "junior_advocate",
      permissions: { documents: true, cases: true },
    });
    const tokenB = await createToken(userB);

    // Create Admin
    const adminUser = await createUser({
      name: "Senior Partner Admin",
      email: "admin-doc@test.com",
      role: "admin",
    });
    const adminToken = await createToken(adminUser);

    // Document A belongs strictly to User A
    const docA = await DocumentModel.create({
      name: "Alice Confidential Document.pdf",
      originalName: "Alice Confidential Document.pdf",
      kind: "pdf",
      size: 512,
      sizeFormatted: "512 Bytes",
      uploadedBy: userA._id,
      nasPath: "General/alice-confidential.pdf",
      nasFolder: "/General",
      mimeType: "application/pdf",
      sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      state: "Approved",
    });

    // AUTHZ-BOLA-001: User B attempts GET /api/documents/:id -> 403 Forbidden
    const bGetRes = await request(app)
      .get(`/api/documents/${docA._id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bGetRes.status === 403, "AUTHZ-BOLA-001: User B cannot access User A's document details (403)");

    // AUTHZ-BOLA-002: User B attempts GET /api/documents/:id/download -> 403 Forbidden
    const bDownloadRes = await request(app)
      .get(`/api/documents/${docA._id}/download`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bDownloadRes.status === 403, "AUTHZ-BOLA-002: User B cannot download User A's document (403)");

    // AUTHZ-BOLA-003: User B attempts GET /api/documents/:id/view -> 403 Forbidden
    const bViewRes = await request(app)
      .get(`/api/documents/${docA._id}/view`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bViewRes.status === 403, "AUTHZ-BOLA-003: User B cannot view/preview User A's document (403)");

    // AUTHZ-BOLA-004: User B attempts GET /api/documents/:id/versions -> 403 Forbidden
    const bVersionsRes = await request(app)
      .get(`/api/documents/${docA._id}/versions`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bVersionsRes.status === 403, "AUTHZ-BOLA-004: User B cannot inspect versions of User A's document (403)");

    // AUTHZ-BOLA-005: User B attempts rename PATCH /api/documents/:id -> 403 Forbidden
    const bPatchRes = await request(app)
      .patch(`/api/documents/${docA._id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Bob Hacked Document.pdf" });
    assert(bPatchRes.status === 403, "AUTHZ-BOLA-005: User B cannot modify/rename User A's document (403)");

    // AUTHZ-BOLA-006: User B attempts DELETE /api/documents/:id -> 403 Forbidden
    const bDeleteRes = await request(app)
      .delete(`/api/documents/${docA._id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bDeleteRes.status === 403, "AUTHZ-BOLA-006: User B cannot delete User A's document (403)");

    // AUTHZ-BOLA-007: User A (legitimate owner) gets 200
    const aGetRes = await request(app)
      .get(`/api/documents/${docA._id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(aGetRes.status === 200, "AUTHZ-BOLA-007: User A can access own document (200)");

    // AUTHZ-BOLA-008: Admin retains access to all documents
    const adminGetRes = await request(app)
      .get(`/api/documents/${docA._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(adminGetRes.status === 200, "AUTHZ-BOLA-008: Admin can access document (200)");

    // AUTHZ-CASE-001: Case-linked Document Authorization
    const caseAlpha = await Case.create({
      title: "Case Alpha Title",
      assignedTo: userA._id,
      createdBy: userA._id,
      status: "Active",
    });

    const docCase = await DocumentModel.create({
      name: "Case Alpha Evidence.pdf",
      originalName: "Case Alpha Evidence.pdf",
      kind: "pdf",
      size: 1024,
      sizeFormatted: "1 KB",
      caseId: caseAlpha._id,
      uploadedBy: userA._id,
      nasPath: "Cases/SW-2026-Alpha/evidence.pdf",
      mimeType: "application/pdf",
      sha256: "1122334455667788990011223344556677889900112233445566778899001122",
      state: "Pending",
    });

    // User B is not assigned to Case Alpha -> 403
    const bCaseDocRes = await request(app)
      .get(`/api/documents/${docCase._id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bCaseDocRes.status === 403, "AUTHZ-CASE-001: User B cannot access case-linked document without case membership (403)");

    // User A is assigned to Case Alpha -> 200
    const aCaseDocRes = await request(app)
      .get(`/api/documents/${docCase._id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(aCaseDocRes.status === 200, "AUTHZ-CASE-002: User A can access case-linked document via case membership (200)");

    // AUTHZ-GRANT-001: Explicit Approved Access Grant allows access
    docCase.accessRequests.push({
      userId: userB._id as any,
      reason: "Need to review evidence for court hearing",
      status: "approved",
      createdAt: new Date(),
    });
    await docCase.save();

    const bGrantedRes = await request(app)
      .get(`/api/documents/${docCase._id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(bGrantedRes.status === 200, "AUTHZ-GRANT-001: User B gains access after explicit approved access grant (200)");
  }

  // --- Suite 15: VPS Storage Security & Canonical Path Traversal Defense (Phase 4) ---
  console.log("\n--- Suite 15: VPS Storage Security & Path Traversal Defense ---");
  {
    // Test 1: Simple relative parent traversal
    let trav1Caught = false;
    try {
      getLocalPath("../secret.txt");
    } catch {
      trav1Caught = true;
    }
    assert(trav1Caught, "STORAGE-TRAV-001: Throws on '../secret.txt'");

    // Test 2: Multi-level unix traversal
    let trav2Caught = false;
    try {
      getLocalPath("../../etc/passwd");
    } catch {
      trav2Caught = true;
    }
    assert(trav2Caught, "STORAGE-TRAV-002: Throws on '../../etc/passwd'");

    // Test 3: Windows backslash traversal
    let trav3Caught = false;
    try {
      getLocalPath("..\\..\\windows\\system32");
    } catch {
      trav3Caught = true;
    }
    assert(trav3Caught, "STORAGE-TRAV-003: Throws on '..\\..\\windows\\system32'");

    // Test 4: Nested URL encoded traversal (%252e%252e)
    let trav4Caught = false;
    try {
      getLocalPath("/%252e%252e/%252e%252e/config.json");
    } catch {
      trav4Caught = true;
    }
    assert(trav4Caught, "STORAGE-TRAV-004: Throws on double-encoded '/%252e%252e/%252e%252e/'");

    // Test 5: Safe path inside root resolves to string inside storage directory
    const safePath = getLocalPath("documents/cases/SW-2026-0001/doc.pdf");
    assert(typeof safePath === "string" && safePath.length > 0, "STORAGE-SAFE-001: Resolves safe relative storage path");
  }

  // --- Suite 16: Chat Attachment Security & Group Containment (Phase 5) ---
  console.log("\n--- Suite 16: Chat Attachment Security & Group Containment ---");
  {
    const member1 = await createUser({ name: "Chat Member 1", email: "chat1@test.com" });
    const member1Token = await createToken(member1);

    const nonMember = await createUser({ name: "Chat Non Member", email: "nonmember@test.com" });
    const nonMemberToken = await createToken(nonMember);

    // Create Chat Group with member1 only
    const chatGroup = await ChatGroup.create({
      name: "Litigation Team Discussion",
      type: "group",
      createdBy: member1._id,
      members: [
        { userId: member1._id, name: member1.name, role: "admin", joinedAt: new Date() },
      ],
    });

    // CHAT-SEC-001: Non-member upload is blocked (403)
    const unauthUploadRes = await request(app)
      .post(`/api/chat/groups/${chatGroup._id}/upload`)
      .set("Authorization", `Bearer ${nonMemberToken}`);
    assert(unauthUploadRes.status === 403, "CHAT-SEC-001: Non-member cannot upload attachment to group (403)");

    // CHAT-SEC-002: Client attempts to send message with injected traversal path in attachments
    const msgWithInjectedPathRes = await request(app)
      .post(`/api/chat/groups/${chatGroup._id}/messages`)
      .set("Authorization", `Bearer ${member1Token}`)
      .send({
        text: "Here is an unauthorized attachment",
        attachments: [
          { name: "passwd.txt", nasPath: "../../etc/passwd", size: "1 KB" },
          { name: "case_secret.pdf", nasPath: "/Cases/Secret/doc.pdf", size: "1 KB" },
        ],
      });
    assert(msgWithInjectedPathRes.status === 201, "CHAT-SEC-002: Message creation returned 201");
    const storedMsg = await ChatMessage.findById(msgWithInjectedPathRes.body._id);
    assert(
      (storedMsg?.attachments?.length ?? 0) === 0,
      "CHAT-SEC-003: Injected non-chat and traversal paths were stripped from attachments"
    );

    // CHAT-SEC-004: Valid chat attachment in message
    const validGroupPath = `/chat/${chatGroup._id}/attachment1-contract.pdf`;
    const msgWithValidAttachmentRes = await request(app)
      .post(`/api/chat/groups/${chatGroup._id}/messages`)
      .set("Authorization", `Bearer ${member1Token}`)
      .send({
        text: "Here is the valid chat attachment",
        attachments: [
          { attachmentId: "att-123", name: "contract.pdf", nasPath: validGroupPath, size: "5 KB" },
        ],
      });
    assert(msgWithValidAttachmentRes.status === 201, "CHAT-SEC-004: Message with valid attachment accepted (201)");
    const storedValidMsg = await ChatMessage.findById(msgWithValidAttachmentRes.body._id);
    assert(storedValidMsg?.attachments?.length === 1, "CHAT-SEC-005: Valid chat attachment saved in message");

    // CHAT-SEC-006: Non-member cannot download attachment
    const nonMemberDownloadRes = await request(app)
      .get(`/api/chat/groups/${chatGroup._id}/attachments/download?path=${encodeURIComponent(validGroupPath)}`)
      .set("Authorization", `Bearer ${nonMemberToken}`);
    assert(nonMemberDownloadRes.status === 403, "CHAT-SEC-006: Non-member cannot download chat attachment (403)");
  }

  // --- Suite 17: Multi-User Call Reminder Synchronization (Phase 13 & 14) ---
  console.log("\n--- Suite 17: Multi-User Call Reminder Synchronization ---");
  {
    const userA = await createUser({ name: "Assignee A", email: "assigneeA@test.com" });
    const userB = await createUser({ name: "Assignee B", email: "assigneeB@test.com" });
    const userC = await createUser({ name: "Assignee C", email: "assigneeC@test.com" });
    const userD = await createUser({ name: "Assignee D", email: "assigneeD@test.com" });
    const adminUser = await createUser({ name: "Admin Lead", email: "adminlead@test.com", role: "admin" });
    const adminToken = await createToken(adminUser);

    const testScheduledAt = new Date(Date.now() + 3600 * 1000);

    // 1. Single-user reminder creation
    const singleSyncRes = await syncCallReminders({
      sourceType: "task",
      sourceId: new mongoose.Types.ObjectId(),
      userIds: [userA._id],
      clientName: "Client Alpha",
      phone: "+91 98765 43210",
      notes: "Alpha follow-up",
      scheduledAt: testScheduledAt,
    });
    assert(singleSyncRes.length === 1, "REMINDER-SYNC-001: Created single reminder for user A");
    const foundSingle = await Reminder.findOne({ userId: userA._id, clientName: "Client Alpha" });
    assert(!!foundSingle, "REMINDER-SYNC-002: Reminder persisted in database for user A");

    // 2. Multi-user reminder creation (A, B, C -> 3 distinct Reminder docs)
    const multiTaskId = new mongoose.Types.ObjectId();
    const multiSyncRes = await syncCallReminders({
      sourceType: "task",
      sourceId: multiTaskId,
      userIds: [userA._id, userB._id, userC._id],
      clientName: "Client Multi",
      phone: "+91 99999 11111",
      notes: "Multi-party consultation",
      scheduledAt: testScheduledAt,
    });
    assert(multiSyncRes.length === 3, "REMINDER-SYNC-003: Created 3 distinct reminders for users A, B, and C");
    const countMulti = await Reminder.countDocuments({ sourceType: "task", sourceId: multiTaskId });
    assert(countMulti === 3, "REMINDER-SYNC-004: Exactly 3 Reminder docs persisted for multiTaskId");

    const remDocA = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userA._id });
    const remDocB = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userB._id });
    const remDocC = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userC._id });
    assert(!!remDocA && !!remDocB && !!remDocC, "REMINDER-SYNC-005: Each assigned user has a unique reminder doc");

    // 3. Assignee update reconciliation (A, B, C -> A, C, D: B deleted, D created, A and C retained)
    const reconciledRes = await syncCallReminders({
      sourceType: "task",
      sourceId: multiTaskId,
      userIds: [userA._id, userC._id, userD._id],
      clientName: "Client Multi Updated",
      phone: "+91 99999 22222",
      notes: "Updated party notes",
      scheduledAt: testScheduledAt,
    });
    assert(reconciledRes.length === 3, "REMINDER-SYNC-006: Reconciled to exactly 3 assignees [A, C, D]");

    const checkB = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userB._id });
    assert(checkB === null, "REMINDER-SYNC-007: Unassigned user B reminder was deleted");

    const checkD = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userD._id });
    assert(!!checkD, "REMINDER-SYNC-008: Newly assigned user D reminder was created");

    const checkA = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userA._id });
    const checkC = await Reminder.findOne({ sourceType: "task", sourceId: multiTaskId, userId: userC._id });
    assert(
      checkA?._id.toString() === remDocA?._id.toString() &&
      checkC?._id.toString() === remDocC?._id.toString(),
      "REMINDER-SYNC-009: Existing reminders for A and C were retained with identical ObjectIds"
    );
    assert(
      checkA?.clientName === "Client Multi Updated" && checkA?.phone === "+91 99999 22222",
      "REMINDER-SYNC-010: Retained reminders had details updated"
    );

    // 4. Duplicate sync idempotency (calling sync twice results in exactly 1 reminder per user)
    await syncCallReminders({
      sourceType: "task",
      sourceId: multiTaskId,
      userIds: [userA._id, userC._id, userD._id],
      clientName: "Client Multi Updated",
      phone: "+91 99999 22222",
      notes: "Updated party notes",
      scheduledAt: testScheduledAt,
    });
    const postIdempotentCount = await Reminder.countDocuments({ sourceType: "task", sourceId: multiTaskId });
    assert(postIdempotentCount === 3, "REMINDER-SYNC-011: Idempotency verified - no duplicate reminders created on repeated sync");

    // 5. Cascade deletion (deleting task/event cleans up all associated reminders)
    const deletedCount = await deleteCallReminders("task", multiTaskId);
    assert(deletedCount === 3, "REMINDER-SYNC-012: deleteCallReminders removed all 3 associated reminders");
    const countAfterCascade = await Reminder.countDocuments({ sourceType: "task", sourceId: multiTaskId });
    assert(countAfterCascade === 0, "REMINDER-SYNC-013: 0 reminders remain after cascade delete");

    // 6. End-to-end route testing: Task creation and deletion via API
    const taskApiRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Task with Call Reminder",
        assignedTo: userA._id.toString(),
        callReminder: {
          clientName: "Client Route Test",
          phone: "1234567890",
          scheduledAt: testScheduledAt.toISOString(),
          notes: "Route test notes",
        },
      });
    assert(taskApiRes.status === 201, "REMINDER-SYNC-014: Task created via API");
    const taskReminders = await Reminder.find({ sourceType: "task", sourceId: taskApiRes.body.task._id });
    assert(taskReminders.length === 1, "REMINDER-SYNC-015: Synchronized reminder created for task assignee");

    const taskDeleteRes = await request(app)
      .delete(`/api/tasks/${taskApiRes.body.task._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(taskDeleteRes.status === 200, "REMINDER-SYNC-016: Task deleted via API");
    const postDeleteTaskReminders = await Reminder.countDocuments({ sourceType: "task", sourceId: taskApiRes.body.task._id });
    assert(postDeleteTaskReminders === 0, "REMINDER-SYNC-017: Cascade delete removed reminder when task was deleted");

    // 7. End-to-end route testing: CalendarEvent call_reminder creation and deletion via API
    const eventApiRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "📞 Call with Client Calendar",
        type: "call_reminder",
        start: testScheduledAt.toISOString(),
        assignedTo: [userA._id.toString(), userB._id.toString()],
        description: "Calendar sync test",
      });
    assert(eventApiRes.status === 201, "REMINDER-SYNC-018: Calendar call_reminder event created via API");
    const eventReminders = await Reminder.find({ sourceType: "event", sourceId: eventApiRes.body.event._id });
    assert(eventReminders.length === 2, "REMINDER-SYNC-019: Multi-assignee calendar event created 2 reminder docs");

    const eventDeleteRes = await request(app)
      .delete(`/api/calendar/events/${eventApiRes.body.event._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(eventDeleteRes.status === 200, "REMINDER-SYNC-020: Calendar event deleted via API");
    const postDeleteEventReminders = await Reminder.countDocuments({ sourceType: "event", sourceId: eventApiRes.body.event._id });
    assert(postDeleteEventReminders === 0, "REMINDER-SYNC-021: Cascade delete removed reminders when calendar event was deleted");
  }

  // =========================================================================
  // SUITE 18: CLIENT ↔ CASE ↔ DOCUMENT LINKAGE & ACCESS CONTROL (BOLA)
  // =========================================================================
  console.log("\n--- Suite 18: Client ↔ Case ↔ Document Linkage & Access Control (BOLA) ---");
  {
    const adminUser = await createUser({ name: "Suite 18 Admin", email: "s18admin@test.com", role: "admin" });
    const adminToken = await createToken(adminUser);

    const advocateA = await createUser({
      name: "Advocate Alice",
      email: "alice18@test.com",
      role: "senior_advocate",
      permissions: { clients: true, cases: true, documents: true },
    });
    const tokenA = await createToken(advocateA);

    const advocateB = await createUser({
      name: "Advocate Bob",
      email: "bob18@test.com",
      role: "junior_advocate",
      permissions: { clients: true, cases: true, documents: true },
    });
    const tokenB = await createToken(advocateB);

    // 1. Create client A (assigned to advocateA) and client B (assigned to advocateB)
    const clientA = await Client.create({
      name: "Apex Global Corp",
      type: "Corporate",
      tag: "VIP",
      phone: "+91 9876543210",
      email: "legal@apexcorp.com",
      assignedTo: [advocateA._id],
      createdBy: adminUser._id,
      kyc: "Verified",
    });

    const clientB = await Client.create({
      name: "Beta Logistics Ltd",
      type: "Corporate",
      tag: "Active",
      phone: "+91 9123456780",
      email: "contact@betalogistics.com",
      assignedTo: [advocateB._id],
      createdBy: adminUser._id,
      kyc: "Verified",
    });

    // 2. Create case A linked to client A via parties
    const caseARes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Apex vs Stellar Arbitrations",
        practice: "Arbitration",
        status: "Active",
        assignedTo: advocateA._id.toString(),
        parties: [
          {
            name: "Apex Global Corp",
            role: "Claimant",
            type: "client",
            clientId: clientA._id.toString(),
          },
          {
            name: "Stellar Arbitrations Ltd",
            role: "Respondent",
            type: "opposing_party",
          },
        ],
      });
    assert(caseARes.status === 201, "CLIENT-LINK-001: Case A created with valid clientId party");
    const caseAId = caseARes.body.case._id;
    assert(caseARes.body.case.parties[0].clientId === clientA._id.toString(), "CLIENT-LINK-002: Case parties contains linked clientId");

    // 3. Client cases retrieval
    const clientACasesRes = await request(app)
      .get(`/api/clients/${clientA._id}/cases`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(clientACasesRes.status === 200, "CLIENT-LINK-003: Authorized advocate A retrieves client A's cases");
    assert(clientACasesRes.body.cases.length === 1, "CLIENT-LINK-004: Client A cases contains case A");
    assert(clientACasesRes.body.cases[0]._id === caseAId, "CLIENT-LINK-005: Returned case matches case A ID");

    // 4. Unauthorized user cannot access other client's cases (BOLA)
    const unauthClientCasesRes = await request(app)
      .get(`/api/clients/${clientA._id}/cases`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(unauthClientCasesRes.status === 403, "CLIENT-LINK-006: Unauthorized advocate B is forbidden from client A cases (403)");

    // 5. Invalid & Nonexistent client ID validation
    const invalidCidRes = await request(app)
      .get("/api/clients/invalid-format-id/cases")
      .set("Authorization", `Bearer ${adminToken}`);
    assert(invalidCidRes.status === 400, "CLIENT-LINK-007: Invalid client ID format returns 400 Bad Request");

    const nonExistentCid = new mongoose.Types.ObjectId();
    const notFoundCidRes = await request(app)
      .get(`/api/clients/${nonExistentCid}/cases`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(notFoundCidRes.status === 404, "CLIENT-LINK-008: Nonexistent client ID returns 404 Not Found");

    // 6. Case creation validation for invalid and nonexistent clientId
    const invalidPartyCaseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Invalid Client Case",
        parties: [{ name: "Test Party", role: "Client", type: "client", clientId: "not-a-mongo-id" }],
      });
    assert(invalidPartyCaseRes.status === 400, "CLIENT-LINK-009: Creating case with invalid clientId format rejected with 400");

    const nonExistentPartyCaseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Nonexistent Client Case",
        parties: [{ name: "Test Party", role: "Client", type: "client", clientId: nonExistentCid.toString() }],
      });
    assert(nonExistentPartyCaseRes.status === 400, "CLIENT-LINK-010: Creating case with nonexistent clientId rejected with 400");

    // 7. Case update (PATCH /api/cases/:id) validation for parties
    const patchInvalidCaseRes = await request(app)
      .patch(`/api/cases/${caseAId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        parties: [{ name: "Test Party", role: "Client", type: "client", clientId: "not-valid-id" }],
      });
    assert(patchInvalidCaseRes.status === 400, "CLIENT-LINK-011: Updating case with invalid clientId format rejected with 400");

    // 8. Documents: Upload document linked to case A
    const uploadDocRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Apex Arbitration Agreement.pdf")
      .attach("file", Buffer.from("%PDF-1.4 test document content"), "Apex Arbitration Agreement.pdf");
    assert(uploadDocRes.status === 201, "CLIENT-LINK-012: Document uploaded to case A by advocate A");
    const docA = uploadDocRes.body.document;
    assert(docA.caseId === caseAId, "CLIENT-LINK-013: Document has caseId set");
    assert(docA.clientId === clientA._id.toString(), "CLIENT-LINK-014: Document inherited clientId from case client party");
    assert(!docA.filePath && !docA.nasPath, "CLIENT-LINK-015: Document response stripped physical filesystem paths");

    // 9. Document appears in Client A's documents
    const clientDocsRes = await request(app)
      .get(`/api/clients/${clientA._id}/documents`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(clientDocsRes.status === 200, "CLIENT-LINK-016: Authorized advocate A retrieves client A's documents");
    assert(clientDocsRes.body.documents.length === 1, "CLIENT-LINK-017: Client A documents list includes uploaded document");
    assert(clientDocsRes.body.documents[0]._id === docA._id, "CLIENT-LINK-018: Returned document ID matches doc A");

    // 10. Document BOLA: Advocate B cannot access Client A's documents
    const unauthClientDocsRes = await request(app)
      .get(`/api/clients/${clientA._id}/documents`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(unauthClientDocsRes.status === 403, "CLIENT-LINK-019: Unauthorized advocate B is forbidden from client A documents (403)");

    // 11. Search BOLA verification: Case A and Doc A appear for advocate A, but NOT for advocate B
    const searchAliceRes = await request(app)
      .get("/api/search?q=Apex")
      .set("Authorization", `Bearer ${tokenA}`);
    assert(searchAliceRes.status === 200, "CLIENT-LINK-020: Search executes successfully for advocate A");
    const aliceCaseHits = (searchAliceRes.body.cases || []).filter((c: any) => c.title.includes("Apex"));
    assert(aliceCaseHits.length >= 1, "CLIENT-LINK-021: Advocate A finds case A in search results");

    const searchBobRes = await request(app)
      .get("/api/search?q=Apex")
      .set("Authorization", `Bearer ${tokenB}`);
    assert(searchBobRes.status === 200, "CLIENT-LINK-022: Search executes successfully for advocate B");
    const bobCaseHits = (searchBobRes.body.cases || []).filter((c: any) => c.title.includes("Apex"));
    const bobDocHits = (searchBobRes.body.documents || []).filter((d: any) => d.name.includes("Apex"));
    assert(bobCaseHits.length === 0, "CLIENT-LINK-023: Advocate B cannot find isolated case A via search (BOLA)");
    assert(bobDocHits.length === 0, "CLIENT-LINK-024: Advocate B cannot find isolated doc A via search (BOLA)");

    // 12. Direct client document upload (document with explicit clientId)
    const directDocRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("clientId", clientA._id.toString())
      .field("name", "Apex Incorporation Certificate.pdf")
      .attach("file", Buffer.from("%PDF-1.4 incorporation cert"), "Apex Incorporation Certificate.pdf");
    assert(directDocRes.status === 201, "CLIENT-LINK-025: Direct document uploaded to client A");
    assert(directDocRes.body.document.clientId === clientA._id.toString(), "CLIENT-LINK-026: Direct document has clientId set");

    // 13. Re-fetching client documents shows both documents
    const updatedClientDocsRes = await request(app)
      .get(`/api/clients/${clientA._id}/documents`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(updatedClientDocsRes.status === 200, "CLIENT-LINK-027: Re-fetch client documents succeeds");
    assert(updatedClientDocsRes.body.documents.length === 2, "CLIENT-LINK-028: Client A documents now contains both linked documents");
  }

  // =========================================================================
  // SUITE 19: Universal Document Preview & Actions + Client-Case Document Sync
  // =========================================================================
  console.log("\n--- Suite 19: Universal Document Preview & Actions + Client-Case Sync ---");
  {
    const advocate19A = await createUser({
      name: "Advocate S19 Alice",
      email: "alice19@test.com",
      role: "senior_advocate",
      permissions: { clients: true, cases: true, documents: true },
    });
    const tokenA = await createToken(advocate19A);

    const advocate19B = await createUser({
      name: "Advocate S19 Bob",
      email: "bob19@test.com",
      role: "junior_advocate",
      permissions: { clients: true, cases: true, documents: true },
    });
    const tokenB = await createToken(advocate19B);

    const clientA = await Client.create({
      name: "Acme Corporation S19",
      type: "Corporate",
      tag: "VIP",
      phone: "+91 9888877777",
      email: "legal@acmes19.com",
      assignedTo: [advocate19A._id],
      createdBy: advocate19A._id,
      kyc: "Verified",
    });

    const case19ARes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Acme Arbitration S19",
        parties: [
          {
            name: "Acme Corporation S19",
            role: "Claimant",
            type: "client",
            clientId: clientA._id.toString(),
          },
        ],
      });
    assert(case19ARes.status === 201, "PREVIEW-INIT-001: Initial case created for preview tests");
    const caseAId = case19ARes.body.case._id;

    // 1. Authorized PDF preview returns 200 with application/pdf and inline disposition
    const pdfUploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Summary Judgment Motion.pdf")
      .attach("file", Buffer.from("%PDF-1.4 Mock PDF Content"), "Summary Judgment Motion.pdf");
    assert(pdfUploadRes.status === 201, "PREVIEW-001: PDF uploaded successfully");
    const pdfDoc = pdfUploadRes.body.document;

    const pdfViewRes = await request(app)
      .get(`/api/documents/${pdfDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(pdfViewRes.status === 200, "PREVIEW-002: Authorized user gets 200 on PDF preview");
    assert(pdfViewRes.headers["content-type"].includes("application/pdf"), "PREVIEW-003: PDF content-type matches application/pdf");
    assert(pdfViewRes.headers["content-disposition"]?.includes("inline"), "PREVIEW-004: PDF served with inline disposition");
    assert(pdfViewRes.headers["x-content-type-options"] === "nosniff", "PREVIEW-005: X-Content-Type-Options: nosniff present");

    // 2. Unauthorized user cannot preview PDF (BOLA)
    const unauthPdfViewRes = await request(app)
      .get(`/api/documents/${pdfDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(unauthPdfViewRes.status === 403, "PREVIEW-006: Unauthorized advocate B is denied PDF preview with 403 (BOLA)");

    // 3. Image preview returns 200 with image/png and inline disposition
    const imgUploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Evidence Site Photo.png")
      .attach("file", Buffer.from("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), "Evidence Site Photo.png");
    assert(imgUploadRes.status === 201, "PREVIEW-007: Image uploaded successfully");
    const imgDoc = imgUploadRes.body.document;

    const imgViewRes = await request(app)
      .get(`/api/documents/${imgDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(imgViewRes.status === 200, "PREVIEW-008: Authorized user gets 200 on Image preview");
    assert(imgViewRes.headers["content-type"].includes("image/png"), "PREVIEW-009: Image content-type matches image/png");
    assert(imgViewRes.headers["content-disposition"]?.includes("inline"), "PREVIEW-010: Image served with inline disposition");

    // 4. Text/CSV preview returns 200 with text/plain or text/csv and inline disposition
    const txtUploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Witness Statement Notes.txt")
      .attach("file", Buffer.from("Witness statement recorded on 2026-03-31."), "Witness Statement Notes.txt");
    assert(txtUploadRes.status === 201, "PREVIEW-011: Text document uploaded successfully");
    const txtDoc = txtUploadRes.body.document;

    const txtViewRes = await request(app)
      .get(`/api/documents/${txtDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(txtViewRes.status === 200, "PREVIEW-012: Authorized user gets 200 on text preview");
    assert(txtViewRes.headers["content-disposition"]?.includes("inline"), "PREVIEW-013: Text document served with inline disposition");

    // 5. Unsupported binary / ZIP returns Content-Disposition: attachment
    const zipUploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Archive Evidence.zip")
      .attach("file", Buffer.from("PK\x03\x04mock zip content"), "Archive Evidence.zip");
    assert(zipUploadRes.status === 201, "PREVIEW-014: ZIP archive uploaded successfully");
    const zipDoc = zipUploadRes.body.document;

    const zipViewRes = await request(app)
      .get(`/api/documents/${zipDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(zipViewRes.status === 200, "PREVIEW-015: Unsupported file stream returns 200");
    assert(zipViewRes.headers["content-disposition"]?.includes("attachment"), "PREVIEW-016: Unsupported binary served with attachment disposition");

    // 6. Dangerous/executable content defense-in-depth:
    // 6a. Upload-level defense: validateMimeType strictly rejects HTML / SVG / JS
    const htmlCheck = validateMimeType("text/html");
    const svgCheck = validateMimeType("image/svg+xml");
    const jsCheck = validateMimeType("application/javascript");
    assert(!htmlCheck.valid, "PREVIEW-017a: MIME validation rejects text/html");
    assert(!svgCheck.valid, "PREVIEW-017b: MIME validation rejects image/svg+xml");
    assert(!jsCheck.valid, "PREVIEW-017c: MIME validation rejects application/javascript");

    // 6b. View endpoint defense-in-depth: if a document record has a dangerous MIME type,
    // /view strictly forces attachment disposition and application/octet-stream content-type
    const storedPdf = await DocumentModel.findById(pdfDoc._id);
    const dangerousDoc = await DocumentModel.create({
      name: "Legacy Report.html",
      originalName: "Legacy Report.html",
      mimeType: "text/html",
      size: storedPdf!.size,
      sizeFormatted: storedPdf!.sizeFormatted,
      caseId: caseAId,
      uploadedBy: advocate19A._id,
      state: "Approved",
      nasPath: storedPdf!.nasPath,
    });

    const dangerousViewRes = await request(app)
      .get(`/api/documents/${dangerousDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(dangerousViewRes.status === 200, "PREVIEW-018: Dangerous document view returns 200 stream");
    assert(dangerousViewRes.headers["content-disposition"]?.includes("attachment"), "PREVIEW-019: Dangerous MIME forced to attachment disposition (zero inline XSS)");
    assert(dangerousViewRes.headers["content-type"].includes("application/octet-stream"), "PREVIEW-020: Dangerous HTML MIME type replaced with application/octet-stream");

    // 7. Versioning: Upload a new version of Summary Judgment Motion.pdf
    const v2UploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("caseId", caseAId)
      .field("name", "Summary Judgment Motion.pdf")
      .attach("file", Buffer.from("%PDF-1.4 Mock PDF Content Version 2"), "Summary Judgment Motion.pdf");
    assert(v2UploadRes.status === 201, "PREVIEW-021: New version of document uploaded successfully");
    const v2Doc = v2UploadRes.body.document;
    assert(v2Doc.version === 2, "PREVIEW-022: Uploaded document has version incremented to 2");

    // 8. Version history listing and authorization
    const versionsRes = await request(app)
      .get(`/api/documents/${pdfDoc._id}/versions`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(versionsRes.status === 200, "PREVIEW-023: Authorized user retrieves version history");
    assert(versionsRes.body.count === 2, "PREVIEW-024: Version history contains both versions");
    assert(versionsRes.body.versions[0].version === 2, "PREVIEW-025: Versions sorted newest first (version 2)");
    assert(versionsRes.body.versions[1].version === 1, "PREVIEW-026: Version 1 present in history");
    assert(!versionsRes.body.versions[0].nasPath && !versionsRes.body.versions[0].filePath, "PREVIEW-027: Storage paths omitted from version objects");

    // 9. Version preview authorization: Authorized user can preview historical v1
    const v1ViewRes = await request(app)
      .get(`/api/documents/${pdfDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(v1ViewRes.status === 200, "PREVIEW-028: Authorized user can preview historical version 1");

    // 10. Version preview denied for unauthorized user (BOLA)
    const unauthV1ViewRes = await request(app)
      .get(`/api/documents/${pdfDoc._id}/view`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert(unauthV1ViewRes.status === 403, "PREVIEW-029: Unauthorized user denied preview of historical version with 403");

    // 11. Deleted document cannot be previewed (returns 404)
    const deleteDocRes = await request(app)
      .delete(`/api/documents/${v2Doc._id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(deleteDocRes.status === 200, "PREVIEW-030: Document deleted successfully by uploader");

    const deletedDocViewRes = await request(app)
      .get(`/api/documents/${v2Doc._id}/view`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert(deletedDocViewRes.status === 404 || deletedDocViewRes.status === 403, "PREVIEW-031: Deleted document cannot be previewed (returns 404 or 403)");

    // 12. Client-Case Synchronization (Part A verification):
    // Direct client document uploaded directly to Client A with no caseId
    const directDocRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${tokenA}`)
      .field("clientId", clientA._id.toString())
      .field("name", "Direct S19 Certificate.pdf")
      .attach("file", Buffer.from("%PDF-1.4 direct cert"), "Direct S19 Certificate.pdf");
    assert(directDocRes.status === 201, "PREVIEW-032: Direct client document uploaded");

    // Create Client B
    const clientB = await Client.create({
      name: "Beacon Maritime Corp S19",
      type: "Corporate",
      tag: "Active",
      kyc: "Verified",
      createdBy: advocate19A._id,
    });

    // Update Case A's primary client party to Client B
    const patchCasePartyRes = await request(app)
      .patch(`/api/cases/${caseAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        parties: [
          {
            name: "Beacon Maritime Corp S19",
            role: "Claimant",
            type: "client",
            clientId: clientB._id.toString(),
          },
          {
            name: "Stellar Arbitrations Ltd",
            role: "Respondent",
            type: "opposing_party",
          },
        ],
      });
    assert(patchCasePartyRes.status === 200, "CLIENT-SYNC-001: Case A client party updated to Client B");

    // Existing case document (pdfDoc) belonging to Case A should now have clientId synchronized to Client B
    const syncedDoc = await DocumentModel.findById(pdfDoc._id);
    assert(syncedDoc?.clientId?.toString() === clientB._id.toString(), "CLIENT-SYNC-002: Existing case document automatically updated clientId to Client B");

    // Direct client document was uploaded directly to Client A with no caseId.
    // It MUST still belong to Client A!
    const directDocCheck = await DocumentModel.findById(directDocRes.body.document._id);
    assert(directDocCheck?.clientId?.toString() === clientA._id.toString(), "CLIENT-SYNC-003: Direct client document remains associated with Client A");
  }

  // ---------------------------------------------------------------------------
  // Suite 20: Phases 15–22 Verification (Task Validation, Broker/Agent, Admin Password Reset, Avatar Lifecycle)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 20: Phases 15–22 Verification ---");
  {
    // 1. Setup users: Admin and Employee
    const admin20 = await User.create({
      name: "Adv. Vikram Seth Admin",
      email: "admin20@stillworks.legal",
      passwordHash: await bcrypt.hash("AdminPass123!", 12),
      role: "admin",
      status: "online",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true, documents: true,
        calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });

    const emp20 = await User.create({
      name: "Adv. Ananya Rao Employee",
      email: "employee20@stillworks.legal",
      passwordHash: await bcrypt.hash("EmployeePass123!", 12),
      role: "junior_advocate",
      status: "online",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true, documents: true,
        calendar: true, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });

    const adminToken = await createToken(admin20);
    const empToken = await createToken(emp20);
    const empSession = await Session.findOne({ userId: emp20._id, isRevoked: false });
    assert(empSession !== null, "SETUP: empSession found for emp20");

    // 2. Task Validation tests
    // Empty title
    const emptyTitleRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ title: "   " });
    assert(emptyTitleRes.status === 400, "TASK-VAL-001: Reject task with empty title (400)");

    // Title exceeding 200 chars
    const longTitleRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ title: "A".repeat(201) });
    assert(longTitleRes.status === 400, "TASK-VAL-002: Reject task with title > 200 chars (400)");

    // Invalid priority
    const badPrioRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ title: "Valid Title", priority: "SuperUrgent" });
    assert(badPrioRes.status === 400, "TASK-VAL-003: Reject task with invalid priority (400)");

    // Agent name with HTML / script injection
    const xssAgentRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        title: "Broker Verification Task",
        agent: "<script>alert('xss')</script>Apex Legal Consultancy",
      });
    assert(xssAgentRes.status === 201, "TASK-VAL-004: Create task with sanitized agent name");
    assert(
      !xssAgentRes.body.task.agent.includes("<script>"),
      "TASK-VAL-005: HTML tags stripped from agent field"
    );

    // Filter tasks by agent
    const agentFilterRes = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .query({ agent: "Apex Legal Consultancy" });
    assert(agentFilterRes.status === 200, "TASK-VAL-006: Tasks list accepts agent query filter");
    assert(
      agentFilterRes.body.tasks.some((t: any) => t.agent === "Apex Legal Consultancy"),
      "TASK-VAL-007: Filtered tasks return matching agent"
    );

    // Search tasks by agent name
    const agentSearchRes = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .query({ search: "Apex Legal" });
    assert(agentSearchRes.status === 200, "TASK-VAL-008: Search query matches agent name");
    assert(
      agentSearchRes.body.tasks.some((t: any) => t._id === xssAgentRes.body.task._id),
      "TASK-VAL-009: Found created task in agent search"
    );

    // Invalid checklist item
    const badChecklistRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        title: "Checklist Task",
        checklist: [{ text: "   " }],
      });
    assert(badChecklistRes.status === 400, "TASK-VAL-010: Reject task with empty checklist item text (400)");

    // 3. Client Promised Completion Date Validation
    const badClientDateRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        name: "Acme Enterprises Client S20",
        type: "Corporate",
        promisedCompletionDate: "Not-A-Valid-Date-String",
      });
    assert(badClientDateRes.status === 400, "CLIENT-DATE-001: Reject client creation with invalid promisedCompletionDate (400)");

    const validClientDate = new Date("2026-12-31T00:00:00.000Z").toISOString();
    const goodClientRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        name: "Acme Enterprises Client S20",
        type: "Corporate",
        promisedCompletionDate: validClientDate,
      });
    assert(goodClientRes.status === 201, "CLIENT-DATE-002: Accept valid ISO promisedCompletionDate (201)");

    const badPatchClientRes = await request(app)
      .patch(`/api/clients/${goodClientRes.body.client._id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ promisedCompletionDate: "invalid-date-format" });
    assert(badPatchClientRes.status === 400, "CLIENT-DATE-003: Reject client patch with invalid promisedCompletionDate (400)");

    // 4. Admin Password Reset tests
    // Non-admin employee cannot reset password
    const unauthResetRes = await request(app)
      .post(`/api/admin/employees/${emp20._id}/reset-password`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ mode: "generate" });
    assert(unauthResetRes.status === 403, "ADMIN-RESET-001: Non-admin cannot reset employee password (403)");

    // Admin self-reset prevented
    const selfResetRes = await request(app)
      .post(`/api/admin/employees/${admin20._id}/reset-password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "generate" });
    assert(selfResetRes.status === 400, "ADMIN-RESET-002: Admin self-reset rejected (400)");

    // Reject manual password < 8 chars
    const shortPassRes = await request(app)
      .post(`/api/admin/employees/${emp20._id}/reset-password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "manual", newPassword: "short" });
    assert(shortPassRes.status === 400, "ADMIN-RESET-003: Reject manual password < 8 chars (400)");

    // Reset password with auto-generated temporary password
    const resetSuccessRes = await request(app)
      .post(`/api/admin/employees/${emp20._id}/reset-password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "generate" });
    assert(resetSuccessRes.status === 200, "ADMIN-RESET-004: Admin reset password returns 200");
    const tempPass = resetSuccessRes.body.temporaryPassword;
    assert(Boolean(tempPass && tempPass.length >= 16), "ADMIN-RESET-005: Temporary password returned with length >= 16");

    // Verify session was revoked
    const checkSession = await Session.findById(empSession!._id);
    assert(checkSession?.isRevoked === true, "ADMIN-RESET-006: Employee active sessions revoked on password reset");

    // Employee logs in with the new temporary password
    const loginTempRes = await request(app)
      .post("/api/auth/login")
      .send({ email: emp20.email, password: tempPass });
    assert(loginTempRes.status === 200, "ADMIN-RESET-007: Employee successfully signs in with temporary password");
    const newEmpToken = loginTempRes.body.accessToken;

    // 5. Avatar Lifecycle tests
    // Reject invalid MIME type
    const badMimeRes = await request(app)
      .post("/api/auth/avatar")
      .set("Authorization", `Bearer ${newEmpToken}`)
      .attach("file", Buffer.from("not an image"), { filename: "test.txt", contentType: "text/plain" });
    assert(badMimeRes.status === 400, "AVATAR-001: Reject avatar with invalid MIME type (400)");

    // Upload valid JPEG avatar
    const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
    const uploadAvatarRes = await request(app)
      .post("/api/auth/avatar")
      .set("Authorization", `Bearer ${newEmpToken}`)
      .attach("file", validJpgBuffer, { filename: "avatar.jpg", contentType: "image/jpeg" });
    assert(uploadAvatarRes.status === 200, "AVATAR-002: Avatar uploaded successfully (200)");
    const avatarUrl = uploadAvatarRes.body.avatarUrl;
    assert(Boolean(avatarUrl && avatarUrl.startsWith("/api/auth/avatar/")), "AVATAR-003: avatarUrl returned in response");

    // Stream uploaded avatar
    const avatarFilename = avatarUrl.replace("/api/auth/avatar/", "");
    const streamAvatarRes = await request(app).get(`/api/auth/avatar/${avatarFilename}`);
    assert(streamAvatarRes.status === 200, "AVATAR-004: Avatar streamed successfully");
    assert(streamAvatarRes.headers["content-type"]?.includes("image/jpeg"), "AVATAR-005: Avatar content-type is image/jpeg");

    // Reject path traversal attempt
    const traversalAvatarRes = await request(app).get(`/api/auth/avatar/..%2f..%2fpackage.json`);
    assert(traversalAvatarRes.status === 400 || traversalAvatarRes.status === 404, "AVATAR-006: Avatar traversal attempt rejected (400 or 404)");

    // Delete avatar
    const deleteAvatarRes = await request(app)
      .delete("/api/auth/avatar")
      .set("Authorization", `Bearer ${newEmpToken}`);
    assert(deleteAvatarRes.status === 200, "AVATAR-007: Avatar removed successfully (200)");
    const empAfterDelete = await User.findById(emp20._id);
    assert(empAfterDelete?.avatarUrl === "", "AVATAR-008: user.avatarUrl cleared in database");

    // =========================================================================
    // Suite 21: Forensic Verification — Parties, JSON 404 & Anti-Enumeration
    // =========================================================================
    console.log("\n--- Suite 21: Forensic Verification (Parties, 404, Anti-Enumeration) ---");

    // 1. Anti-Enumeration on Login
    const nonExistentLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doesnotexist@nowhere.legal", password: "wrongpassword123" });
    assert(nonExistentLoginRes.status === 401, "AUTH-ENUM-001: Nonexistent user returns 401");
    assert(nonExistentLoginRes.body.code === "INVALID_CREDENTIALS", "AUTH-ENUM-002: Nonexistent user returns generic INVALID_CREDENTIALS code");
    assert(nonExistentLoginRes.body.message.includes("Invalid email or password"), "AUTH-ENUM-003: Nonexistent user returns generic message");

    const wrongPassLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: emp20.email, password: "definitelywrongpassword" });
    assert(wrongPassLoginRes.status === 401, "AUTH-ENUM-004: Wrong password returns 401");
    assert(wrongPassLoginRes.body.code === "INVALID_CREDENTIALS", "AUTH-ENUM-005: Wrong password returns identical INVALID_CREDENTIALS code");
    assert(wrongPassLoginRes.body.message === nonExistentLoginRes.body.message, "AUTH-ENUM-006: Missing user and wrong password return identical messages");

    // 2. Global JSON 404
    const notFoundApiRes = await request(app).get("/api/forensic-nonexistent-route");
    assert(notFoundApiRes.status === 404, "API-404-001: Unmatched API route returns 404");
    assert(notFoundApiRes.headers["content-type"]?.includes("application/json"), "API-404-002: Unmatched API route returns JSON");
    assert(notFoundApiRes.body.message === "API endpoint not found", "API-404-003: Unmatched API route body contains standard message");

    // 3. Case Party Management & Client Linkage
    const partyCaseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Forensic Case Suite 21", practice: "Corporate" });
    assert(partyCaseRes.status === 201, "CASE-PARTY-001: Case created for party tests");
    const testCase21Id = partyCaseRes.body.case._id;

    // Document created under this case before client party is added
    const preDoc = await DocumentModel.create({
      name: "Pre-party Agreement.pdf",
      originalName: "Pre-party Agreement.pdf",
      caseId: testCase21Id,
      uploadedBy: admin20._id,
      storagePath: `/Cases/SW-2026-Forensic/Pre-party Agreement.pdf`,
    });
    assert(!preDoc.clientId, "CASE-PARTY-002: Pre-party document initially has no clientId");

    // Invalid clientId format in POST /api/cases/:id/parties
    const badClientFormatPartyRes = await request(app)
      .post(`/api/cases/${testCase21Id}/parties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Invalid Client Party", role: "Petitioner", clientId: "invalid-id" });
    assert(badClientFormatPartyRes.status === 400, "CASE-PARTY-003: Reject invalid clientId format in add party (400)");

    // Nonexistent clientId in POST /api/cases/:id/parties
    const fakeClientId = new mongoose.Types.ObjectId().toString();
    const fakeClientPartyRes = await request(app)
      .post(`/api/cases/${testCase21Id}/parties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fake Client Party", role: "Petitioner", clientId: fakeClientId });
    assert(fakeClientPartyRes.status === 400, "CASE-PARTY-004: Reject nonexistent clientId in add party (400)");

    // Add valid client party
    const validClientPartyRes = await request(app)
      .post(`/api/cases/${testCase21Id}/parties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: goodClientRes.body.client.name,
        role: "Primary Claimant",
        type: "client",
        clientId: goodClientRes.body.client._id,
      });
    assert(validClientPartyRes.status === 200, "CASE-PARTY-005: Valid client party added successfully (200)");
    const updatedCaseParties = validClientPartyRes.body.case.parties;
    const addedParty = updatedCaseParties.find((p: any) => p.name === goodClientRes.body.client.name);
    assert(Boolean(addedParty && addedParty._id), "CASE-PARTY-006: Added party has valid subdocument _id");

    // Verify DocumentModel was synchronized with the new client party
    const refreshedDoc = await DocumentModel.findById(preDoc._id);
    assert(refreshedDoc?.clientId?.toString() === goodClientRes.body.client._id.toString(), "CASE-PARTY-007: Case document synchronized clientId from added party");

    // Remove party: nonexistent party returns 404
    const fakePartyDeleteRes = await request(app)
      .delete(`/api/cases/${testCase21Id}/parties/nonexistent-party-id`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(fakePartyDeleteRes.status === 404, "CASE-PARTY-008: Reject nonexistent partyId with 404");

    // Remove the valid party
    const partyDeleteRes = await request(app)
      .delete(`/api/cases/${testCase21Id}/parties/${addedParty._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(partyDeleteRes.status === 200, "CASE-PARTY-009: Party removed successfully (200)");
    const caseAfterPartyRemoval = partyDeleteRes.body.case;
    const partyStillExists = (caseAfterPartyRemoval.parties || []).some((p: any) => p._id.toString() === addedParty._id.toString());
    assert(!partyStillExists, "CASE-PARTY-010: Party confirmed absent from case after deletion");

    // Timeline entry added for party removal
    const lastTimeline = caseAfterPartyRemoval.timeline[caseAfterPartyRemoval.timeline.length - 1];
    assert(lastTimeline?.event?.includes("Removed party"), "CASE-PARTY-011: Timeline event recorded for removed party");
  }

  // =========================================================================
  // Suite 22: Token Refresh Concurrency, Web Cookie Auth & Security Policy
  // =========================================================================
  {
    console.log("\n--- Suite 22: Token Refresh Concurrency, Web Cookie Auth & Security Policy ---");

    // Create a fresh dedicated test user for auth concurrency testing
    const authTestUser = await createUser({
      name: "Concurrency Test Advocate",
      email: "concurrency.test@stillworks.in",
      passwordHash: await bcrypt.hash("Password123!", 10),
    });

    // 1. Electron login returns refreshToken in body
    const electronLoginRes = await request(app)
      .post("/api/auth/login")
      .set("x-client-type", "electron")
      .send({ email: authTestUser.email, password: "SecurePass1!" });
    assert(electronLoginRes.status === 200, "AUTH-CONCURR-001: Electron login succeeds (200)");
    assert(Boolean(electronLoginRes.body.accessToken), "AUTH-CONCURR-002: Electron login returns accessToken");
    assert(Boolean(electronLoginRes.body.refreshToken), "AUTH-CONCURR-003: Electron login returns refreshToken in JSON body");
    const initialRefreshToken = electronLoginRes.body.refreshToken;

    // 2. Web login does NOT return refreshToken in body, but sets HttpOnly cookie
    const webLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: authTestUser.email, password: "SecurePass1!" });
    assert(webLoginRes.status === 200, "AUTH-CONCURR-004: Web login succeeds (200)");
    assert(Boolean(webLoginRes.body.accessToken), "AUTH-CONCURR-005: Web login returns accessToken");
    assert(!webLoginRes.body.refreshToken, "AUTH-CONCURR-006: Web login NEVER exposes refreshToken in JSON body");
    const rawCookies = webLoginRes.headers["set-cookie"];
    const setCookieHeader = Array.isArray(rawCookies) ? rawCookies.join("; ") : String(rawCookies || "");
    assert(setCookieHeader.includes("stillworks_refresh="), "AUTH-CONCURR-007: Web login sets stillworks_refresh cookie");
    assert(setCookieHeader.toLowerCase().includes("httponly"), "AUTH-CONCURR-008: Refresh cookie has HttpOnly flag");

    // 3. Test A: Two simultaneous refresh requests using the same valid token
    const [resA1, resA2] = await Promise.all([
      request(app)
        .post("/api/auth/refresh")
        .set("x-client-type", "electron")
        .send({ refreshToken: initialRefreshToken }),
      request(app)
        .post("/api/auth/refresh")
        .set("x-client-type", "electron")
        .send({ refreshToken: initialRefreshToken }),
    ]);
    assert(resA1.status === 200, "AUTH-CONCURR-TEST-A1: First concurrent refresh succeeds (200)");
    assert(resA2.status === 200, "AUTH-CONCURR-TEST-A2: Second concurrent refresh succeeds (200)");
    assert(Boolean(resA1.body.accessToken && resA2.body.accessToken), "AUTH-CONCURR-TEST-A3: Both concurrent requests return valid accessToken");

    // Verify both returned access tokens can access /me (user remains authenticated)
    const meRes1 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${resA1.body.accessToken}`);
    const meRes2 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${resA2.body.accessToken}`);
    assert(meRes1.status === 200 && meRes2.status === 200, "AUTH-CONCURR-TEST-A4: Both returned access tokens allow authenticated access");

    // The newer token returned from rotation
    const rotatedToken = resA1.body.refreshToken || resA2.body.refreshToken;
    assert(Boolean(rotatedToken), "AUTH-CONCURR-TEST-A5: Standard rotation issued new refresh token");

    // 4. Test B: Multiple concurrent refresh requests (e.g. 5 tabs refreshing simultaneously)
    const multiRefreshResults = await Promise.all([
      request(app).post("/api/auth/refresh").set("x-client-type", "electron").send({ refreshToken: rotatedToken }),
      request(app).post("/api/auth/refresh").set("x-client-type", "electron").send({ refreshToken: rotatedToken }),
      request(app).post("/api/auth/refresh").set("x-client-type", "electron").send({ refreshToken: rotatedToken }),
      request(app).post("/api/auth/refresh").set("x-client-type", "electron").send({ refreshToken: rotatedToken }),
      request(app).post("/api/auth/refresh").set("x-client-type", "electron").send({ refreshToken: rotatedToken }),
    ]);
    const allSuccessful = multiRefreshResults.every((r) => r.status === 200 && Boolean(r.body.accessToken));
    assert(allSuccessful, "AUTH-CONCURR-TEST-B1: All 5 concurrent refresh requests succeeded (200) without random logout");

    // Pick active token from latest successful rotation
    const latestRotated = multiRefreshResults.find((r) => Boolean(r.body.refreshToken))?.body.refreshToken;
    assert(Boolean(latestRotated), "AUTH-CONCURR-TEST-B2: Active refresh token preserved across concurrent execution");

    // 5. Test C: Old refresh token used after the configured grace period (>60s)
    // Create dedicated user to isolate grace period & theft testing
    const theftTestUser = await createUser({
      name: "Theft Test Advocate",
      email: "theft.test@stillworks.in",
    });

    const theftLoginRes = await request(app)
      .post("/api/auth/login")
      .set("x-client-type", "electron")
      .send({ email: theftTestUser.email, password: "SecurePass1!" });
    const theftInitialRefresh = theftLoginRes.body.refreshToken;

    // Rotate once to generate previousRefreshTokenHash
    const firstRotateRes = await request(app)
      .post("/api/auth/refresh")
      .set("x-client-type", "electron")
      .send({ refreshToken: theftInitialRefresh });
    assert(firstRotateRes.status === 200, "AUTH-CONCURR-TEST-C1: Initial rotation succeeds (200)");

    // Find the session and artificially set rotatedAt to 65 seconds in the past
    const sessionDoc = await Session.findOne({ userId: theftTestUser._id, isRevoked: false });
    assert(Boolean(sessionDoc && sessionDoc.previousRefreshTokenHash), "AUTH-CONCURR-TEST-C2: Session has recorded previousRefreshTokenHash");

    if (sessionDoc) {
      await Session.updateOne(
        { _id: sessionDoc._id },
        { $set: { rotatedAt: new Date(Date.now() - 65_000) } }
      );
    }

    // Now attempt to refresh using the initial token (predecessor) after grace period expired
    const expiredGraceRes = await request(app)
      .post("/api/auth/refresh")
      .set("x-client-type", "electron")
      .send({ refreshToken: theftInitialRefresh });
    assert(expiredGraceRes.status === 401, "AUTH-CONCURR-TEST-C3: Refresh using expired grace period token is rejected (401)");
    assert(expiredGraceRes.body.message === "Invalid or expired refresh token", "AUTH-CONCURR-TEST-C4: Rejected with standard invalid token message");

    // 6. Test D: Refresh-token reuse/theft detection revokes entire session family
    // Verify that session family for this user was revoked upon attempted replay
    const userActiveSessions = await Session.find({ userId: theftTestUser._id, isRevoked: false });
    assert(userActiveSessions.length === 0, "AUTH-CONCURR-TEST-D1: Session family fully revoked after reuse attempt");
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch {}
  await mongoose.disconnect();
  if (mongod) await mongod.stop();

  console.log(`\n========================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
