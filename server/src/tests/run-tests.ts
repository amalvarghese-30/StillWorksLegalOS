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
const { Notification } = await import("../models/Notification.js");
const { NotificationService } = await import("../services/notifications.js");
const { Reminder } = await import("../models/Reminder.js");
const { CalendarEvent } = await import("../models/CalendarEvent.js");
const { HearingRecord } = await import("../models/HearingRecord.js");
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
const { default: categoriesRoutes } = await import("../routes/categories.js");
const { default: gmailRoutes } = await import("../routes/gmail.js");
const { default: approvalsRoutes } = await import("../routes/approvals.js");
const { ApprovalRequest } = await import("../models/ApprovalRequest.js");
const { Category } = await import("../models/Category.js");
const { TaskReminderState } = await import("../models/TaskReminderState.js");
const { seedCategories } = await import("../scripts/seedCategories.js");
const { ChatGroup, ChatMessage } = await import("../models/Chat.js");
const { getLocalPath } = await import("../services/storage.js");
const { DocumentModel } = await import("../models/Document.js");
const { AuditLog } = await import("../models/AuditLog.js");
const { processDueReminders } = await import("../services/reminderScheduler.js");
const { syncCallReminders, deleteCallReminders } = await import("../services/reminders.js");
const { validateMimeType } = await import("../services/nas.js");
const { presenceService } = await import("../services/presence.js");
const { requireAuth } = await import("../middleware/auth.js");

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
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/gmail", gmailRoutes);
  app.use("/api/approvals", approvalsRoutes);
  app.use("/api/reminders", remindersRoutes);
  app.use("/api/documents", documentsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/search", searchRoutes);

  app.get("/api/presence", requireAuth, (_req, res) => {
    res.json({ presence: presenceService.getLivePresenceMap() });
  });

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

    // 6. Admin Avatar Upload & Management tests
    // Admin uploads own avatar
    const adminUploadRes = await request(app)
      .post("/api/auth/avatar")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", validJpgBuffer, { filename: "admin_avatar.jpg", contentType: "image/jpeg" });
    assert(adminUploadRes.status === 200, "AVATAR-ADM-001: Admin uploads own avatar successfully (200)");
    const adminAvatarUrl = adminUploadRes.body.avatarUrl;
    assert(Boolean(adminAvatarUrl && adminAvatarUrl.startsWith("/api/auth/avatar/")), "AVATAR-ADM-002: admin avatarUrl returned in response");

    // Admin uploads avatar for an employee
    const adminEmpAvatarRes = await request(app)
      .post(`/api/admin/employees/${emp20._id}/avatar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", validJpgBuffer, { filename: "emp_avatar.jpg", contentType: "image/jpeg" });
    assert(adminEmpAvatarRes.status === 200, "AVATAR-ADM-003: Admin sets avatar for employee via /api/admin/employees/:id/avatar (200)");
    const empUpdated = await User.findById(emp20._id);
    assert(Boolean(empUpdated?.avatarUrl && empUpdated.avatarUrl.startsWith("/api/auth/avatar/")), "AVATAR-ADM-004: Employee record has updated avatarUrl");
    assert(empUpdated?.avatar === empUpdated?.avatarUrl, "AVATAR-ADM-005: Virtual avatar getter returns avatarUrl");

    // Employee cannot manage other employee's avatar without permission
    const unauthorizedAvatarRes = await request(app)
      .post(`/api/admin/employees/${emp20._id}/avatar`)
      .set("Authorization", `Bearer ${newEmpToken}`)
      .attach("file", validJpgBuffer, { filename: "unauth.jpg", contentType: "image/jpeg" });
    assert(unauthorizedAvatarRes.status === 403, "AVATAR-ADM-006: Unauthorized non-admin denied managing employee avatar (403)");

    // Admin removes employee avatar
    const adminDeleteEmpAvatarRes = await request(app)
      .delete(`/api/admin/employees/${emp20._id}/avatar`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert(adminDeleteEmpAvatarRes.status === 200, "AVATAR-ADM-007: Admin removes employee avatar successfully (200)");
    const empCleared = await User.findById(emp20._id);
    assert(empCleared?.avatarUrl === "", "AVATAR-ADM-008: Employee avatarUrl cleared after admin removal");

    // Chat users list returns avatarUrl
    const chatUsersRes = await request(app)
      .get("/api/chat/users")
      .set("Authorization", `Bearer ${adminToken}`);
    assert(chatUsersRes.status === 200, "AVATAR-CHAT-001: GET /api/chat/users succeeds (200)");
    assert(Array.isArray(chatUsersRes.body.users), "AVATAR-CHAT-002: Chat users returned as array");
    const adminChatUser = chatUsersRes.body.users.find((u: any) => u.email === admin20.email);
    assert(adminChatUser?.avatarUrl === adminAvatarUrl, "AVATAR-CHAT-003: Admin user in chat list contains uploaded avatarUrl");

    // Admin cleans up own avatar
    const adminDeleteSelfRes = await request(app)
      .delete("/api/auth/avatar")
      .set("Authorization", `Bearer ${adminToken}`);
    assert(adminDeleteSelfRes.status === 200, "AVATAR-ADM-009: Admin removes own avatar successfully (200)");

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

  // --- Suite 23: P0 Bug Fixes, Excel Hierarchy, Task & Deletion Approvals ---
  console.log("\n--- Suite 23: P0 Bug Fixes, Excel Hierarchy, Task & Deletion Approvals ---");
  {
    const adminUser = await createUser({
      name: "Managing Partner S23",
      email: `admin-s23-${Date.now()}@test.com`,
      role: "admin",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const adminToken = await createToken(adminUser);

    const empUser = await createUser({
      name: "Junior Associate S23",
      email: `emp-s23-${Date.now()}@test.com`,
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const empToken = await createToken(empUser);

    // 1. Seed Categories from Excel Master
    const seedResult = await seedCategories();
    assert(((seedResult.inserted || 0) + (seedResult.total || 0)) > 0, "SUITE23-CAT-001: Category seeder successfully imported categories from Excel");

    const treeRes = await request(app)
      .get("/api/categories/tree")
      .set("Authorization", `Bearer ${adminToken}`);
    assert(treeRes.status === 200, "SUITE23-CAT-002: GET /api/categories/tree returns 200");
    assert(Array.isArray(treeRes.body.tree) && treeRes.body.tree.length >= 9, "SUITE23-CAT-003: Category tree contains main categories");

    // 2. Priority Zero: Fix Client Not Found on Compound Name - Phone
    const jatinder = await Client.create({
      name: "Jatinder Singh",
      phone: "9869717581",
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });

    // Create task referencing compound client string "JATINDER SINGH - 9869717581"
    const p0TaskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Verify Title Deeds for Jatinder",
        clientId: "JATINDER SINGH - 9869717581",
        assignedTo: empUser._id.toString(),
        mainCategory: "Registration",
        subCategory: "Rectification Deed",
        category: "Registration",
        priority: "High",
        checklist: [
          { text: "Inspect original index II", done: false },
          {
            text: "Verify sub-registrar entries",
            done: false,
            subItems: [
              { text: "Confirm receipt stamps", done: false },
              { text: "Verify thumb impressions", done: false }
            ]
          }
        ]
      });

    assert(p0TaskRes.status === 201, "SUITE23-P0-001: Task creation with compound 'NAME - PHONE' string succeeds (201)");
    assert(p0TaskRes.body.task?.clientId === jatinder._id.toString(), "SUITE23-P0-002: Task clientId correctly resolved to real MongoDB Client ID");
    assert(p0TaskRes.body.task?.subCategory === "Rectification Deed", "SUITE23-P0-003: Task preserved Excel subcategory 'Rectification Deed'");
    assert(p0TaskRes.body.task?.checklist?.[1]?.subItems?.length === 2, "SUITE23-P0-004: Recursive checklist saved nested subItems");

    // 3. Priority Zero: Reassignment Authorization & Workflow
    // Non-admin can directly assign or reassign task to another user
    const directReassignRes = await request(app)
      .patch(`/api/tasks/${p0TaskRes.body.task._id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ assignedTo: adminUser._id.toString() });
    assert(directReassignRes.status === 200, "SUITE23-P0-005: Non-admin can directly assign task to another user (200)");
    assert(Boolean(directReassignRes.body.task?.assignmentHistory?.length), "SUITE23-P0-006: Direct assignment logs entry in assignmentHistory");

    // Non-admin requests reassignment via request-assignment endpoint
    const reqAssignRes = await request(app)
      .post(`/api/tasks/${p0TaskRes.body.task._id}/request-assignment`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        targetUserId: adminUser._id.toString(),
        reason: "Need senior advocate verification for registration deed"
      });
    assert(reqAssignRes.status === 201, "SUITE23-APPR-001: Non-admin submits reassignment request (201)");
    const approvalReqId = reqAssignRes.body.approvalRequest?._id;
    assert(Boolean(approvalReqId), "SUITE23-APPR-002: ApprovalRequest ID returned");

    // Admin approves without decision remark (now permitted: save/update without remarks)
    const emptyRemarkApprove = await request(app)
      .post(`/api/approvals/${approvalReqId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decisionRemark: "   " });
    assert(emptyRemarkApprove.status === 200, "SUITE23-APPR-003: Approval succeeds without mandatory decision remark (200)");

    // Verify task assignment changed in database
    const updatedTask = await Task.findById(p0TaskRes.body.task._id);
    assert(updatedTask?.assignedTo?.toString() === adminUser._id.toString(), "SUITE23-APPR-005: Task assignedTo transitioned to target user upon approval");
    assert(updatedTask?.pendingReassignment === false, "SUITE23-APPR-006: Task pendingReassignment cleared");

    // 4. Non-admin task deletion restriction & deletion request
    const directDeleteRes = await request(app)
      .delete(`/api/tasks/${p0TaskRes.body.task._id}`)
      .set("Authorization", `Bearer ${empToken}`);
    assert(directDeleteRes.status === 403, "SUITE23-DEL-001: Non-admin cannot directly delete task (403)");
    assert(directDeleteRes.body.code === "DELETION_APPROVAL_REQUIRED", "SUITE23-DEL-002: Direct delete returns DELETION_APPROVAL_REQUIRED");

    // Non-admin submits deletion request
    const delReqRes = await request(app)
      .post(`/api/tasks/${p0TaskRes.body.task._id}/request-deletion`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ reason: "Duplicate client task created in error" });
    assert(delReqRes.status === 201, "SUITE23-DEL-003: Task deletion request submitted (201)");
    const delApprId = delReqRes.body.approvalRequest?._id;

    // Admin rejects deletion with mandatory decision remark
    const delRejectRes = await request(app)
      .post(`/api/approvals/${delApprId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decisionRemark: "Keep task for audit trail purposes" });
    assert(delRejectRes.status === 200, "SUITE23-DEL-004: Deletion request rejected with decision remark (200)");

    const keptTask = await Task.findById(p0TaskRes.body.task._id);
    assert(keptTask?.isDeleted !== true, "SUITE23-DEL-005: Task remained active after deletion rejection");
    assert(keptTask?.pendingDeletion === false, "SUITE23-DEL-006: Task pendingDeletion cleared after rejection");

    // 5. Remarks endpoint
    const remarkRes = await request(app)
      .post(`/api/tasks/${p0TaskRes.body.task._id}/remarks`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ text: "Reviewed original deed at registrar office" });
    assert(remarkRes.status === 201, "SUITE23-REM-001: Task remark added (201)");
    assert(remarkRes.body.task?.remarks?.length === 1, "SUITE23-REM-002: Task record contains added remark");
    assert(remarkRes.body.task?.updatedBy !== null, "SUITE23-REM-003: Task updatedBy tracked");

    // =========================================================================
    // Suite 24: Remediation Hardening (Gmail Truthfulness, Header Injection & Storage Path)
    // =========================================================================
    console.log("\n--- Suite 24: Remediation Hardening (Gmail, OAuth, Storage Path & Calendar Remarks) ---");

    // 1. Storage ancestor path validation: normal vs nested non-existent path
    const { getLocalPath } = await import("../services/storage.js");
    let safePathThrown = false;
    try {
      getLocalPath("safe/nested/newfile.pdf");
    } catch {
      safePathThrown = true;
    }
    assert(!safePathThrown, "SUITE24-STOR-001: getLocalPath successfully resolves safe nested new path");

    let traversalThrown = false;
    try {
      getLocalPath("../../../etc/passwd");
    } catch {
      traversalThrown = true;
    }
    assert(traversalThrown, "SUITE24-STOR-002: Directory traversal attempt is rejected");

    let encodedTraversalThrown = false;
    try {
      getLocalPath("%2e%2e%2f%2e%2e%2fescaped.txt");
    } catch {
      encodedTraversalThrown = true;
    }
    assert(encodedTraversalThrown, "SUITE24-STOR-003: Multi-pass encoded traversal attempt is rejected");

    // 2. Gmail header injection rejection
    const newlineSubjectRes = await request(app)
      .post("/api/gmail/send")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        to: "client@example.com",
        subject: "Notice\r\nBcc: evil@attacker.com",
        body: "Test body",
      });
    assert(newlineSubjectRes.status === 400, "SUITE24-GMAIL-001: CR/LF in subject rejected with 400");
    assert(newlineSubjectRes.body.message.includes("newline"), "SUITE24-GMAIL-002: Header injection message returned");

    // 3. Gmail invalid recipient format rejection
    const invalidRecipientRes = await request(app)
      .post("/api/gmail/send")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        to: "not-an-email-address",
        subject: "Valid subject",
        body: "Test body",
      });
    assert(invalidRecipientRes.status === 400, "SUITE24-GMAIL-003: Malformed recipient email rejected with 400");

    // 4. Calendar event remarks alias support
    const calEventRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        title: "Hearing Motion Test",
        start: new Date().toISOString(),
        remarks: "Hearing adjourned for commissioner report",
        type: "hearing",
      });
    assert(calEventRes.status === 201, "SUITE24-CAL-001: Calendar event created with remarks alias (201)");
    assert(calEventRes.body.event.description === "Hearing adjourned for commissioner report", "SUITE24-CAL-002: Remarks correctly persisted into event.description");

    // 5. Category 3-level tree construction verification
    const initialTreeRes = await request(app)
      .get("/api/categories/tree")
      .set("Authorization", `Bearer ${empToken}`);
    const parentCategory = initialTreeRes.body.tree?.[0]?.children?.[0] || initialTreeRes.body.tree?.[0];
    const grandChildCat = await Category.create({
      name: "Special Sub-Deed Detail",
      slug: "special-sub-deed-detail",
      parentId: parentCategory?._id,
      level: 3,
      categoryType: "legal",
      isActive: true,
      displayOrder: 1,
    });
    const multiLevelTreeRes = await request(app)
      .get("/api/categories/tree")
      .set("Authorization", `Bearer ${empToken}`);
    assert(multiLevelTreeRes.status === 200, "SUITE24-CAT-001: Multi-level tree returns 200");
    const parentWithGrandchild = multiLevelTreeRes.body.tree[0]?.children?.[0];
    assert(Boolean(parentWithGrandchild?.children?.length), "SUITE24-CAT-002: Level 3 grandchildren populated recursively in tree");
  }

  // ---------------------------------------------------------------------------
  // SUITE 25: Pending Reminders, Rejection Auth & Remarks, Daily Reports
  // ---------------------------------------------------------------------------
  {
    console.log("\n=== SUITE 25: Pending Reminders, Rejection Auth & Remarks, Daily Reports ===");

    const s25Admin = await createUser({
      name: "Managing Partner S25",
      email: `admin-s25-${Date.now()}@test.com`,
      role: "admin",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const s25AdminToken = await createToken(s25Admin);

    const s25Emp = await createUser({
      name: "Junior Associate S25",
      email: `emp-s25-${Date.now()}@test.com`,
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const s25EmpToken = await createToken(s25Emp);

    // 1. Pending reminders endpoint contract & user isolation
    const pendingRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${s25EmpToken}`);
    assert(pendingRemindersRes.status === 200, "SUITE25-REMIND-001: GET /api/tasks/pending-reminders returns 200");
    assert(Array.isArray(pendingRemindersRes.body.pendingReminders), "SUITE25-REMIND-002: pendingReminders array is present in root response");
    assert(typeof pendingRemindersRes.body.count === "number", "SUITE25-REMIND-003: count property is returned in response");

    // Create a task assigned to employee for pending reminders test (pending for 3 hours)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const empTask = await Task.create({
      title: "Active Contract Analysis",
      status: "pending",
      assignedTo: s25Emp._id,
      assignedBy: s25Admin._id,
      createdAt: threeHoursAgo,
      startedAt: threeHoursAgo,
      deadline: new Date(Date.now() + 86400000),
    });

    const empRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${s25EmpToken}`);
    assert(empRemindersRes.body.pendingReminders.some((r: any) => r.taskId === empTask._id.toString()), "SUITE25-REMIND-004: Assigned task appears in employee's pending reminders");

    // Other user must NOT see employee's pending reminder
    const otherUser = await createUser({
      name: "Other Advocate",
      email: `advocate-other-${Date.now()}@test.com`,
      role: "employee",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const otherToken = await createToken(otherUser);
    const otherRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${otherToken}`);
    assert(otherRemindersRes.status === 200, "SUITE25-REMIND-005: Other user reminders endpoint succeeds (200)");
    assert(Array.isArray(otherRemindersRes.body?.pendingReminders), "SUITE25-REMIND-006: otherReminders has pendingReminders array");
    assert(!otherRemindersRes.body.pendingReminders.some((r: any) => r.taskId === empTask._id.toString()), "SUITE25-REMIND-007: Assigned task is isolated and not visible in another user's pending reminders");

    // 2. Task rejection authorization & mandatory remarks
    // Create a task pending approval
    const pendingApprovalTask = await Task.create({
      title: "Draft Writ Petition Approval",
      status: "pending_approval",
      assignedTo: s25Emp._id,
      assignedBy: s25Admin._id,
      submittedForApprovalAt: new Date(),
    });

    // Non-admin attempting to reject must receive 403 Forbidden
    const nonAdminRejectRes = await request(app)
      .post(`/api/tasks/${pendingApprovalTask._id}/reject`)
      .set("Authorization", `Bearer ${s25EmpToken}`)
      .send({ reason: "Needs revisions to paragraph 4" });
    assert(nonAdminRejectRes.status === 403, "SUITE25-REJECT-001: Non-admin cannot reject task (403 Forbidden)");

    // Admin attempting to reject without reason must receive 400 Bad Request
    const emptyRemarkRejectRes = await request(app)
      .post(`/api/tasks/${pendingApprovalTask._id}/reject`)
      .set("Authorization", `Bearer ${s25AdminToken}`)
      .send({ reason: "   " });
    assert(emptyRemarkRejectRes.status === 400, "SUITE25-REJECT-002: Rejection without remark rejected with 400 Bad Request");

    // Admin rejecting with valid reason succeeds and transitions status
    const validRejectRes = await request(app)
      .post(`/api/tasks/${pendingApprovalTask._id}/reject`)
      .set("Authorization", `Bearer ${s25AdminToken}`)
      .send({ reason: "Please revise clause 12 regarding jurisdiction" });
    assert(validRejectRes.status === 200, "SUITE25-REJECT-003: Admin rejection with remark succeeds (200 OK)");
    assert(validRejectRes.body.task.status === "in_progress", "SUITE25-REJECT-004: Rejected task returned to in_progress");
    assert(validRejectRes.body.task.rejectionReason === "Please revise clause 12 regarding jurisdiction", "SUITE25-REJECT-005: Rejection reason persisted");

    // Verify rejection notification was created for assignee
    const assigneeNotif = await Notification.findOne({
      userId: s25Emp._id,
      type: "TASK_REJECTED",
      relatedId: pendingApprovalTask._id,
    });
    assert(Boolean(assigneeNotif), "SUITE25-REJECT-006: Rejection notification dispatched to assignee");

    // Create a task where creator is distinct from assignee, then reject and verify creator also receives notification
    const distinctCreator = await createUser({
      name: "Partner Creator",
      email: `creator-s25-${Date.now()}@test.com`,
      role: "junior_advocate",
    });
    const distinctTask = await Task.create({
      title: "Title Search Report Approval",
      status: "pending_approval",
      assignedTo: s25Emp._id,
      createdBy: distinctCreator._id,
      submittedForApprovalAt: new Date(),
    });
    await request(app)
      .post(`/api/tasks/${distinctTask._id}/reject`)
      .set("Authorization", `Bearer ${s25AdminToken}`)
      .send({ reason: "Missing encumbrance certificate appendix" });

    const creatorNotif = await Notification.findOne({
      userId: distinctCreator._id,
      type: "TASK_REJECTED",
      relatedId: distinctTask._id,
    });
    assert(Boolean(creatorNotif), "SUITE25-REJECT-007: Rejection notification dispatched to distinct task creator");

    // 3. Daily Employee Progress Reporting Endpoint
    const dailyReportRes = await request(app)
      .get("/api/admin/reports/daily-employee")
      .set("Authorization", `Bearer ${s25AdminToken}`);
    assert(dailyReportRes.status === 200, "SUITE25-REPORT-001: GET /api/admin/reports/daily-employee returns 200");
    assert(Array.isArray(dailyReportRes.body.reports), "SUITE25-REPORT-002: reports array returned");
    const empReport = dailyReportRes.body.reports.find((r: any) => r.employee._id === s25Emp._id.toString());
    assert(Boolean(empReport), "SUITE25-REPORT-003: Target employee found in daily report");
    assert(typeof empReport.metrics.pendingCount === "number", "SUITE25-REPORT-004: Employee pending count is a valid number");
    assert(Array.isArray(empReport.tasks.pending), "SUITE25-REPORT-005: Drill-down pending tasks array is populated");

    // Daily report with employeeId filter
    const filteredReportRes = await request(app)
      .get(`/api/admin/reports/daily-employee?employeeId=${s25Emp._id.toString()}`)
      .set("Authorization", `Bearer ${s25AdminToken}`);
    assert(filteredReportRes.status === 200, "SUITE25-REPORT-006: Filtered daily report returns 200");
    assert(filteredReportRes.body.reports.length === 1, "SUITE25-REPORT-007: Only requested employee returned when filtered");
    assert(filteredReportRes.body.reports[0].employee._id === s25Emp._id.toString(), "SUITE25-REPORT-008: Correct employee ID matched in filtered report");

    // Invalid employeeId format returns 400
    const invalidEmpRes = await request(app)
      .get("/api/admin/reports/daily-employee?employeeId=not-a-valid-id")
      .set("Authorization", `Bearer ${s25AdminToken}`);
    assert(invalidEmpRes.status === 400, "SUITE25-REPORT-009: Invalid employeeId format rejected with 400");

    // Invalid date format returns 400
    const invalidDateRes = await request(app)
      .get("/api/admin/reports/daily-employee?date=14-10-2026")
      .set("Authorization", `Bearer ${s25AdminToken}`);
    assert(invalidDateRes.status === 400, "SUITE25-REPORT-010: Invalid date format rejected with 400");

    // Valid ISO date parameter succeeds
    const validDateRes = await request(app)
      .get("/api/admin/reports/daily-employee?date=2026-10-14")
      .set("Authorization", `Bearer ${s25AdminToken}`);
    assert(validDateRes.status === 200, "SUITE25-REPORT-011: Valid YYYY-MM-DD date parameter returns 200");
    assert(validDateRes.body.date === "2026-10-14", "SUITE25-REPORT-012: Returned date matches requested date");

    // Non-admin without permission receives 403
    const nonAdminReportRes = await request(app)
      .get("/api/admin/reports/daily-employee")
      .set("Authorization", `Bearer ${otherToken}`);
    assert(nonAdminReportRes.status === 403, "SUITE25-REPORT-013: Non-admin unauthorized access to daily employee report rejected with 403");

    // =========================================================================
    // SUITE 26: Persistent Reminder State, Task Rejection Notifications, Approval-Aware Completion, & Strict Validation
    // =========================================================================
    console.log("\n--- Suite 26: Persistent Reminders, Rejections, Approval Completion & Strict Reports ---");

    const s26Admin = await createUser({
      name: "Managing Admin S26",
      email: `admin-s26-${Date.now()}@test.com`,
      role: "admin",
    });
    const s26AdminToken = await createToken(s26Admin);

    const s26Employee = await createUser({
      name: "Staff Associate S26",
      email: `emp-s26-${Date.now()}@test.com`,
      role: "junior_advocate",
    });
    const s26EmpToken = await createToken(s26Employee);

    const s26Creator = await createUser({
      name: "Partner Author S26",
      email: `creator-s26-${Date.now()}@test.com`,
      role: "junior_advocate",
    });
    const s26CreatorToken = await createToken(s26Creator);

    // 1. Persistent Reminder Dismissal
    const s26ThreeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const dismissTask = await Task.create({
      title: "Title Deed Verification Due",
      status: "pending",
      assignedTo: s26Employee._id,
      createdBy: s26Creator._id,
      createdAt: s26ThreeHoursAgo,
      startedAt: s26ThreeHoursAgo,
    });

    // Verify task appears in pending reminders initially
    const initialRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${s26EmpToken}`);
    assert(initialRemindersRes.status === 200, "SUITE26-DISMISS-001: GET /api/tasks/pending-reminders returns 200");
    const foundInitial = initialRemindersRes.body.pendingReminders?.some((r: any) => r.taskId === dismissTask._id.toString());
    assert(foundInitial === true, "SUITE26-DISMISS-002: Pending task appears in pending reminders");

    // Dismiss reminder via POST /api/tasks/:id/reminders/dismiss
    const dismissRes = await request(app)
      .post(`/api/tasks/${dismissTask._id}/reminders/dismiss`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ slot: 1 });
    assert(dismissRes.status === 200, "SUITE26-DISMISS-003: POST /api/tasks/:id/reminders/dismiss returns 200");
    assert(dismissRes.body.success === true, "SUITE26-DISMISS-004: Dismiss response indicates success");

    // Verify persistence in TaskReminderState
    const persistedDismissState = await TaskReminderState.findOne({
      taskId: dismissTask._id,
      userId: s26Employee._id,
    });
    assert(Boolean(persistedDismissState), "SUITE26-DISMISS-005: TaskReminderState record exists in database");
    assert(persistedDismissState?.dismissed === true, "SUITE26-DISMISS-006: TaskReminderState has dismissed=true");
    assert(persistedDismissState?.dismissedSlot === 1, "SUITE26-DISMISS-007: Dismissed slot recorded accurately");

    // Verify task is now suppressed on subsequent fetch
    const afterDismissRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${s26EmpToken}`);
    const foundAfterDismiss = afterDismissRemindersRes.body.pendingReminders?.some((r: any) => r.taskId === dismissTask._id.toString());
    assert(foundAfterDismiss === false, "SUITE26-DISMISS-008: Dismissed task suppressed from pending reminders");

    // 2. Persistent Reminder Snooze
    const snoozeTask = await Task.create({
      title: "Drafting Lease Agreement Review",
      status: "pending",
      assignedTo: s26Employee._id,
      createdBy: s26Creator._id,
      createdAt: s26ThreeHoursAgo,
      startedAt: s26ThreeHoursAgo,
    });

    // Test snooze validation
    const invalidSnoozeRes1 = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ hours: -2 });
    assert(invalidSnoozeRes1.status === 400, "SUITE26-SNOOZE-001: Negative hours rejected with 400");

    const invalidSnoozeRes2 = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ hours: 500 });
    assert(invalidSnoozeRes2.status === 400, "SUITE26-SNOOZE-002: Excessive hours (>168) rejected with 400");

    const invalidSnoozeRes3 = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ snoozeUntil: "2020-01-01T00:00:00Z" });
    assert(invalidSnoozeRes3.status === 400, "SUITE26-SNOOZE-003: Past snoozeUntil timestamp rejected with 400");

    // snoozeUntil without timezone must be rejected
    const invalidSnoozeResNoTz = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ snoozeUntil: "2026-10-15T12:00:00" });
    assert(invalidSnoozeResNoTz.status === 400, "SUITE26-SNOOZE-003B: snoozeUntil without timezone offset rejected with 400");

    // snoozeUntil beyond 168 hours must be rejected
    const beyond168hIso = new Date(Date.now() + 170 * 60 * 60 * 1000).toISOString();
    const invalidSnoozeResBeyond168 = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ snoozeUntil: beyond168hIso });
    assert(invalidSnoozeResBeyond168.status === 400, "SUITE26-SNOOZE-003C: snoozeUntil > 168 hours into future rejected with 400");

    // snoozeUntil with valid ISO format within 168 hours is accepted
    const within168hIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const validSnoozeIsoRes = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ snoozeUntil: within168hIso });
    assert(validSnoozeIsoRes.status === 200, "SUITE26-SNOOZE-003D: Valid snoozeUntil ISO timestamp accepted with 200");

    // Valid snooze duration (4 hours)
    const validSnoozeRes = await request(app)
      .post(`/api/tasks/${snoozeTask._id}/reminders/snooze`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ hours: 4 });
    assert(validSnoozeRes.status === 200, "SUITE26-SNOOZE-004: Valid snooze duration returns 200");
    assert(validSnoozeRes.body.success === true, "SUITE26-SNOOZE-005: Snooze response indicates success");
    assert(Boolean(validSnoozeRes.body.snoozedUntil), "SUITE26-SNOOZE-006: snoozedUntil timestamp returned");

    // Verify database persistence of snooze
    const persistedSnoozeState = await TaskReminderState.findOne({
      taskId: snoozeTask._id,
      userId: s26Employee._id,
    });
    assert(Boolean(persistedSnoozeState), "SUITE26-SNOOZE-007: TaskReminderState persisted in DB");
    assert(Boolean(persistedSnoozeState?.snoozedUntil && persistedSnoozeState.snoozedUntil.getTime() > Date.now()), "SUITE26-SNOOZE-008: snoozedUntil is a future date in DB");

    // Verify snoozed task is excluded from pending reminders
    const afterSnoozeRemindersRes = await request(app)
      .get("/api/tasks/pending-reminders")
      .set("Authorization", `Bearer ${s26EmpToken}`);
    const foundAfterSnooze = afterSnoozeRemindersRes.body.pendingReminders?.some((r: any) => r.taskId === snoozeTask._id.toString());
    assert(foundAfterSnooze === false, "SUITE26-SNOOZE-009: Snoozed task suppressed from pending reminders");

    // 3. Approval-Aware Task Completion & Rejection Notifications
    const workflowTask = await Task.create({
      title: "Comprehensive Audit Compliance Review",
      status: "in_progress",
      assignedTo: s26Employee._id,
      createdBy: s26Creator._id,
    });

    // Non-admin marks task as completed -> must transition to pending_approval (not completed)
    const nonAdminCompleteRes = await request(app)
      .patch(`/api/tasks/${workflowTask._id}`)
      .set("Authorization", `Bearer ${s26EmpToken}`)
      .send({ status: "completed" });
    assert(nonAdminCompleteRes.status === 200, "SUITE26-WORKFLOW-001: Employee update returns 200");
    assert(nonAdminCompleteRes.body.task.status === "pending_approval", "SUITE26-WORKFLOW-002: Task transitions to pending_approval rather than completed");

    // Admin rejects task via PATCH /api/tasks/:id (reverting status to in_progress with rejectionReason)
    await request(app)
      .patch(`/api/tasks/${workflowTask._id}`)
      .set("Authorization", `Bearer ${s26AdminToken}`)
      .send({ status: "in_progress", rejectionReason: "Paragraph 4 needs statutory citation" });

    // Verify notification reached BOTH employee (assignee) AND creator (omitting admin)
    const empRejectionNotif = await Notification.findOne({
      userId: s26Employee._id,
      type: "TASK_REJECTED",
      relatedId: workflowTask._id,
    });
    assert(Boolean(empRejectionNotif), "SUITE26-WORKFLOW-003: Rejection notification delivered to assigned employee");

    const creatorRejectionNotif = await Notification.findOne({
      userId: s26Creator._id,
      type: "TASK_REJECTED",
      relatedId: workflowTask._id,
    });
    assert(Boolean(creatorRejectionNotif), "SUITE26-WORKFLOW-004: Rejection notification delivered to task creator");

    const adminRejectionNotif = await Notification.findOne({
      userId: s26Admin._id,
      type: "TASK_REJECTED",
      relatedId: workflowTask._id,
    });
    assert(!adminRejectionNotif, "SUITE26-WORKFLOW-005: Admin did not self-notify on rejection");

    // Verify rejection notification deduplication / idempotency
    const empRejectionCountBefore = await Notification.countDocuments({
      userId: s26Employee._id,
      type: "TASK_REJECTED",
      relatedId: workflowTask._id,
    });
    assert(empRejectionCountBefore === 1, "SUITE26-WORKFLOW-006: Exactly 1 rejection notification created for assignee");

    // 4. Strict Daily Employee Report Date & EmployeeId Validation
    // Rejects impossible calendar dates: Feb 30, Month 13, non-leap Feb 29
    const feb30Res = await request(app)
      .get("/api/admin/reports/daily-employee?date=2026-02-30")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(feb30Res.status === 400, "SUITE26-VALIDATE-001: 2026-02-30 rejected with 400");

    const month13Res = await request(app)
      .get("/api/admin/reports/daily-employee?date=2026-13-01")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(month13Res.status === 400, "SUITE26-VALIDATE-002: 2026-13-01 rejected with 400");

    const nonLeapFeb29Res = await request(app)
      .get("/api/admin/reports/daily-employee?date=2026-02-29")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(nonLeapFeb29Res.status === 400, "SUITE26-VALIDATE-003: 2026-02-29 rejected with 400 on non-leap year");

    // Accepts valid leap day: Feb 29, 2024
    const leapFeb29Res = await request(app)
      .get("/api/admin/reports/daily-employee?date=2024-02-29")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(leapFeb29Res.status === 200, "SUITE26-VALIDATE-004: 2024-02-29 leap day accepted with 200");

    // Rejects non-24 hex employeeId (e.g. 12-byte string like '123456789012')
    const twelveByteEmpRes = await request(app)
      .get("/api/admin/reports/daily-employee?employeeId=123456789012")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(twelveByteEmpRes.status === 400, "SUITE26-VALIDATE-005: 12-byte employeeId rejected with 400");

    const nonHexEmpRes = await request(app)
      .get("/api/admin/reports/daily-employee?employeeId=zzzzzzzzzzzzzzzzzzzzzzzz")
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(nonHexEmpRes.status === 400, "SUITE26-VALIDATE-006: Non-hex 24-character string rejected with 400");

    const validHexEmpRes = await request(app)
      .get(`/api/admin/reports/daily-employee?employeeId=${s26Employee._id.toString()}`)
      .set("Authorization", `Bearer ${s26AdminToken}`);
    assert(validHexEmpRes.status === 200, "SUITE26-VALIDATE-007: Valid 24-char hex employeeId accepted with 200");
  }

  // -------------------------------------------------------------------------
  // Suite 27: Employee Directory & Detail Workspace Verification
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 27: Employee Directory & Detail Workspace Verification ---");
  {
    const s27Admin = await createUser({ role: "admin", name: "S27 Admin" });
    const s27Employee = await createUser({ role: "junior_advocate", name: "S27 Advocate" });
    const s27OtherEmployee = await createUser({ role: "junior_advocate", name: "S27 Other Advocate" });
    const s27AdminToken = await createToken(s27Admin);
    const s27EmpToken = await createToken(s27Employee);
    const s27OtherEmpToken = await createToken(s27OtherEmployee);

    // 1. Invalid employee ID format returns 400
    const invalidIdRes = await request(app)
      .get("/api/admin/employees/not-a-valid-id")
      .set("Authorization", `Bearer ${s27AdminToken}`);
    assert(invalidIdRes.status === 400, "SUITE27-EMP-001: Invalid employee ID format rejected with 400");

    // 2. Non-existent employee returns 404
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await request(app)
      .get(`/api/admin/employees/${nonExistentId}`)
      .set("Authorization", `Bearer ${s27AdminToken}`);
    assert(notFoundRes.status === 404, "SUITE27-EMP-002: Non-existent employee ID returns 404");

    // 3. Unauthorized non-admin employee viewing someone else's profile rejected with 403
    const forbiddenRes = await request(app)
      .get(`/api/admin/employees/${s27OtherEmployee._id.toString()}`)
      .set("Authorization", `Bearer ${s27EmpToken}`);
    assert(forbiddenRes.status === 403, "SUITE27-EMP-003: Unauthorized employee access to other employee detail rejected with 403");

    // 4. Employee viewing own profile succeeds with 200
    const selfRes = await request(app)
      .get(`/api/admin/employees/${s27Employee._id.toString()}`)
      .set("Authorization", `Bearer ${s27EmpToken}`);
    assert(selfRes.status === 200, "SUITE27-EMP-004: Employee can view own profile with 200");

    // 5. Admin viewing employee profile succeeds with 200
    const adminViewRes = await request(app)
      .get(`/api/admin/employees/${s27Employee._id.toString()}`)
      .set("Authorization", `Bearer ${s27AdminToken}`);
    assert(adminViewRes.status === 200, "SUITE27-EMP-005: Admin can view employee profile with 200");

    // 6. Response structure check: employee, metrics, recentActivity
    assert(Boolean(adminViewRes.body.employee), "SUITE27-EMP-006: Response contains employee object");
    assert(Boolean(adminViewRes.body.metrics), "SUITE27-EMP-007: Response contains metrics object");
    assert(Array.isArray(adminViewRes.body.recentActivity), "SUITE27-EMP-008: Response contains recentActivity array");

    // 7. Sensitive fields are NOT exposed
    assert(adminViewRes.body.employee.passwordHash === undefined, "SUITE27-EMP-009: passwordHash is not exposed");
    assert(adminViewRes.body.employee.resetOtpHash === undefined, "SUITE27-EMP-010: resetOtpHash is not exposed");

    // 8. Metric fields exist and are numbers
    const metrics = adminViewRes.body.metrics;
    assert(typeof metrics.activeCases === "number", "SUITE27-EMP-011: metrics.activeCases is a number");
    assert(typeof metrics.openTasks === "number", "SUITE27-EMP-012: metrics.openTasks is a number");
    assert(typeof metrics.completedTasks === "number", "SUITE27-EMP-013: metrics.completedTasks is a number");
    assert(typeof metrics.overdueTasks === "number", "SUITE27-EMP-014: metrics.overdueTasks is a number");
    assert(typeof metrics.completedToday === "number", "SUITE27-EMP-015: metrics.completedToday is a number");
    assert(typeof metrics.completedThisWeek === "number", "SUITE27-EMP-016: metrics.completedThisWeek is a number");
    assert(typeof metrics.completedThisMonth === "number", "SUITE27-EMP-017: metrics.completedThisMonth is a number");
    assert(typeof metrics.upcomingDeadlines === "number", "SUITE27-EMP-018: metrics.upcomingDeadlines is a number");
  }

  // -------------------------------------------------------------------------
  // Suite 28: Server-Authoritative Presence System & Daily Reporting Drill-Down
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 28: Server-Authoritative Presence System & Daily Reporting Drill-Down ---");
  {
    const s28Admin = await createUser({ role: "admin", name: "S28 Admin" });
    const s28Advocate = await createUser({ role: "junior_advocate", name: "S28 Advocate" });
    const s28AdminToken = await createToken(s28Admin);
    const s28AdvocateToken = await createToken(s28Advocate);

    // 1. Presence endpoint authorization: anonymous rejected with 401
    const unauthPresence = await request(app).get("/api/presence");
    assert(unauthPresence.status === 401, "SUITE28-PRESENCE-001: Anonymous request to /api/presence rejected with 401");

    // 2. Presence endpoint authorized returns 200 with presence map
    const authPresence = await request(app)
      .get("/api/presence")
      .set("Authorization", `Bearer ${s28AdvocateToken}`);
    assert(authPresence.status === 200, "SUITE28-PRESENCE-002: Authenticated request to /api/presence succeeds with 200");
    assert(Boolean(authPresence.body.presence), "SUITE28-PRESENCE-003: Response contains presence object");

    // 3. Multi-session lifecycle in PresenceService
    presenceService.reset();
    const advocateId = s28Advocate._id.toString();

    // Initially offline
    assert(presenceService.isUserOnline(advocateId) === false, "SUITE28-PRESENCE-004: User initially offline");
    assert(presenceService.getUserSessionCount(advocateId) === 0, "SUITE28-PRESENCE-005: Initial session count is 0");

    // Connect first session (e.g. web browser tab)
    const session1 = await presenceService.registerSession({
      socketId: "socket_advocate_web_1",
      userId: advocateId,
      clientType: "web",
    });
    assert(session1.becameOnline === true, "SUITE28-PRESENCE-006: First session registration reports becameOnline: true");
    assert(session1.sessionCount === 1, "SUITE28-PRESENCE-007: Session count is 1");
    assert(presenceService.isUserOnline(advocateId) === true, "SUITE28-PRESENCE-008: isUserOnline is true after first session");

    // Verify DB was updated to "online"
    const dbUserAfterOnline = await User.findById(s28Advocate._id).select("status");
    assert(dbUserAfterOnline?.status === "online", "SUITE28-PRESENCE-009: DB user status updated to 'online'");

    // Connect second session (e.g. Electron desktop client or second browser tab)
    const session2 = await presenceService.registerSession({
      socketId: "socket_advocate_electron_2",
      userId: advocateId,
      clientType: "electron",
    });
    assert(session2.becameOnline === false, "SUITE28-PRESENCE-010: Second session reports becameOnline: false (already online)");
    assert(session2.sessionCount === 2, "SUITE28-PRESENCE-011: User session count is 2");

    // Heartbeat record
    const hbSuccess = presenceService.recordHeartbeat("socket_advocate_web_1");
    assert(hbSuccess === true, "SUITE28-PRESENCE-012: Heartbeat successfully recorded for active socket");
    const hbMissing = presenceService.recordHeartbeat("non_existent_socket");
    assert(hbMissing === false, "SUITE28-PRESENCE-013: Heartbeat returns false for unknown socket");

    // Disconnect one session (tab 1 closed) — user must STAY online because tab 2 is still active
    const removeSession1 = await presenceService.removeSession("socket_advocate_web_1");
    assert(removeSession1.becameOffline === false, "SUITE28-PRESENCE-014: Closing 1 of 2 sessions does NOT trigger becameOffline");
    assert(presenceService.isUserOnline(advocateId) === true, "SUITE28-PRESENCE-015: User remains online with 1 remaining session");
    assert(presenceService.getUserSessionCount(advocateId) === 1, "SUITE28-PRESENCE-016: Session count decremented to 1");

    // Disconnect final session (tab 2 closed) — user transitions to offline
    const removeSession2 = await presenceService.removeSession("socket_advocate_electron_2");
    assert(removeSession2.becameOffline === true, "SUITE28-PRESENCE-017: Closing final session triggers becameOffline: true");
    assert(presenceService.isUserOnline(advocateId) === false, "SUITE28-PRESENCE-018: isUserOnline is false after all sessions disconnect");

    // Verify DB was updated to "offline" and lastActiveAt is recorded
    const dbUserAfterOffline = await User.findById(s28Advocate._id).select("status lastActiveAt");
    assert(dbUserAfterOffline?.status === "offline", "SUITE28-PRESENCE-019: DB user status updated to 'offline'");
    assert(Boolean(dbUserAfterOffline?.lastActiveAt), "SUITE28-PRESENCE-020: lastActiveAt timestamp recorded in DB");

    // 4. Stale session automatic expiry
    await presenceService.registerSession({
      socketId: "socket_stale_ghost_1",
      userId: advocateId,
      clientType: "web",
    });
    assert(presenceService.isUserOnline(advocateId) === true, "SUITE28-PRESENCE-021: Stale test socket registered");

    // Manually backdate the heartbeat past the 75s threshold
    const liveSession = (presenceService as any).sessionsBySocketId.get("socket_stale_ghost_1");
    if (liveSession) {
      liveSession.lastHeartbeat = Date.now() - 90_000; // 90 seconds ago (>75s)
    }

    const expiredCount = await presenceService.expireStaleSessions();
    assert(expiredCount === 1, "SUITE28-PRESENCE-022: expireStaleSessions swept 1 stale ghost session");
    assert(presenceService.isUserOnline(advocateId) === false, "SUITE28-PRESENCE-023: User marked offline after ghost session swept");

    // 5. Daily Employee Progress Reporting Drill-down & Payload Structure
    const client = await Client.create({ name: "S28 Test Client", email: "s28client@test.local", phone: "9876543210" });
    const matter = await Case.create({
      title: "S28 Test Matter v. State",
      number: "MAT/2026/028",
      clientId: client._id,
      assignedTo: s28Advocate._id,
      assignedBy: s28Admin._id,
      createdBy: s28Admin._id,
      stage: "Active",
      practice: "Corporate",
    });

    const todayDateStr = new Date().toISOString().slice(0, 10);

    const testTask = await Task.create({
      title: "Draft written statement in MAT/2026/028",
      assignedTo: s28Advocate._id,
      caseId: matter._id,
      clientId: client._id,
      status: "pending",
      priority: "High",
      createdAt: new Date(),
    });

    const reportRes = await request(app)
      .get(`/api/admin/reports/daily-employee?date=${todayDateStr}&employeeId=${s28Advocate._id.toString()}`)
      .set("Authorization", `Bearer ${s28AdminToken}`);

    assert(reportRes.status === 200, "SUITE28-REPORT-001: Daily employee report query succeeds with 200");
    assert(Array.isArray(reportRes.body.reports), "SUITE28-REPORT-002: Response has reports array");
    const advocateReport = reportRes.body.reports.find((r: any) => r.employee._id === s28Advocate._id.toString());
    assert(Boolean(advocateReport), "SUITE28-REPORT-003: Found advocate daily report");
    assert(typeof advocateReport.metrics.assignedTodayCount === "number", "SUITE28-REPORT-004: assignedTodayCount is a number");
    assert(typeof advocateReport.metrics.pendingCount === "number", "SUITE28-REPORT-005: pendingCount is a number");
    assert(Array.isArray(advocateReport.tasks.assignedToday), "SUITE28-REPORT-006: tasks.assignedToday is array");
    assert(Array.isArray(advocateReport.tasks.pending), "SUITE28-REPORT-007: tasks.pending is array");

    // Ensure populated caseId and clientId for clickable drill-down
    const foundTask = advocateReport.tasks.assignedToday.find((t: any) => t._id === testTask._id.toString());
    assert(Boolean(foundTask), "SUITE28-REPORT-008: Created test task exists in assignedToday drill-down");
    assert(foundTask.caseId?.title === "S28 Test Matter v. State", "SUITE28-REPORT-009: task.caseId.title is populated for drill-down navigation");
    assert(foundTask.clientId?.name === "S28 Test Client", "SUITE28-REPORT-010: task.clientId.name is populated for drill-down display");
  }

  // -------------------------------------------------------------------------
  // Suite 29: Employee Workload Filtering & Interactive Navigation Tests
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 29: Employee Workload Filtering & Interactive Navigation Tests ---");
  {
    const s29Admin = await createUser({ role: "admin", name: "S29 Admin" });
    const s29Employee = await createUser({ role: "junior_advocate", name: "S29 Advocate" });
    const s29OtherEmployee = await createUser({ role: "junior_advocate", name: "S29 Other Advocate" });
    const s29AdminToken = await createToken(s29Admin);
    const s29EmpToken = await createToken(s29Employee);
    const s29OtherEmpToken = await createToken(s29OtherEmployee);

    const empId = s29Employee._id.toString();
    const otherEmpId = s29OtherEmployee._id.toString();

    // 1. Create Active and Closed cases for employee and other employee
    const activeCase1 = await Case.create({
      number: `S29-CASE-01-${Date.now()}`,
      title: "S29 Employee Active Case 1",
      description: "Active litigation matter",
      practice: "Civil",
      court: "High Court of Delhi",
      status: "Active",
      priority: "High",
      assignedTo: s29Employee._id,
      assignedBy: s29Admin._id,
      createdBy: s29Admin._id,
    });
    const urgentCase2 = await Case.create({
      number: `S29-CASE-02-${Date.now()}`,
      title: "S29 Employee Urgent Case 2",
      description: "Urgent injunction matter",
      practice: "Commercial",
      court: "Commercial Court",
      status: "Urgent",
      priority: "High",
      assignedTo: s29Employee._id,
      assignedBy: s29Admin._id,
      createdBy: s29Admin._id,
    });
    const closedCase = await Case.create({
      number: `S29-CASE-03-${Date.now()}`,
      title: "S29 Employee Closed Case",
      description: "Closed matter",
      practice: "Civil",
      court: "District Court",
      status: "Closed",
      priority: "Low",
      assignedTo: s29Employee._id,
      assignedBy: s29Admin._id,
      createdBy: s29Admin._id,
    });
    const otherCase = await Case.create({
      number: `S29-CASE-04-${Date.now()}`,
      title: "S29 Other Employee Case",
      description: "Other matter",
      practice: "Criminal",
      court: "Sessions Court",
      status: "Active",
      priority: "Medium",
      assignedTo: s29OtherEmployee._id,
      assignedBy: s29Admin._id,
      createdBy: s29Admin._id,
    });

    // 2. Create tasks with various statuses for employee
    const now = new Date();
    const pastDeadline = new Date(now.getTime() - 48 * 3600 * 1000); // 2 days ago
    const futureDeadline = new Date(now.getTime() + 48 * 3600 * 1000); // 2 days ahead

    // Open & In Progress
    const openTask1 = await Task.create({
      title: "S29 Open Task In Progress",
      description: "Draft petition",
      priority: "High",
      status: "in_progress",
      deadline: futureDeadline,
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: activeCase1._id,
    });
    // Open & Pending
    const openTask2 = await Task.create({
      title: "S29 Open Task Pending",
      description: "Review documents",
      priority: "Medium",
      status: "pending",
      deadline: futureDeadline,
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: activeCase1._id,
    });
    // Overdue Task (deadline past, status pending)
    const overdueTask = await Task.create({
      title: "S29 Overdue Task 1",
      description: "Filing reply past deadline",
      priority: "High",
      status: "pending",
      deadline: pastDeadline,
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: urgentCase2._id,
    });
    // Completed Task whose original deadline was past (MUST NOT be counted in overdue)
    const completedPastDeadlineTask = await Task.create({
      title: "S29 Completed Task With Past Deadline",
      description: "Completed on time even though deadline was yesterday",
      priority: "Medium",
      status: "completed",
      deadline: pastDeadline,
      completedAt: new Date(),
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: activeCase1._id,
    });
    // Task Completed Today
    const doneTodayTask = await Task.create({
      title: "S29 Task Done Today",
      description: "Legal research completed today",
      priority: "Medium",
      status: "completed",
      completedAt: new Date(),
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: activeCase1._id,
    });
    // Task Pending Approval
    const approvalTask = await Task.create({
      title: "S29 Task Awaiting Approval",
      description: "Submitted for completion review",
      priority: "High",
      status: "pending_approval",
      submittedForApprovalAt: new Date(),
      assignedTo: s29Employee._id,
      createdBy: s29Admin._id,
      caseId: urgentCase2._id,
    });
    // ApprovalRequest (reassignment)
    const approvalReq = await ApprovalRequest.create({
      type: "task_reassign",
      entityType: "Task",
      entityId: openTask1._id,
      requesterId: s29Employee._id,
      targetUserId: s29OtherEmployee._id,
      reason: "Conflict of interest on matter",
      status: "pending",
    });

    // Other employee task (MUST NOT leak into s29Employee queries)
    const otherEmployeeTask = await Task.create({
      title: "S29 Other Employee Overdue Task",
      description: "Belongs strictly to other advocate",
      priority: "High",
      status: "pending",
      deadline: pastDeadline,
      assignedTo: s29OtherEmployee._id,
      createdBy: s29Admin._id,
      caseId: otherCase._id,
    });

    // TEST 1: GET /api/admin/employees/:id returns matching metrics
    const detailRes = await request(app)
      .get(`/api/admin/employees/${empId}`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(detailRes.status === 200, "SUITE29-WORKLOAD-001: Employee detail succeeds with 200");
    const m = detailRes.body.metrics;
    assert(m.activeCases === 2, `SUITE29-WORKLOAD-002: Active cases count matches active/urgent non-closed matters (expected 2, got ${m.activeCases})`);
    assert(m.openTasks === 3, `SUITE29-WORKLOAD-003: Open tasks count includes in_progress, pending, pending_approval (expected 3, got ${m.openTasks})`);
    assert(m.overdueTasks === 1, `SUITE29-WORKLOAD-004: Overdue tasks count strictly incomplete past deadline (expected 1, got ${m.overdueTasks})`);
    assert(m.completedToday === 2, `SUITE29-WORKLOAD-005: Done Today count matches completions today (expected 2, got ${m.completedToday})`);
    assert(m.pendingApprovals === 2, `SUITE29-WORKLOAD-006: Pending approvals count combines task approval + ApprovalRequest (expected 2, got ${m.pendingApprovals})`);

    // TEST 2: Active Cases query with assignedTo=empId returns only employee's cases
    const casesRes = await request(app)
      .get(`/api/cases?assignedTo=${empId}`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(casesRes.status === 200, "SUITE29-WORKLOAD-007: Cases query succeeds with 200");
    const returnedCases = casesRes.body.cases;
    assert(returnedCases.length === 3, "SUITE29-WORKLOAD-008: Exactly 3 cases returned for employee (2 active/urgent, 1 closed)");
    assert(returnedCases.every((c: any) => c.assignedTo?._id?.toString() === empId || c.assignedTo?.toString() === empId), "SUITE29-WORKLOAD-009: No other employee cases leaked");

    // TEST 3: Open tasks query with assignedTo=empId&open=true returns only open tasks
    const openTasksRes = await request(app)
      .get(`/api/tasks?assignedTo=${empId}&open=true`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(openTasksRes.status === 200, "SUITE29-WORKLOAD-010: Open tasks query succeeds with 200");
    assert(openTasksRes.body.tasks.length === 3, `SUITE29-WORKLOAD-011: Open tasks list returns matching records (expected 3, got ${openTasksRes.body.tasks.length})`);
    assert(openTasksRes.body.tasks.every((t: any) => t.status !== "completed"), "SUITE29-WORKLOAD-012: No completed tasks returned in open list");

    // TEST 4: Overdue tasks query with assignedTo=empId&overdue=true
    const overdueRes = await request(app)
      .get(`/api/tasks?assignedTo=${empId}&overdue=true`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(overdueRes.status === 200, "SUITE29-WORKLOAD-013: Overdue tasks query succeeds with 200");
    assert(overdueRes.body.tasks.length === 1, `SUITE29-WORKLOAD-014: Overdue tasks list contains only incomplete overdue task (expected 1, got ${overdueRes.body.tasks.length})`);
    assert(overdueRes.body.tasks[0]._id === overdueTask._id.toString(), "SUITE29-WORKLOAD-015: Returned overdue task matches expected task ID");
    assert(overdueRes.body.tasks[0].title === "S29 Overdue Task 1", "SUITE29-WORKLOAD-016: Overdue task title is correct");

    // TEST 5: Completed past deadline task is excluded from Overdue
    const completedIncluded = overdueRes.body.tasks.some((t: any) => t._id === completedPastDeadlineTask._id.toString());
    assert(!completedIncluded, "SUITE29-WORKLOAD-017: Completed task with past deadline is strictly excluded from Overdue");

    // TEST 6: Other employee's overdue task does NOT leak into employee's overdue list
    const otherLeaked = overdueRes.body.tasks.some((t: any) => t._id === otherEmployeeTask._id.toString());
    assert(!otherLeaked, "SUITE29-WORKLOAD-018: Other employee's overdue task does NOT leak into selected employee list");

    // TEST 7: Employee approvals endpoint GET /api/admin/employees/:id/approvals
    const approvalsRes = await request(app)
      .get(`/api/admin/employees/${empId}/approvals`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(approvalsRes.status === 200, "SUITE29-WORKLOAD-019: Employee approvals endpoint returns 200");
    assert(approvalsRes.body.approvals.length === 2, `SUITE29-WORKLOAD-020: Approvals count matches records (expected 2, got ${approvalsRes.body.approvals.length})`);
    const hasTaskApproval = approvalsRes.body.approvals.some((a: any) => a.kind === "Task Completion" && a.taskDetails?._id === approvalTask._id.toString());
    assert(hasTaskApproval, "SUITE29-WORKLOAD-021: Task completion approval is included with task details");
    const hasReqApproval = approvalsRes.body.approvals.some((a: any) => a.kind === "Task Reassignment" && a.requestDetails?.reason === "Conflict of interest on matter");
    assert(hasReqApproval, "SUITE29-WORKLOAD-022: ApprovalRequest is included with request details");

    // TEST 8: Employee can view own approvals, but cannot view other employee's approvals
    const selfApprovalsRes = await request(app)
      .get(`/api/admin/employees/${empId}/approvals`)
      .set("Authorization", `Bearer ${s29EmpToken}`);
    assert(selfApprovalsRes.status === 200, "SUITE29-WORKLOAD-023: Employee can view own approvals with 200");
    const forbiddenApprovalsRes = await request(app)
      .get(`/api/admin/employees/${otherEmpId}/approvals`)
      .set("Authorization", `Bearer ${s29EmpToken}`);
    assert(forbiddenApprovalsRes.status === 403, "SUITE29-WORKLOAD-024: Unauthorized access to other employee approvals rejected with 403");

    // TEST 9: Clicked task details open correctly via GET /api/tasks/:id
    const taskDetailRes = await request(app)
      .get(`/api/tasks/${overdueTask._id.toString()}`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(taskDetailRes.status === 200, "SUITE29-WORKLOAD-025: Authoritative task detail opens with 200");
    assert(taskDetailRes.body.task.title === "S29 Overdue Task 1", "SUITE29-WORKLOAD-026: Task detail contains correct record title");
    assert(taskDetailRes.body.task.caseId._id.toString() === urgentCase2._id.toString(), "SUITE29-WORKLOAD-027: Task detail contains populated case relation");

    // TEST 10: Clicked case details open correctly via GET /api/cases/:id
    const caseDetailRes = await request(app)
      .get(`/api/cases/${activeCase1._id.toString()}`)
      .set("Authorization", `Bearer ${s29AdminToken}`);
    assert(caseDetailRes.status === 200, "SUITE29-WORKLOAD-028: Authoritative case detail opens with 200");
    assert(caseDetailRes.body.case.title === "S29 Employee Active Case 1", "SUITE29-WORKLOAD-029: Case detail contains correct case title");
    assert(caseDetailRes.body.case.number === activeCase1.number, "SUITE29-WORKLOAD-030: Case detail contains correct case number");
  }

  // =========================================================================
  // SUITE 30: Admin Dashboard Modernization & Chart Aggregation Verification
  // =========================================================================
  {
    console.log(`\n--- Suite 30: Admin Dashboard Modernization & Breakdown Endpoints ---`);

    const s30Admin = await createUser({
      name: "S30 Admin Adv",
      email: `s30-admin-${Date.now()}@test.com`,
      role: "admin",
      status: "active",
    });
    const s30AdminToken = await createToken(s30Admin);

    const s30Staff = await createUser({
      name: "S30 Staff Member",
      email: `s30-staff-${Date.now()}@test.com`,
      role: "office_staff",
      status: "active",
      permissions: {
        dashboard: true, clients: false, cases: false, tasks: false,
        documents: false, calendar: false, chat: false, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const s30StaffToken = await createToken(s30Staff);

    // 1. Authorization checks for breakdown endpoints
    const unauthCaseRes = await request(app).get("/api/admin/reports/case-status-breakdown");
    assert(unauthCaseRes.status === 401, "SUITE30-DASH-001: Unauthenticated case breakdown rejected with 401");

    const forbiddenCaseRes = await request(app)
      .get("/api/admin/reports/case-status-breakdown")
      .set("Authorization", `Bearer ${s30StaffToken}`);
    assert(forbiddenCaseRes.status === 403, "SUITE30-DASH-002: Unauthorized staff case breakdown rejected with 403");

    const unauthTaskRes = await request(app).get("/api/admin/reports/task-status-breakdown");
    assert(unauthTaskRes.status === 401, "SUITE30-DASH-003: Unauthenticated task breakdown rejected with 401");

    const forbiddenTaskRes = await request(app)
      .get("/api/admin/reports/task-status-breakdown")
      .set("Authorization", `Bearer ${s30StaffToken}`);
    assert(forbiddenTaskRes.status === 403, "SUITE30-DASH-004: Unauthorized staff task breakdown rejected with 403");

    // 2. Seed test cases for case-status-breakdown
    await Case.create({
      title: "S30 Active Matter",
      number: `S30-ACT-${Date.now()}`,
      status: "Active",
      createdBy: s30Admin._id,
      assignedBy: s30Admin._id,
    });
    await Case.create({
      title: "S30 Urgent Matter",
      number: `S30-URG-${Date.now()}`,
      status: "Urgent",
      createdBy: s30Admin._id,
      assignedBy: s30Admin._id,
    });
    await Case.create({
      title: "S30 On Hold Matter",
      number: `S30-HLD-${Date.now()}`,
      status: "On Hold",
      createdBy: s30Admin._id,
      assignedBy: s30Admin._id,
    });
    await Case.create({
      title: "S30 Closed Matter",
      number: `S30-CLS-${Date.now()}`,
      status: "Closed",
      createdBy: s30Admin._id,
      assignedBy: s30Admin._id,
    });

    // 3. Verify Case Status Breakdown endpoint
    const caseBreakdownRes = await request(app)
      .get("/api/admin/reports/case-status-breakdown")
      .set("Authorization", `Bearer ${s30AdminToken}`);
    assert(caseBreakdownRes.status === 200, "SUITE30-DASH-005: GET /api/admin/reports/case-status-breakdown returns 200");
    assert(typeof caseBreakdownRes.body.breakdown === "object", "SUITE30-DASH-006: Response contains breakdown object");
    assert(caseBreakdownRes.body.breakdown.Active >= 1, "SUITE30-DASH-007: Active cases counted (>= 1)");
    assert(caseBreakdownRes.body.breakdown.Urgent >= 1, "SUITE30-DASH-008: Urgent cases counted (>= 1)");
    assert(caseBreakdownRes.body.breakdown["On Hold"] >= 1, "SUITE30-DASH-009: On Hold cases counted (>= 1)");
    assert(caseBreakdownRes.body.breakdown.Closed >= 1, "SUITE30-DASH-010: Closed cases counted (>= 1)");
    const expectedCaseTotal =
      caseBreakdownRes.body.breakdown.Active +
      caseBreakdownRes.body.breakdown.Urgent +
      caseBreakdownRes.body.breakdown["On Hold"] +
      caseBreakdownRes.body.breakdown.Closed;
    assert(caseBreakdownRes.body.total === expectedCaseTotal, "SUITE30-DASH-011: Total cases matches sum of categories");

    // 4. Seed test tasks for task-status-breakdown
    await Task.create({
      title: "S30 Pending Task",
      status: "pending",
      assignedTo: s30Staff._id,
      createdBy: s30Admin._id,
    });
    await Task.create({
      title: "S30 In Progress Task",
      status: "in_progress",
      assignedTo: s30Staff._id,
      createdBy: s30Admin._id,
    });
    await Task.create({
      title: "S30 Approval Task",
      status: "pending_approval",
      assignedTo: s30Staff._id,
      createdBy: s30Admin._id,
    });
    await Task.create({
      title: "S30 Completed Task",
      status: "completed",
      assignedTo: s30Staff._id,
      createdBy: s30Admin._id,
      completedAt: new Date(),
    });
    // Deleted task should be excluded
    await Task.create({
      title: "S30 Deleted Task",
      status: "pending",
      assignedTo: s30Staff._id,
      createdBy: s30Admin._id,
      isDeleted: true,
    });

    // 5. Verify Task Status Breakdown endpoint
    const taskBreakdownRes = await request(app)
      .get("/api/admin/reports/task-status-breakdown")
      .set("Authorization", `Bearer ${s30AdminToken}`);
    assert(taskBreakdownRes.status === 200, "SUITE30-DASH-012: GET /api/admin/reports/task-status-breakdown returns 200");
    assert(typeof taskBreakdownRes.body.breakdown === "object", "SUITE30-DASH-013: Response contains breakdown object");
    assert(taskBreakdownRes.body.breakdown.pending >= 1, "SUITE30-DASH-014: Pending tasks counted (>= 1)");
    assert(taskBreakdownRes.body.breakdown.in_progress >= 1, "SUITE30-DASH-015: In progress tasks counted (>= 1)");
    assert(taskBreakdownRes.body.breakdown.pending_approval >= 1, "SUITE30-DASH-016: Pending approval tasks counted (>= 1)");
    assert(taskBreakdownRes.body.breakdown.completed >= 1, "SUITE30-DASH-017: Completed tasks counted (>= 1)");
    const expectedTaskTotal =
      taskBreakdownRes.body.breakdown.pending +
      taskBreakdownRes.body.breakdown.in_progress +
      taskBreakdownRes.body.breakdown.pending_approval +
      taskBreakdownRes.body.breakdown.overdue +
      taskBreakdownRes.body.breakdown.completed;
    assert(taskBreakdownRes.body.total === expectedTaskTotal, "SUITE30-DASH-018: Total tasks matches sum of categories");

    // 6. Verify Approvals Queue Endpoint returns enriched task details
    const approvalsRes = await request(app)
      .get("/api/admin/approvals")
      .set("Authorization", `Bearer ${s30AdminToken}`);
    assert(approvalsRes.status === 200, "SUITE30-DASH-019: GET /api/admin/approvals returns 200");
    assert(Array.isArray(approvalsRes.body.approvals), "SUITE30-DASH-020: Approvals list is an array");
    const foundApproval = approvalsRes.body.approvals.find(
      (a: any) => a.kind === "Task Completion" && a.title === "S30 Approval Task"
    );
    assert(Boolean(foundApproval), "SUITE30-DASH-021: Seeded pending approval task is present in approval queue");
    assert(Boolean(foundApproval.taskDetails), "SUITE30-DASH-022: Approval item contains enriched taskDetails for TaskDetailDialog");
  }

  // =========================================================================
  // SUITE 31: Approval Centre Professional Redesign & Authoritative Workflows
  // =========================================================================
  console.log("\n--- Suite 31: Approval Centre Professional Redesign & Workflows ---");
  {
    // 1. Create Admin and Regular Employee
    const s31Admin = await User.create({
      name: "S31 Admin Officer",
      email: "s31admin@stillworks.legal",
      passwordHash: await bcrypt.hash("AdminPass123!", 4),
      role: "admin",
      status: "online",
    });
    const s31AdminToken = await createToken(s31Admin);

    const s31Staff = await User.create({
      name: "S31 Junior Staff",
      email: "s31staff@stillworks.legal",
      passwordHash: await bcrypt.hash("StaffPass123!", 4),
      role: "junior_advocate",
      status: "offline",
      permissions: {
        dashboard: true, clients: false, cases: false, tasks: true,
        documents: false, calendar: false, chat: false, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });
    const s31StaffToken = await createToken(s31Staff);

    // 2. Authorization checks
    const unauthMetrics = await request(app)
      .get("/api/admin/approvals/metrics")
      .set("Authorization", `Bearer ${s31StaffToken}`);
    assert(unauthMetrics.status === 403, "SUITE31-APP-001: Staff without approvals permission denied metrics (403)");

    const unauthApprovals = await request(app)
      .get("/api/admin/approvals")
      .set("Authorization", `Bearer ${s31StaffToken}`);
    assert(unauthApprovals.status === 403, "SUITE31-APP-002: Staff without approvals permission denied approvals (403)");

    // 3. Seed test case & tasks
    const s31Case = await Case.create({
      title: "S31 High Court Appeal",
      number: "HC-2026-999",
      courtCaseId: "CC-999",
      status: "Active",
      practice: "Civil Litigation",
    });

    const pendingTask1 = await Task.create({
      title: "Draft Writ Petition for Appeal",
      description: "Prepare and file writ petition in high court",
      category: "Court Work",
      priority: "High",
      status: "pending_approval",
      assignedTo: s31Staff._id,
      assignedBy: s31Admin._id,
      caseId: s31Case._id,
      checklist: [
        { text: "Verify annexures", done: true },
        { text: "Client verification", done: true },
      ],
      submittedForApprovalAt: new Date(),
    });

    const pendingTask2 = await Task.create({
      title: "Pay Court Filing Fees",
      description: "Pay stamp duty and registry fees",
      category: "Finance",
      priority: "Medium",
      status: "pending_approval",
      assignedTo: s31Staff._id,
      assignedBy: s31Admin._id,
      caseId: s31Case._id,
      checklist: [
        { text: "Receipt attached", done: true },
      ],
      submittedForApprovalAt: new Date(),
    });

    // Seed an approval request
    await ApprovalRequest.create({
      type: "task_reassign",
      entityType: "Task",
      entityId: pendingTask1._id,
      requesterId: s31Staff._id,
      targetUserId: s31Admin._id,
      reason: "Needs senior counsel appearance",
      status: "pending",
    });

    // 4. Verify Metrics Endpoint
    const metricsRes = await request(app)
      .get("/api/admin/approvals/metrics")
      .set("Authorization", `Bearer ${s31AdminToken}`);
    assert(metricsRes.status === 200, "SUITE31-APP-003: GET /api/admin/approvals/metrics returns 200");
    assert(metricsRes.body.awaitingReview >= 3, "SUITE31-APP-004: Awaiting review includes seeded tasks & request (>= 3)");
    assert(metricsRes.body.submittedToday >= 3, "SUITE31-APP-005: Submitted today includes today's items (>= 3)");
    assert(typeof metricsRes.body.approvedThisMonth === "number", "SUITE31-APP-006: Approved this month is a valid number");
    assert(typeof metricsRes.body.rejectedThisMonth === "number", "SUITE31-APP-007: Rejected this month is a valid number");

    const initialApproved = metricsRes.body.approvedThisMonth;
    const initialRejected = metricsRes.body.rejectedThisMonth;

    // 5. Verify Approvals Queue with category counts and aging
    const approvalsRes = await request(app)
      .get("/api/admin/approvals?status=pending")
      .set("Authorization", `Bearer ${s31AdminToken}`);
    assert(approvalsRes.status === 200, "SUITE31-APP-008: GET /api/admin/approvals?status=pending returns 200");
    assert(Array.isArray(approvalsRes.body.approvals), "SUITE31-APP-009: Approvals list is an array");
    assert(Boolean(approvalsRes.body.categoryCounts), "SUITE31-APP-010: Response contains categoryCounts object");
    assert(approvalsRes.body.categoryCounts.tasks >= 2, "SUITE31-APP-011: categoryCounts.tasks >= 2");

    const foundTaskApproval = approvalsRes.body.approvals.find(
      (a: any) => a._id === `task_${pendingTask1._id.toString()}`
    );
    assert(Boolean(foundTaskApproval), "SUITE31-APP-012: Seeded pending task is found in approval list");
    assert(foundTaskApproval.category === "tasks", "SUITE31-APP-013: Category is 'tasks'");
    assert(foundTaskApproval.priority?.toLowerCase() === "high", "SUITE31-APP-014: Priority preserved as 'high'");
    assert(foundTaskApproval.agingLabel === "Today", "SUITE31-APP-015: Aging correctly computed as 'Today'");
    assert(foundTaskApproval.taskDetails.checklist.length === 2, "SUITE31-APP-016: Checklist items present in taskDetails");

    // 6. Verify Search Filtering
    const searchRes = await request(app)
      .get(`/api/admin/approvals?search=${encodeURIComponent("Draft Writ Petition")}`)
      .set("Authorization", `Bearer ${s31AdminToken}`);
    assert(searchRes.status === 200, "SUITE31-APP-017: Search returns 200");
    assert(searchRes.body.approvals.some((a: any) => a.title.includes("Draft Writ Petition")), "SUITE31-APP-018: Search finds title match");

    // 7. Test Approval Workflow (approve pendingTask1)
    const approveRes = await request(app)
      .post(`/api/tasks/${pendingTask1._id}/approve`)
      .set("Authorization", `Bearer ${s31AdminToken}`)
      .send({});
    assert(approveRes.status === 200, "SUITE31-APP-019: POST /api/tasks/:id/approve returns 200");
    assert(approveRes.body.task.status === "completed", "SUITE31-APP-020: Task transitioned to 'completed'");
    assert(Boolean(approveRes.body.task.approvedAt), "SUITE31-APP-021: Task has approvedAt timestamp");

    // Verify metrics updated
    const afterApproveMetrics = await request(app)
      .get("/api/admin/approvals/metrics")
      .set("Authorization", `Bearer ${s31AdminToken}`);
    assert(afterApproveMetrics.body.approvedThisMonth === initialApproved + 1, "SUITE31-APP-022: Approved this month incremented by 1");

    // 8. Test Rejection Workflow with mandatory reason
    const rejectNoReasonRes = await request(app)
      .post(`/api/tasks/${pendingTask2._id}/reject`)
      .set("Authorization", `Bearer ${s31AdminToken}`)
      .send({ reason: "   " });
    assert(rejectNoReasonRes.status === 400, "SUITE31-APP-023: Rejection without non-empty reason rejected (400)");

    const rejectWithReasonRes = await request(app)
      .post(`/api/tasks/${pendingTask2._id}/reject`)
      .set("Authorization", `Bearer ${s31AdminToken}`)
      .send({ reason: "Please attach original treasury challan receipt." });
    assert(rejectWithReasonRes.status === 200, "SUITE31-APP-024: Rejection with reason returns 200");

    const reloadedTask2 = await Task.findById(pendingTask2._id);
    assert(reloadedTask2?.status === "in_progress", "SUITE31-APP-025: Rejected task returned to 'in_progress'");
    assert(reloadedTask2?.rejectionReason === "Please attach original treasury challan receipt.", "SUITE31-APP-026: Rejection reason persisted");
    assert(Boolean(reloadedTask2?.rejectedAt), "SUITE31-APP-027: Task has rejectedAt timestamp");

    // Verify rejection metric updated
    const afterRejectMetrics = await request(app)
      .get("/api/admin/approvals/metrics")
      .set("Authorization", `Bearer ${s31AdminToken}`);
    assert(afterRejectMetrics.body.rejectedThisMonth === initialRejected + 1, "SUITE31-APP-028: Rejected this month incremented by 1");
  }

  // =========================================================================
  // SUITE 32: AUDIT LOGS ENTERPRISE ENDPOINTS, FILTERING, EXPORT & DUPLICATE PREVENTION
  // =========================================================================
  {
    console.log("\n--- SUITE 32: AUDIT LOGS ENTERPRISE ENDPOINTS & EXPORT ---");

    // 1. Create Admin and Regular Employee
    const s32Admin = await User.create({
      name: "Adv. Audit Partner",
      email: "audit.partner@stillworks.legal",
      passwordHash: await bcrypt.hash("SecPass123!", 8),
      role: "admin",
      status: "offline",
    });
    const s32AdminToken = jwt.sign(
      { userId: s32Admin._id.toString(), email: s32Admin.email, role: s32Admin.role },
      JWT_SECRET
    );
    await Session.create({
      userId: s32Admin._id,
      token: s32AdminToken,
      refreshTokenHash: "test_s32_admin_refresh_hash",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const s32Staff = await User.create({
      name: "Paralegal Actor",
      email: "paralegal.actor@stillworks.legal",
      passwordHash: await bcrypt.hash("SecPass123!", 8),
      role: "office_staff",
      status: "offline",
      permissions: { auditLogs: false },
    });
    const s32StaffToken = jwt.sign(
      { userId: s32Staff._id.toString(), email: s32Staff.email, role: s32Staff.role },
      JWT_SECRET
    );
    await Session.create({
      userId: s32Staff._id,
      token: s32StaffToken,
      refreshTokenHash: "test_s32_staff_refresh_hash",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // 2. Authorization check on audit-logs endpoints
    const unauthMetricsRes = await request(app)
      .get("/api/admin/audit-logs/metrics")
      .set("Authorization", `Bearer ${s32StaffToken}`);
    assert(unauthMetricsRes.status === 403, "SUITE32-AUD-001: Staff without auditLogs permission rejected (403) from metrics");

    const unauthLogsRes = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${s32StaffToken}`);
    assert(unauthLogsRes.status === 403, "SUITE32-AUD-002: Staff without auditLogs permission rejected (403) from logs");

    const unauthExportRes = await request(app)
      .get("/api/admin/audit-logs/export")
      .set("Authorization", `Bearer ${s32StaffToken}`);
    assert(unauthExportRes.status === 403, "SUITE32-AUD-003: Staff without auditLogs permission rejected (403) from export");

    // 3. Create Seed Audit Logs for testing
    // Normal entry
    await AuditLog.create({
      userId: s32Admin._id,
      userName: s32Admin.name,
      action: "create",
      resource: "case",
      resourceName: "Union of India vs ABC Infrastructure",
      details: "New commercial arbitration case registered",
      ip: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    });

    // Security entry (login)
    await AuditLog.create({
      userId: s32Staff._id,
      userName: s32Staff.name,
      action: "login",
      resource: "auth",
      details: "Staff logged into workstation",
      ip: "10.0.0.50",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    });

    // Malicious CSV formula injection attempt entry
    await AuditLog.create({
      userId: s32Admin._id,
      userName: "=cmd|' /C calc'!A0",
      action: "update",
      resource: "task",
      resourceName: "+2+5+cmd|' /C calc'!A0",
      details: "@SUM(1+1)*Something",
      ip: "-127.0.0.1",
      userAgent: "Node.js Custom Client",
    });

    // 4. Test GET /api/admin/audit-logs/metrics
    const metricsRes = await request(app)
      .get("/api/admin/audit-logs/metrics")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(metricsRes.status === 200, "SUITE32-AUD-004: GET /api/admin/audit-logs/metrics returns 200");
    assert(typeof metricsRes.body.totalEvents === "number" && metricsRes.body.totalEvents >= 3, "SUITE32-AUD-005: totalEvents returned");
    assert(typeof metricsRes.body.eventsToday === "number" && metricsRes.body.eventsToday >= 3, "SUITE32-AUD-006: eventsToday returned in IST");
    assert(typeof metricsRes.body.activeUsers === "number" && metricsRes.body.activeUsers >= 2, "SUITE32-AUD-007: activeUsers returned");
    assert(typeof metricsRes.body.securityEvents === "number" && metricsRes.body.securityEvents >= 1, "SUITE32-AUD-008: securityEvents returned");

    // 5. Test GET /api/admin/audit-logs with filters & pagination
    const logsRes = await request(app)
      .get("/api/admin/audit-logs?page=1&limit=10")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(logsRes.status === 200, "SUITE32-AUD-009: GET /api/admin/audit-logs returns 200");
    assert(Array.isArray(logsRes.body.logs), "SUITE32-AUD-010: logs is an array");
    assert(typeof logsRes.body.total === "number", "SUITE32-AUD-011: total count returned");
    assert(logsRes.body.page === 1, "SUITE32-AUD-012: page is 1");

    // Test action filter
    const actionFilterRes = await request(app)
      .get("/api/admin/audit-logs?action=login")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(actionFilterRes.status === 200, "SUITE32-AUD-013: action=login filter returns 200");
    assert(actionFilterRes.body.logs.every((l: any) => l.action === "login"), "SUITE32-AUD-014: All returned logs have action=login");

    // Test security filter
    const securityFilterRes = await request(app)
      .get("/api/admin/audit-logs?action=security")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(securityFilterRes.status === 200, "SUITE32-AUD-015: action=security filter returns 200");
    assert(securityFilterRes.body.logs.some((l: any) => l.action === "login"), "SUITE32-AUD-016: Security filter includes login events");

    // Test search filter
    const searchRes = await request(app)
      .get("/api/admin/audit-logs?search=arbitration")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(searchRes.status === 200, "SUITE32-AUD-017: search=arbitration returns 200");
    assert(searchRes.body.logs.some((l: any) => l.resourceName?.includes("ABC Infrastructure")), "SUITE32-AUD-018: Search finds matching record");

    // Test sorting
    const oldestRes = await request(app)
      .get("/api/admin/audit-logs?sortBy=oldest&limit=2")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(oldestRes.status === 200, "SUITE32-AUD-019: sortBy=oldest returns 200");

    // 6. Test GET /api/admin/audit-logs/export & CSV Formula Injection Sanitization
    const exportRes = await request(app)
      .get("/api/admin/audit-logs/export")
      .set("Authorization", `Bearer ${s32AdminToken}`);
    assert(exportRes.status === 200, "SUITE32-AUD-020: GET /api/admin/audit-logs/export returns 200");
    assert(exportRes.headers["content-type"]?.includes("text/csv"), "SUITE32-AUD-021: Content-Type is text/csv");
    assert(exportRes.headers["content-disposition"]?.includes("attachment"), "SUITE32-AUD-022: Content-Disposition is attachment");

    const csvText = exportRes.text;
    assert(csvText.includes("Timestamp (IST)"), "SUITE32-AUD-023: CSV header row present");

    // Formula injection check: cell starting with '=' must be sanitized to "'="
    assert(csvText.includes("\"'=cmd|' /C calc'!A0\""), "SUITE32-AUD-024: Formula injection '=' sanitized with single quote");
    // Cell starting with '+' must be sanitized to "'+..."
    assert(csvText.includes("\"'+2+5+cmd|' /C calc'!A0\""), "SUITE32-AUD-025: Formula injection '+' sanitized with single quote");
    // Cell starting with '@' must be sanitized to "'@..."
    assert(csvText.includes("\"'@SUM(1+1)*Something\""), "SUITE32-AUD-026: Formula injection '@' sanitized with single quote");
    // Cell starting with '-' must be sanitized to "'-..."
    assert(csvText.includes("\"'-127.0.0.1\""), "SUITE32-AUD-027: Formula injection '-' sanitized with single quote");

    // 7. Test Duplicate Audit Log Prevention on Task PATCH
    const testTask = await Task.create({
      title: "Task For Duplicate Log Audit",
      description: "Original description",
      status: "pending",
      category: "Litigation",
      priority: "Medium",
      assignedTo: s32Staff._id,
      createdBy: s32Admin._id,
    });

    const initialAuditCount = await AuditLog.countDocuments({ resourceId: testTask._id.toString() });

    // No-op PATCH with identical values (same title, category, priority, status)
    const noOpPatchRes = await request(app)
      .patch(`/api/tasks/${testTask._id}`)
      .set("Authorization", `Bearer ${s32AdminToken}`)
      .send({
        title: "Task For Duplicate Log Audit",
        category: "Litigation",
        priority: "Medium",
      });
    assert(noOpPatchRes.status === 200, "SUITE32-AUD-028: No-op task PATCH returns 200");

    const afterNoOpCount = await AuditLog.countDocuments({ resourceId: testTask._id.toString() });
    assert(afterNoOpCount === initialAuditCount, "SUITE32-AUD-029: No redundant audit log entry created on no-op task PATCH");

    // Actual change PATCH
    const realPatchRes = await request(app)
      .patch(`/api/tasks/${testTask._id}`)
      .set("Authorization", `Bearer ${s32AdminToken}`)
      .send({
        priority: "High",
      });
    assert(realPatchRes.status === 200, "SUITE32-AUD-030: Real change task PATCH returns 200");

    const afterRealChangeCount = await AuditLog.countDocuments({ resourceId: testTask._id.toString() });
    assert(afterRealChangeCount === initialAuditCount + 1, "SUITE32-AUD-031: Exactly one audit log entry created on genuine change");
    const latestLog = await AuditLog.findOne({ resourceId: testTask._id.toString() }).sort({ createdAt: -1 });
    assert(Boolean(latestLog?.details?.includes("Priority changed")), "SUITE32-AUD-032: Audit log contains accurate diff details");
  }

  // ── Suite 33: Task clientId Filtering ──────────────────────────────────────
  console.log("\nSuite: Task clientId Query Filtering");
  {
    // Setup: admin + advocate + two clients + tasks
    const s33Admin = await createUser({ role: "admin" });
    const s33AdminToken = await createToken(s33Admin);
    const s33Adv = await createUser({ role: "junior_advocate" });

    await seedCategories();

    const clientX = await Client.create({
      name: "Client X Corp",
      type: "Corporate",
      status: "Active",
      kycStatus: "Verified",
      createdBy: s33Admin._id,
    });
    const clientY = await Client.create({
      name: "Client Y Ltd",
      type: "Individual",
      status: "Active",
      kycStatus: "Pending",
      createdBy: s33Admin._id,
    });

    // Create tasks linked to clientX
    const taskX1 = await Task.create({
      title: "Draft contract for Client X",
      status: "pending",
      priority: "High",
      category: "Litigation",
      assignedTo: s33Adv._id,
      createdBy: s33Admin._id,
      clientId: clientX._id,
    });
    const taskX2 = await Task.create({
      title: "File appeal for Client X",
      status: "in_progress",
      priority: "Medium",
      category: "Litigation",
      assignedTo: s33Adv._id,
      createdBy: s33Admin._id,
      clientId: clientX._id,
    });
    // Create task linked to clientY
    await Task.create({
      title: "Mediation for Client Y",
      status: "pending",
      priority: "Low",
      category: "Litigation",
      assignedTo: s33Adv._id,
      createdBy: s33Admin._id,
      clientId: clientY._id,
    });
    // Create task with no clientId
    await Task.create({
      title: "Internal admin task",
      status: "pending",
      priority: "Low",
      category: "Litigation",
      assignedTo: s33Admin._id,
      createdBy: s33Admin._id,
    });

    // SUITE33-CLT-001: Admin can filter tasks by clientId
    const resClientX = await request(app)
      .get(`/api/tasks?clientId=${clientX._id.toString()}`)
      .set("Authorization", `Bearer ${s33AdminToken}`);
    assert(resClientX.status === 200, "SUITE33-CLT-001: GET /api/tasks?clientId returns 200");

    // SUITE33-CLT-002: Only tasks for clientX are returned
    const returnedIds: string[] = (resClientX.body.tasks ?? []).map((t: any) => t._id);
    assert(
      returnedIds.includes(taskX1._id.toString()) && returnedIds.includes(taskX2._id.toString()),
      "SUITE33-CLT-002: Both clientX tasks are in the response"
    );

    // SUITE33-CLT-003: clientY task is NOT returned in clientX query
    const clientYTaskInX = (resClientX.body.tasks ?? []).some((t: any) => t.clientId?.toString() === clientY._id.toString());
    assert(!clientYTaskInX, "SUITE33-CLT-003: clientY task is excluded from clientX filter");

    // SUITE33-CLT-004: Task count matches (exactly 2 for clientX)
    assert(
      (resClientX.body.tasks ?? []).length === 2,
      "SUITE33-CLT-004: Exactly 2 tasks returned for clientX"
    );

    // SUITE33-CLT-005: Filter by clientY returns 1 task
    const resClientY = await request(app)
      .get(`/api/tasks?clientId=${clientY._id.toString()}`)
      .set("Authorization", `Bearer ${s33AdminToken}`);
    assert(resClientY.status === 200 && (resClientY.body.tasks ?? []).length === 1, "SUITE33-CLT-005: clientY filter returns exactly 1 task");

    // SUITE33-CLT-006: Non-existent (valid-format) clientId returns 200 with empty array
    const nonExistentClientId = new mongoose.Types.ObjectId().toString();
    const resNonExistent = await request(app)
      .get(`/api/tasks?clientId=${nonExistentClientId}`)
      .set("Authorization", `Bearer ${s33AdminToken}`);
    assert(resNonExistent.status === 200, "SUITE33-CLT-006: Non-existent clientId returns 200");
    assert((resNonExistent.body.tasks ?? []).length === 0, "SUITE33-CLT-007: Non-existent clientId returns empty tasks array");

    // SUITE33-CLT-008: Multi-assignee task is included in clientId filter (admin sees all)
    const coAssignee = await createUser({ role: "junior_advocate" });
    await Task.create({
      title: "Multi-assignee task for Client X",
      status: "pending",
      priority: "High",
      category: "Litigation",
      assignedTo: s33Adv._id,
      assignedUsers: [s33Adv._id, coAssignee._id],
      createdBy: s33Admin._id,
      clientId: clientX._id,
    });
    // Admin should see 3 tasks now for clientX (2 original + 1 multi-assignee)
    const resWithMulti = await request(app)
      .get(`/api/tasks?clientId=${clientX._id.toString()}`)
      .set("Authorization", `Bearer ${s33AdminToken}`);
    assert(
      (resWithMulti.body.tasks ?? []).length === 3,
      "SUITE33-CLT-008: Multi-assignee task included in clientId filter (admin sees all 3)"
    );
  }

  // ===========================================================================
  // Suite P0-ASSIGN: Case-Created Task Assignment Regression Tests
  //
  // These tests reproduce the confirmed P0 bug where task.assignedTo received
  // an array from the frontend and mongoose.Types.ObjectId.isValid(array)
  // returned false, causing the creator to be silently substituted.
  //
  // Every test queries the database directly – not just the HTTP response – to
  // verify the actual persisted assignedTo, assignedUsers, assignedBy,
  // assignmentHistory, and notification records.
  // ===========================================================================
  console.log("\nSuite: P0 Case-Created Task Assignment (Regression)");
  {
    // ─── Setup: admin creator + target employee (Amal) ────────────────────
    const p0Admin = await createUser({
      name: "P0 Admin",
      email: `p0admin-${Date.now()}@test.com`,
      role: "admin",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    });
    const p0AdminToken = await createToken(p0Admin);

    const p0Amal = await createUser({
      name: "Amal",
      email: `amal-${Date.now()}@test.com`,
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: false, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });

    const p0Bob = await createUser({
      name: "Bob",
      email: `bob-${Date.now()}@test.com`,
      role: "junior_advocate",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: false, chat: true, reports: false,
        employees: false, approvals: false, auditLogs: false, settings: false,
      },
    });

    // ── P0-ASSIGN-001 & 002: Admin creates a case with two tasks both
    //   assigned to Amal via the array format (the format sent by the
    //   frontend AssigneeMultiSelect).
    //   BEFORE the fix: both tasks received p0Admin as assignedTo.
    //   AFTER  the fix: both tasks receive Amal as assignedTo.
    // ─────────────────────────────────────────────────────────────────────
    const caseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Regression Case",
        tasks: [
          {
            title: "Task 1 → Amal (array)",
            priority: "High",
            // Frontend sends an array from AssigneeMultiSelect
            assignedTo: [p0Amal._id.toString()],
            assignedUsers: [p0Amal._id.toString()],
          },
          {
            title: "Task 2 → Amal (array)",
            priority: "Medium",
            assignedTo: [p0Amal._id.toString()],
            assignedUsers: [p0Amal._id.toString()],
          },
        ],
      });

    assert(caseRes.status === 201, "P0-ASSIGN-001: Admin creates case with two initial tasks → 201");

    const caseId = caseRes.body.case._id;

    // Verify in the database directly
    const dbTask1 = await Task.findOne({ caseId, title: "Task 1 → Amal (array)" }).lean() as any;
    const dbTask2 = await Task.findOne({ caseId, title: "Task 2 → Amal (array)" }).lean() as any;

    assert(Boolean(dbTask1), "P0-ASSIGN-002: Task 1 persisted in DB");
    assert(Boolean(dbTask2), "P0-ASSIGN-003: Task 2 persisted in DB");

    // P0 core assertion: assignedTo must be Amal, NOT the admin/creator
    assert(
      dbTask1?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-004 [REGRESSION]: Task 1 assignedTo is Amal (not the admin creator)"
    );
    assert(
      dbTask2?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-005 [REGRESSION]: Task 2 assignedTo is Amal (not the admin creator)"
    );

    // assignedUsers must contain Amal
    assert(
      Array.isArray(dbTask1?.assignedUsers) &&
        dbTask1.assignedUsers.some((id: any) => id.toString() === p0Amal._id.toString()),
      "P0-ASSIGN-006: Task 1 assignedUsers includes Amal"
    );
    assert(
      Array.isArray(dbTask2?.assignedUsers) &&
        dbTask2.assignedUsers.some((id: any) => id.toString() === p0Amal._id.toString()),
      "P0-ASSIGN-007: Task 2 assignedUsers includes Amal"
    );

    // assignmentHistory must record Amal as toUser
    assert(
      Array.isArray(dbTask1?.assignmentHistory) && dbTask1.assignmentHistory.length > 0 &&
        dbTask1.assignmentHistory[0]?.toUser?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-008: Task 1 assignmentHistory[0].toUser is Amal"
    );
    assert(
      dbTask1?.assignmentHistory?.[0]?.assignedBy?.toString() === p0Admin._id.toString(),
      "P0-ASSIGN-009: Task 1 assignmentHistory[0].assignedBy is the admin (creator/assigner)"
    );

    // ── P0-ASSIGN-010: Tasks assigned to DIFFERENT employees retain
    //   independent assignments (no cross-contamination between tasks).
    // ─────────────────────────────────────────────────────────────────────
    const caseRes2 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Independent Assignee Case",
        tasks: [
          {
            title: "Task A → Amal",
            priority: "High",
            assignedTo: [p0Amal._id.toString()],
            assignedUsers: [p0Amal._id.toString()],
          },
          {
            title: "Task B → Bob",
            priority: "Low",
            assignedTo: [p0Bob._id.toString()],
            assignedUsers: [p0Bob._id.toString()],
          },
        ],
      });

    assert(caseRes2.status === 201, "P0-ASSIGN-010: Case with tasks for different employees → 201");

    const caseId2 = caseRes2.body.case._id;
    const dbTaskA = await Task.findOne({ caseId: caseId2, title: "Task A → Amal" }).lean() as any;
    const dbTaskB = await Task.findOne({ caseId: caseId2, title: "Task B → Bob" }).lean() as any;

    assert(
      dbTaskA?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-011: Task A assignedTo is Amal (independent from Task B)"
    );
    assert(
      dbTaskB?.assignedTo?.toString() === p0Bob._id.toString(),
      "P0-ASSIGN-012: Task B assignedTo is Bob (independent from Task A)"
    );
    assert(
      dbTaskA?.assignedTo?.toString() !== dbTaskB?.assignedTo?.toString(),
      "P0-ASSIGN-013: Task A and Task B have distinct assignees"
    );

    // ── P0-ASSIGN-014: Single-ID string format (legacy) still works
    // ─────────────────────────────────────────────────────────────────────
    const caseRes3 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Single-ID String Case",
        tasks: [
          {
            title: "Single-ID task",
            assignedTo: p0Amal._id.toString(), // single string, not an array
          },
        ],
      });

    assert(caseRes3.status === 201, "P0-ASSIGN-014: Single-string assignedTo → 201");
    const dbSingle = await Task.findOne({ caseId: caseRes3.body.case._id, title: "Single-ID task" }).lean() as any;
    assert(
      dbSingle?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-015: Single-string assignedTo persisted correctly"
    );

    // ── P0-ASSIGN-016: Multiple assignees in array – first is assignedTo
    // ─────────────────────────────────────────────────────────────────────
    const caseRes4 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Multi-Assignee Case",
        tasks: [
          {
            title: "Multi-assignee task",
            assignedTo: [p0Amal._id.toString(), p0Bob._id.toString()],
            assignedUsers: [p0Amal._id.toString(), p0Bob._id.toString()],
          },
        ],
      });

    assert(caseRes4.status === 201, "P0-ASSIGN-016: Multi-assignee array → 201");
    const dbMulti = await Task.findOne({ caseId: caseRes4.body.case._id, title: "Multi-assignee task" }).lean() as any;
    assert(
      dbMulti?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-017: First array element becomes assignedTo"
    );
    assert(
      Array.isArray(dbMulti?.assignedUsers) && dbMulti.assignedUsers.length === 2,
      "P0-ASSIGN-018: assignedUsers contains both assignees"
    );
    assert(
      dbMulti?.assignedUsers?.some((id: any) => id.toString() === p0Bob._id.toString()),
      "P0-ASSIGN-019: assignedUsers includes Bob"
    );
    // Multi-assignee: history has entry for each assignee
    assert(
      Array.isArray(dbMulti?.assignmentHistory) && dbMulti.assignmentHistory.length === 2,
      "P0-ASSIGN-020: assignmentHistory has one entry per assignee"
    );

    // ── P0-ASSIGN-021: Empty / null / absent assignee → falls back to creator
    // ─────────────────────────────────────────────────────────────────────
    const caseRes5 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Empty Assignee Case",
        tasks: [
          { title: "Unassigned task", assignedTo: [] },
          { title: "Null assignee task", assignedTo: null },
          { title: "No assignee field task" },
        ],
      });

    assert(caseRes5.status === 201, "P0-ASSIGN-021: Empty/null/absent assignee → 201");
    const caseId5 = caseRes5.body.case._id;
    const dbUnassigned = await Task.findOne({ caseId: caseId5, title: "Unassigned task" }).lean() as any;
    const dbNull = await Task.findOne({ caseId: caseId5, title: "Null assignee task" }).lean() as any;
    const dbNoField = await Task.findOne({ caseId: caseId5, title: "No assignee field task" }).lean() as any;

    assert(
      dbUnassigned?.assignedTo?.toString() === p0Admin._id.toString(),
      "P0-ASSIGN-022: Empty [] assignedTo falls back to creator (admin)"
    );
    assert(
      dbNull?.assignedTo?.toString() === p0Admin._id.toString(),
      "P0-ASSIGN-023: null assignedTo falls back to creator (admin)"
    );
    assert(
      dbNoField?.assignedTo?.toString() === p0Admin._id.toString(),
      "P0-ASSIGN-024: Missing assignedTo field falls back to creator (admin)"
    );

    // ── P0-ASSIGN-025: Duplicate IDs in array are deduplicated
    // ─────────────────────────────────────────────────────────────────────
    const caseRes6 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Duplicate ID Case",
        tasks: [
          {
            title: "Duplicate-ID task",
            assignedTo: [p0Amal._id.toString(), p0Amal._id.toString()],
            assignedUsers: [p0Amal._id.toString(), p0Amal._id.toString()],
          },
        ],
      });

    assert(caseRes6.status === 201, "P0-ASSIGN-025: Duplicate assignee IDs → 201");
    const dbDedup = await Task.findOne({ caseId: caseRes6.body.case._id, title: "Duplicate-ID task" }).lean() as any;
    assert(
      Array.isArray(dbDedup?.assignedUsers) && dbDedup.assignedUsers.length === 1,
      "P0-ASSIGN-026: Duplicate IDs are deduplicated in assignedUsers"
    );

    // ── P0-ASSIGN-027: Malformed ID string – falls back gracefully (logs warning, uses creator)
    // ─────────────────────────────────────────────────────────────────────
    const caseRes7 = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "P0 Malformed ID Case",
        tasks: [
          {
            title: "Malformed-ID task",
            assignedTo: ["not-a-valid-objectid"],
          },
        ],
      });

    // Case creation should still succeed (malformed task ID is non-fatal, falls back to creator)
    assert(caseRes7.status === 201, "P0-ASSIGN-027: Malformed assignee ID → case still created (201)");
    const dbMalformed = await Task.findOne({ caseId: caseRes7.body.case._id, title: "Malformed-ID task" }).lean() as any;
    assert(
      dbMalformed?.assignedTo?.toString() === p0Admin._id.toString(),
      "P0-ASSIGN-028: Malformed assignee ID falls back to creator"
    );

    // ── P0-ASSIGN-029: Non-admin user cannot assign tasks to other employees
    // ─────────────────────────────────────────────────────────────────────
    const nonAdminToken = await createToken(p0Amal);
    const caseResNonAdmin = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${nonAdminToken}`)
      .send({
        title: "P0 Non-Admin Case",
        tasks: [
          {
            title: "Non-admin task to Bob",
            assignedTo: [p0Bob._id.toString()],
            assignedUsers: [p0Bob._id.toString()],
          },
        ],
      });

    // The case should be created, but the task must be assigned to the creator (Amal), NOT Bob
    assert(caseResNonAdmin.status === 201, "P0-ASSIGN-029: Non-admin creates case → 201");
    const dbNonAdminTask = await Task.findOne({
      caseId: caseResNonAdmin.body.case._id,
      title: "Non-admin task to Bob",
    }).lean() as any;
    assert(
      dbNonAdminTask?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-030: Non-admin task assignedTo is enforced as the creator (not Bob)"
    );
    assert(
      dbNonAdminTask?.assignedTo?.toString() !== p0Bob._id.toString(),
      "P0-ASSIGN-031: Non-admin CANNOT assign task to another employee"
    );

    // ── P0-ASSIGN-032: Notification sent to Amal (not to creator) for
    //   a task admin assigns to Amal
    // ─────────────────────────────────────────────────────────────────────
    // (Notifications collection was cleared between tests but not between
    //  assertions within the same suite block – check against a fresh case.)
    const p0NotifAdmin = await createUser({
      name: "Notif Admin",
      email: `notifadmin-${Date.now()}@test.com`,
      role: "admin",
    });
    const p0NotifAdminToken = await createToken(p0NotifAdmin);
    const p0NotifTarget = await createUser({
      name: "Notif Target",
      email: `notiftarget-${Date.now()}@test.com`,
      role: "junior_advocate",
    });

    await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0NotifAdminToken}`)
      .send({
        title: "P0 Notification Regression Case",
        tasks: [
          {
            title: "Notif Task → Target",
            priority: "High",
            assignedTo: [p0NotifTarget._id.toString()],
            assignedUsers: [p0NotifTarget._id.toString()],
          },
        ],
      });

    const { Notification } = await import("../models/Notification.js");
const { NotificationService } = await import("../services/notifications.js");
    const notifForTarget = await Notification.findOne({
      userId: p0NotifTarget._id,
      type: "TASK_ASSIGNED",
    }).lean() as any;
    assert(Boolean(notifForTarget), "P0-ASSIGN-032: TASK_ASSIGNED notification sent to the intended assignee");

    // Ensure NO notification was sent to the admin for their own task assignment
    const notifForAdmin = await Notification.findOne({
      userId: p0NotifAdmin._id,
      type: "TASK_ASSIGNED",
    }).lean() as any;
    assert(!notifForAdmin, "P0-ASSIGN-033: No TASK_ASSIGNED notification sent to the creator (admin)");

    // ── P0-ASSIGN-034: Case creation WITHOUT initial tasks still works
    // ─────────────────────────────────────────────────────────────────────
    const caseNoTasks = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({ title: "P0 No Tasks Case" });

    assert(caseNoTasks.status === 201, "P0-ASSIGN-034: Case creation without tasks → 201");
    const taskCount = await Task.countDocuments({ caseId: caseNoTasks.body.case._id });
    assert(taskCount === 0, "P0-ASSIGN-035: No tasks created for case without tasks");

    // ── P0-ASSIGN-036: Standalone task creation retains existing array-assignee behaviour
    // ─────────────────────────────────────────────────────────────────────
    const standaloneRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${p0AdminToken}`)
      .send({
        title: "Standalone Task → Amal",
        priority: "Medium",
        assignedTo: [p0Amal._id.toString()],
        assignedUsers: [p0Amal._id.toString()],
      });

    assert(standaloneRes.status === 201, "P0-ASSIGN-036: Standalone task with array assignedTo → 201");
    const dbStandalone = await Task.findById(standaloneRes.body.task._id).lean() as any;
    assert(
      dbStandalone?.assignedTo?.toString() === p0Amal._id.toString(),
      "P0-ASSIGN-037: Standalone task assignedTo is Amal"
    );
    assert(
      Array.isArray(dbStandalone?.assignedUsers) &&
        dbStandalone.assignedUsers.some((id: any) => id.toString() === p0Amal._id.toString()),
      "P0-ASSIGN-038: Standalone task assignedUsers includes Amal"
    );
    assert(
      !dbStandalone?.caseId,
      "P0-ASSIGN-039: Standalone task has no caseId"
    );

    // ── Suite 35: Case Completion & Reopen Workflow ────────────────────────────
    console.log("\n--- Suite 35: Case Completion & Reopen Workflow ---");

    // Create an employee and admin for Suite 35
    const s35Admin = await User.create({
      name: "S35 Admin",
      email: `s35admin_${Date.now()}@test.local`,
      passwordHash: "dummyhash",
      role: "admin",
      isActive: true,
    });
    const s35AdminToken = jwt.sign(
      { userId: s35Admin._id.toString(), email: s35Admin.email, role: s35Admin.role },
      JWT_SECRET
    );
    await Session.create({
      userId: s35Admin._id,
      token: s35AdminToken,
      refreshTokenHash: "test_s35_admin_refresh_hash",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const s35Employee = await User.create({
      name: "S35 Employee",
      email: `s35emp_${Date.now()}@test.local`,
      passwordHash: "dummyhash",
      role: "junior_advocate",
      isActive: true,
    });
    const s35EmployeeToken = jwt.sign(
      { userId: s35Employee._id.toString(), email: s35Employee.email, role: s35Employee.role },
      JWT_SECRET
    );
    await Session.create({
      userId: s35Employee._id,
      token: s35EmployeeToken,
      refreshTokenHash: "test_s35_emp_refresh_hash",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Create a case with 2 tasks for testing Admin completion
    const s35Case1 = await Case.create({
      number: `CASE-S35-01-${Date.now()}`,
      title: "Suite 35 Admin Direct Complete Case",
      description: "Testing admin direct case completion",
      practice: "Corporate",
      court: "High Court",
      status: "Active",
      priority: "High",
      createdBy: s35Admin._id,
      assignedTo: s35Employee._id,
      parties: [],
      notes: [],
      timeline: [],
      progress: 0,
      tags: [],
    });

    const s35Task1_1 = await Task.create({
      title: "S35 Task 1.1",
      caseId: s35Case1._id,
      status: "in_progress",
      priority: "High",
      assignedTo: s35Employee._id,
      createdBy: s35Admin._id,
      category: "Drafting",
      checklist: [],
      remarks: [],
      assignmentHistory: [],
    });

    const s35Task1_2 = await Task.create({
      title: "S35 Task 1.2",
      caseId: s35Case1._id,
      status: "pending_approval",
      priority: "Medium",
      assignedTo: s35Employee._id,
      createdBy: s35Admin._id,
      category: "Review",
      checklist: [],
      remarks: [],
      assignmentHistory: [],
    });

    // TEST 1: Admin directly completes case
    const adminCompRes = await request(app)
      .post(`/api/cases/${s35Case1._id}/complete`)
      .set("Authorization", `Bearer ${s35AdminToken}`)
      .send({ note: "Case settled amicably" });

    assert(adminCompRes.status === 200, "S35-01: Admin direct completion -> 200");
    assert(adminCompRes.body.pendingApproval === false, "S35-02: Admin completion is NOT pending approval");

    const dbCase1 = await Case.findById(s35Case1._id).lean() as any;
    assert(dbCase1.status === "Closed", "S35-03: Case status is Closed");
    assert(Boolean(dbCase1.completedAt), "S35-04: Case completedAt is set");

    const dbTasks1 = await Task.find({ caseId: s35Case1._id }).lean() as any[];
    assert(dbTasks1.length === 2, "S35-05: Both tasks found");
    assert(dbTasks1.every((t) => t.status === "completed"), "S35-06: All tasks under completed case are marked completed");
    assert(dbTasks1.every((t) => Boolean(t.completedAt)), "S35-07: All tasks have completedAt set");

    // TEST 2: Reopen Case
    const reopenRes = await request(app)
      .post(`/api/cases/${s35Case1._id}/reopen`)
      .set("Authorization", `Bearer ${s35EmployeeToken}`)
      .send({});

    assert(reopenRes.status === 200, "S35-08: Reopening case -> 200");
    const dbCase1Reopened = await Case.findById(s35Case1._id).lean() as any;
    assert(dbCase1Reopened.status === "Active", "S35-09: Case status returned to Active");
    assert(dbCase1Reopened.completedAt === null, "S35-10: Case completedAt cleared on reopen");

    // Verify Admin received notification about reopen
    const adminNotif = await Notification.findOne({
      userId: s35Admin._id,
      title: "Case Reopened",
    }).lean() as any;
    assert(Boolean(adminNotif), "S35-11: Admin received notification for case reopen");
    assert(adminNotif.message.includes("S35 Employee"), "S35-12: Notification mentions the user who reopened");

    // TEST 3: Employee requests case completion
    const s35Case2 = await Case.create({
      number: `CASE-S35-02-${Date.now()}`,
      title: "Suite 35 Employee Request Case",
      description: "Testing employee case completion approval request",
      practice: "Property",
      court: "Civil Court",
      status: "Active",
      priority: "Medium",
      createdBy: s35Admin._id,
      assignedTo: s35Employee._id,
      parties: [],
      notes: [],
      timeline: [],
      progress: 0,
      tags: [],
    });

    const s35Task2_1 = await Task.create({
      title: "S35 Task 2.1",
      caseId: s35Case2._id,
      status: "in_progress",
      priority: "Medium",
      assignedTo: s35Employee._id,
      createdBy: s35Admin._id,
      category: "CIDCO",
      checklist: [],
      remarks: [],
      assignmentHistory: [],
    });

    const empCompRes = await request(app)
      .post(`/api/cases/${s35Case2._id}/complete`)
      .set("Authorization", `Bearer ${s35EmployeeToken}`)
      .send({ note: "All CIDCO orders retrieved" });

    assert(empCompRes.status === 200, "S35-13: Employee completion request -> 200");
    assert(empCompRes.body.pendingApproval === true, "S35-14: Employee completion requires admin approval");

    const s35ApprovalReq = await ApprovalRequest.findOne({
      entityId: s35Case2._id,
      type: "case_completion",
      status: "pending",
    }).lean() as any;
    assert(Boolean(s35ApprovalReq), "S35-15: ApprovalRequest of type case_completion created");

    const empNotif = await Notification.findOne({
      userId: s35Admin._id,
      title: "Case Completion Requested",
    }).lean() as any;
    assert(Boolean(empNotif), "S35-16: Admin received notification for case completion request");

    // Tasks under case should NOT be completed yet
    const dbTaskBeforeApprove = await Task.findById(s35Task2_1._id).lean() as any;
    assert(dbTaskBeforeApprove.status === "in_progress", "S35-17: Task is still in_progress before approval");

    // TEST 4: Admin approves the case completion
    const approveRes = await request(app)
      .post(`/api/approvals/${s35ApprovalReq._id}/approve`)
      .set("Authorization", `Bearer ${s35AdminToken}`)
      .send({ remark: "Well executed, case verified closed" });

    assert(approveRes.status === 200, "S35-18: Admin approves case completion -> 200");

    const dbCase2Approved = await Case.findById(s35Case2._id).lean() as any;
    assert(dbCase2Approved.status === "Closed", "S35-19: Case is now Closed");
    assert(Boolean(dbCase2Approved.completedAt), "S35-20: Case completedAt is set");

    const dbTaskAfterApprove = await Task.findById(s35Task2_1._id).lean() as any;
    assert(dbTaskAfterApprove.status === "completed", "S35-21: Task under case automatically marked completed on approval");
  }

  // --- Suite 36: Task Document Upload, Approval Centre Integration & Auto-Approval Workflow ---
  console.log("\n--- Suite 36: Task Document Upload, Approval Centre Integration & Auto-Approval Workflow ---");
  {
    // Create admin & employee
    const s36Admin = await User.create({
      name: "S36 Admin",
      email: `s36admin_${Date.now()}@stillworks.legal`,
      passwordHash: "hash",
      role: "admin",
      permissions: { all: true },
    });
    const s36AdminToken = await createToken(s36Admin);

    const s36Emp = await User.create({
      name: "S36 Employee",
      email: `s36emp_${Date.now()}@stillworks.legal`,
      passwordHash: "hash",
      role: "employee",
      permissions: { tasks: true, documents: true },
    });
    const s36EmpToken = await createToken(s36Emp);

    // 1. Create task assigned to employee
    const s36Task = await Task.create({
      title: "Draft Writ Petition & Attach Supporting Affidavits",
      description: "Complete the initial review and attach affidavit documentation",
      status: "in_progress",
      priority: "High",
      category: "Litigation",
      assignedTo: s36Emp._id,
      assignedUsers: [s36Emp._id],
      assignedBy: s36Admin._id,
      createdBy: s36Admin._id,
    });
    assert(Boolean(s36Task._id), "S36-01: Task created successfully and assigned to employee");

    // 2. Upload document attached to taskId
    const s36Doc = await DocumentModel.create({
      name: "Affidavit_Draft_v1.pdf",
      originalName: "Affidavit_Draft_v1.pdf",
      kind: "pdf",
      sizeFormatted: "45 KB",
      size: 46080,
      mimeType: "application/pdf",
      taskId: s36Task._id,
      uploadedBy: s36Emp._id,
      storagePath: "tasks/Affidavit_Draft_v1.pdf",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      state: "Pending",
    });
    assert(Boolean(s36Doc.taskId), "S36-02: Document created and linked to taskId");
    assert(s36Doc.state === "Pending", "S36-03: Newly uploaded task document starts in Pending state");

    // 3. Employee queries GET /api/documents?taskId=...
    const docQueryRes = await request(app)
      .get(`/api/documents?taskId=${s36Task._id}`)
      .set("Authorization", `Bearer ${s36EmpToken}`);

    assert(docQueryRes.status === 200, "S36-04: GET /api/documents?taskId=... returns 200");
    const queriedDoc = docQueryRes.body.documents?.find((d: any) => d._id === s36Doc._id.toString());
    assert(Boolean(queriedDoc), "S36-05: Task document returned in list query");
    assert(queriedDoc.canAccess === true, "S36-06: Employee assigned to task has canAccess: true");
    assert(queriedDoc.accessStatus === "approved", "S36-07: Employee assigned to task has accessStatus: approved");

    // 4. Employee submits task for approval
    const submitTaskRes = await request(app)
      .patch(`/api/tasks/${s36Task._id}`)
      .set("Authorization", `Bearer ${s36EmpToken}`)
      .send({ status: "pending_approval" });

    assert(submitTaskRes.status === 200, "S36-08: Employee submits task for approval -> 200");
    assert(submitTaskRes.body.task?.status === "pending_approval", "S36-09: Task status transitioned to pending_approval");

    // 5. Admin queries Approval Centre GET /api/admin/approvals
    const approvalsRes = await request(app)
      .get("/api/admin/approvals?category=tasks&status=pending")
      .set("Authorization", `Bearer ${s36AdminToken}`);

    assert(approvalsRes.status === 200, "S36-10: GET /api/admin/approvals returns 200");
    const taskApprovalItem = approvalsRes.body.approvals?.find((a: any) => a._id === `task_${s36Task._id}`);
    assert(Boolean(taskApprovalItem), "S36-11: Submitted task found in Admin Approvals list");
    assert(Array.isArray(taskApprovalItem.documents) && taskApprovalItem.documents.length === 1, "S36-12: Task approval item has attached documents populated");
    assert(taskApprovalItem.documents[0]._id.toString() === s36Doc._id.toString(), "S36-13: Attached document ID matches uploaded task document");
    assert(taskApprovalItem.context.includes("1 attached document"), "S36-14: Approval context highlights the attached document");
    assert(Boolean(taskApprovalItem.documentDetails), "S36-15: Document details populated on approval item for immediate drawer preview");

    // 6. Admin approves the task completion
    const adminApproveRes = await request(app)
      .post(`/api/tasks/${s36Task._id}/approve`)
      .set("Authorization", `Bearer ${s36AdminToken}`)
      .send({});

    assert(adminApproveRes.status === 200, "S36-16: Admin approves task completion -> 200");
    assert(adminApproveRes.body.task?.status === "completed", "S36-17: Task status is now completed");
    assert(Boolean(adminApproveRes.body.task?.approvedAt), "S36-18: Task approvedAt timestamp recorded");

    // 7. Verify attached document is automatically approved
    const dbDocAfterApprove = await DocumentModel.findById(s36Doc._id).lean() as any;
    assert(dbDocAfterApprove.state === "Approved", "S36-19: Document attached to task auto-transitioned to Approved state");
    assert(Boolean(dbDocAfterApprove.approvedAt), "S36-20: Document approvedAt timestamp recorded");
  }

  // --- Suite 37: Cross-Project Integration: Client Onboarding, Case Association, Task Linking & Document Visibility ---
  console.log("\n--- Suite 37: Cross-Project Integration: Client Onboarding, Case Association, Task Linking & Document Visibility ---");
  {
    const s37Admin = await User.create({
      name: "S37 Partner Admin",
      email: `s37admin_${Date.now()}@stillworks.legal`,
      passwordHash: "hash",
      role: "admin",
      permissions: { all: true },
    });
    const s37AdminToken = await createToken(s37Admin);

    const s37Emp = await User.create({
      name: "S37 Advocate",
      email: `s37emp_${Date.now()}@stillworks.legal`,
      passwordHash: "hash",
      role: "employee",
      permissions: { cases: true, tasks: true, documents: true, clients: true },
    });
    const s37EmpToken = await createToken(s37Emp);

    // 1. Create Client
    const clientRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${s37AdminToken}`)
      .send({
        name: "Acme Infra Ltd",
        type: "Corporate",
        phone: "9876543210",
        email: "contact@acmeinfra.com",
        address: "Plot 88, Financial District, Mumbai",
        tag: "Corporate",
        kyc: "Pending",
      });
    assert(clientRes.status === 201, "S37-01: Client created successfully -> 201");
    const s37Client = clientRes.body.client;
    assert(Boolean(s37Client._id), "S37-02: Created client has valid _id");

    // 2. Create Case linked to Client
    const caseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${s37AdminToken}`)
      .send({
        title: "Acme Infra Land Dispute Proceedings",
        practice: "Real Estate & Land",
        category: "Litigation",
        court: "High Court of Bombay",
        status: "Active",
        priority: "High",
        parties: [
          {
            name: s37Client.name,
            role: "Petitioner",
            type: "client",
            clientId: s37Client._id,
          },
        ],
      });
    assert(caseRes.status === 201, "S37-03: Case created linked to client -> 201");
    const s37Case = caseRes.body.case;
    assert(Boolean(s37Case._id), "S37-04: Created case has valid _id");

    // 3. Create Task under Case WITHOUT explicitly providing clientId
    const taskUnderCaseRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${s37AdminToken}`)
      .send({
        title: "Survey Land Boundaries & File Mutation Report",
        description: "Obtain government survey records for Acme Infra dispute",
        priority: "High",
        category: "Documentation",
        caseId: s37Case._id,
        assignedTo: s37Emp._id.toString(),
      });
    assert(taskUnderCaseRes.status === 201, "S37-05: Task created under case -> 201");
    const taskUnderCase = taskUnderCaseRes.body.task;
    assert(Boolean(taskUnderCase._id), "S37-06: Task has valid _id");
    assert(taskUnderCase.caseId?.toString() === s37Case._id.toString(), "S37-07: Task caseId matches parent case");
    // Verify auto-inheritance of clientId from parent case
    assert(taskUnderCase.clientId?.toString() === s37Client._id.toString(), "S37-08: Task clientId auto-inherited from parent case");

    // 4. Create Direct Task under Client (without case)
    const directClientTaskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${s37AdminToken}`)
      .send({
        title: "Annual Corporate Retainer Compliance Review",
        description: "Review board resolutions and identity documentation for Acme Infra",
        priority: "Medium",
        category: "Advisory",
        clientId: s37Client._id,
        assignedTo: s37Emp._id.toString(),
      });
    assert(directClientTaskRes.status === 201, "S37-09: Direct task under client created -> 201");
    const directClientTask = directClientTaskRes.body.task;
    assert(Boolean(directClientTask._id), "S37-10: Direct client task has valid _id");

    // 5. Query GET /api/tasks?clientId=...
    const clientTasksRes = await request(app)
      .get(`/api/tasks?clientId=${s37Client._id}`)
      .set("Authorization", `Bearer ${s37AdminToken}`);
    assert(clientTasksRes.status === 200, "S37-11: GET /api/tasks?clientId=... returns 200");
    const returnedTaskIds = clientTasksRes.body.tasks.map((t: any) => t._id.toString());
    assert(returnedTaskIds.includes(directClientTask._id.toString()), "S37-12: Client tasks query includes direct client task");
    assert(returnedTaskIds.includes(taskUnderCase._id.toString()), "S37-13: Client tasks query includes task linked via client's case");

    // 6. Test multipart file upload where fields arrive AFTER the file
    // Using supertest .attach() then .field() puts fields after file
    const uploadRes = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${s37EmpToken}`)
      .attach("file", Buffer.from("PDF DUMMY DOCUMENT CONTENT FOR MULTIPART TEST"), "Boundary_Survey_Map.pdf")
      .field("name", "Boundary_Survey_Map_Final.pdf")
      .field("taskId", taskUnderCase._id.toString())
      .field("caseId", s37Case._id.toString())
      .field("clientId", s37Client._id.toString());

    assert(uploadRes.status === 201, "S37-14: Upload stream accepts file before fields -> 201");
    const uploadedDoc = uploadRes.body.document;
    assert(Boolean(uploadedDoc._id), "S37-15: Uploaded document returned with valid _id");
    assert(uploadedDoc.taskId?.toString() === taskUnderCase._id.toString(), "S37-16: Uploaded document preserved taskId despite fields arriving after file");
    assert(uploadedDoc.caseId?.toString() === s37Case._id.toString(), "S37-17: Uploaded document preserved caseId");
    assert(uploadedDoc.clientId?.toString() === s37Client._id.toString(), "S37-18: Uploaded document preserved clientId");
    assert(uploadedDoc.state === "Pending", "S37-19: Uploaded document starts in Pending state");

    // 7. Query GET /api/clients/:clientId/documents
    const clientDocsRes = await request(app)
      .get(`/api/clients/${s37Client._id}/documents`)
      .set("Authorization", `Bearer ${s37AdminToken}`);
    assert(clientDocsRes.status === 200, "S37-20: GET /api/clients/:id/documents returns 200");
    const clientDocIds = clientDocsRes.body.documents.map((d: any) => d._id.toString());
    assert(clientDocIds.includes(uploadedDoc._id.toString()), "S37-21: Client documents list includes task-uploaded document");

    // 8. Query GET /api/documents?clientId=...
    const docQueryRes = await request(app)
      .get(`/api/documents?clientId=${s37Client._id}`)
      .set("Authorization", `Bearer ${s37AdminToken}`);
    assert(docQueryRes.status === 200, "S37-22: GET /api/documents?clientId=... returns 200");
    const generalDocIds = docQueryRes.body.documents.map((d: any) => d._id.toString());
    assert(generalDocIds.includes(uploadedDoc._id.toString()), "S37-23: General documents query includes document linked to client's case/task");

    // 9. Notification Deduplication Test:
    // Create notification with dedupeKey twice -> second creation returns existing without duplicating
    const dedupeKey = `test-dedupe-${Date.now()}`;
    const n1 = await NotificationService.createNotification({
      userId: s37Admin._id,
      type: "APPROVAL_REQUEST",
      title: "Deduplication Test Notification",
      message: "Testing single delivery",
      dedupeKey,
    });
    const n2 = await NotificationService.createNotification({
      userId: s37Admin._id,
      type: "APPROVAL_REQUEST",
      title: "Deduplication Test Notification Duplicate",
      message: "Testing single delivery second call",
      dedupeKey,
    });
    assert(Boolean(n1?._id), "S37-24: First notification created");
    assert(n1?._id?.toString() === n2?._id?.toString(), "S37-25: Second notification with same dedupeKey returned existing without duplicate entry");

    // Verify only 1 notification exists in DB
    const notifCount = await Notification.countDocuments({ dedupeKey });
    assert(notifCount === 1, "S37-26: Database holds exactly 1 notification for unique dedupeKey");
  }

  // =========================================================================
  // Suite 38: Hearing Date Synchronization & Permanent Hearing History
  // =========================================================================
  console.log("\n--- Suite 38: Hearing Date Synchronization & Permanent Hearing History ---");
  {
    const createTestToken = async (u: any) => {
      const token = jwt.sign(
        { userId: u._id.toString(), email: u.email, role: u.role },
        JWT_SECRET
      );
      await Session.create({
        userId: u._id,
        token,
        refreshTokenHash: `hash_${Date.now()}_${Math.random()}`,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      return token;
    };

    const s38Admin = await User.create({
      name: "Hearing Admin",
      email: `hearing.admin.${Date.now()}@stillworks.test`,
      passwordHash: await bcrypt.hash("Password123!", 10),
      role: "admin",
      status: "online",
    });
    const s38AdminToken = await createTestToken(s38Admin);

    const s38Emp = await User.create({
      name: "Hearing Emp",
      email: `hearing.emp.${Date.now()}@stillworks.test`,
      passwordHash: await bcrypt.hash("Password123!", 10),
      role: "employee",
      status: "online",
      permissions: { calendar: true, cases: true },
    });
    const s38EmpToken = await createTestToken(s38Emp);

    const s38Unauth = await User.create({
      name: "Hearing Unauth",
      email: `hearing.unauth.${Date.now()}@stillworks.test`,
      passwordHash: await bcrypt.hash("Password123!", 10),
      role: "employee",
      status: "online",
      permissions: { calendar: false, cases: false },
    });
    const s38UnauthToken = await createTestToken(s38Unauth);

    // 1. Creating a case with a next hearing creates/synchronizes canonical calendar event
    const caseDate1 = new Date("2026-10-19T10:00:00.000Z");
    const createCaseRes = await request(app)
      .post("/api/cases")
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        title: "Dispute over Land Parcel 102",
        category: "Property Law",
        court: "Bombay High Court",
        nextHearing: caseDate1.toISOString(),
      });
    assert(createCaseRes.status === 201, "S38-01: Case created with nextHearing -> 201");
    const caseId = createCaseRes.body.case._id;

    // Check calendar event created
    const calRes1 = await request(app)
      .get(`/api/calendar/events?caseId=${caseId}&type=hearing`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(calRes1.status === 200, "S38-02: Calendar query returns 200");
    assert(calRes1.body.events.length === 1, "S38-03: Exactly one canonical hearing event created on case creation");
    const event1 = calRes1.body.events[0];
    assert(event1.isNextHearing === true, "S38-04: Canonical event has isNextHearing: true");
    assert(new Date(event1.start).getTime() === caseDate1.getTime(), "S38-05: Calendar event start matches case nextHearing");

    // 2. Exact User Scenario: Record Hearing with remarks & add next date from Calendar
    // Existing: 19 October 2026
    // Remarks: "Matter heard; additional documents requested."
    // Next hearing: 2 November 2026
    const nextHearingDate2 = new Date("2026-11-02T10:00:00.000Z");
    const recordHearingRes = await request(app)
      .post(`/api/calendar/events/${event1._id}/record-hearing`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        status: "held",
        remarks: "Matter heard; additional documents requested.",
        nextHearingDate: nextHearingDate2.toISOString(),
      });
    assert(recordHearingRes.status === 200, "S38-06: Record hearing & add next date returns 200");
    assert(recordHearingRes.body.success === true, "S38-07: Record hearing reports success: true");

    // Check Calendar: 19 October remains on the calendar!
    const calRes2 = await request(app)
      .get(`/api/calendar/events?caseId=${caseId}&type=hearing&start=2026-01-01&end=2026-12-31`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(calRes2.status === 200, "S38-08: Calendar query after recording hearing returns 200");
    assert(calRes2.body.events.length === 2, "S38-09: Calendar now contains both 19 Oct and 2 Nov hearings");

    const octEvent = calRes2.body.events.find((e: any) => new Date(e.start).getTime() === caseDate1.getTime());
    const novEvent = calRes2.body.events.find((e: any) => new Date(e.start).getTime() === nextHearingDate2.getTime());
    assert(Boolean(octEvent), "S38-10: 19 October entry preserved in calendar");
    assert(octEvent.isNextHearing === false, "S38-11: 19 October entry demoted from canonical next hearing");
    assert(octEvent.hearingStatus === "held", "S38-12: 19 October entry marked with status 'held'");
    assert(octEvent.remarks === "Matter heard; additional documents requested.", "S38-13: 19 October entry has saved remarks");

    assert(Boolean(novEvent), "S38-14: 2 November appears as separate upcoming hearing in calendar");
    assert(novEvent.isNextHearing === true, "S38-15: 2 November is marked as canonical upcoming next hearing");

    // Check Cases tab & Case detail: shows 2 November as Next Hearing
    const caseDetailRes = await request(app)
      .get(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(caseDetailRes.status === 200, "S38-16: GET /api/cases/:id returns 200");
    assert(
      new Date(caseDetailRes.body.case.nextHearing).getTime() === nextHearingDate2.getTime(),
      "S38-17: Case.nextHearing updated to 2 November"
    );

    // Check Case hearing history
    const historyRes = await request(app)
      .get(`/api/cases/${caseId}/hearings`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(historyRes.status === 200, "S38-18: GET /api/cases/:id/hearings returns 200");
    assert(historyRes.body.hearings.length >= 1, "S38-19: Case has persistent hearing history");
    const hRecord1 = historyRes.body.hearings.find((h: any) => new Date(h.hearingDate).getTime() === caseDate1.getTime());
    assert(Boolean(hRecord1), "S38-20: History contains 19 October hearing record");
    assert(hRecord1.remarks === "Matter heard; additional documents requested.", "S38-21: History record contains remarks");
    assert(hRecord1.status === "held", "S38-22: History record has status 'held'");
    assert(new Date(hRecord1.nextHearingDate).getTime() === nextHearingDate2.getTime(), "S38-23: History record links to next date 2 November");

    // 3. Repeated submissions do not create duplicate history entries or canonical events (Idempotency)
    const repeatRes = await request(app)
      .post(`/api/calendar/events/${octEvent._id}/record-hearing`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        status: "held",
        remarks: "Matter heard; additional documents requested.",
        nextHearingDate: nextHearingDate2.toISOString(),
      });
    assert(repeatRes.status === 200, "S38-24: Repeated submission returns 200");
    const historyCount = await HearingRecord.countDocuments({ caseId, hearingDate: caseDate1 });
    assert(historyCount === 1, "S38-25: No duplicate HearingRecord created on retry");
    const canonicalCount = await CalendarEvent.countDocuments({ caseId, type: "hearing", isNextHearing: true });
    assert(canonicalCount === 1, "S38-26: Exactly one canonical upcoming event exists (no unique index violation)");

    // 4. Reverse workflow: update next hearing from Cases tab
    const nextHearingDate3 = new Date("2026-11-16T10:00:00.000Z");
    const patchCaseRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        nextHearing: nextHearingDate3.toISOString(),
        hearingRemarks: "Adjourned by consent; bench not sitting",
        hearingStatus: "rescheduled",
      });
    assert(patchCaseRes.status === 200, "S38-27: Case patched with new hearing date returns 200");
    assert(
      new Date(patchCaseRes.body.case.nextHearing).getTime() === nextHearingDate3.getTime(),
      "S38-28: Patched case has 16 November nextHearing"
    );

    // Confirm previous date (2 Nov) remains in history and on calendar, and 16 Nov is new canonical
    const calRes3 = await request(app)
      .get(`/api/calendar/events?caseId=${caseId}&type=hearing&start=2026-01-01&end=2026-12-31`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(calRes3.body.events.length === 3, "S38-29: Calendar retains all 3 dates (19 Oct, 2 Nov, 16 Nov)");

    const nov2Event = calRes3.body.events.find((e: any) => new Date(e.start).getTime() === nextHearingDate2.getTime());
    const nov16Event = calRes3.body.events.find((e: any) => new Date(e.start).getTime() === nextHearingDate3.getTime());
    assert(Boolean(nov2Event), "S38-30: 2 Nov preserved on calendar");
    assert(nov2Event.isNextHearing === false, "S38-31: 2 Nov is not canonical");
    assert(nov2Event.hearingStatus === "rescheduled", "S38-32: 2 Nov hearing marked as rescheduled without falsely marking held");

    assert(Boolean(nov16Event), "S38-33: 16 Nov present on calendar");
    assert(nov16Event.isNextHearing === true, "S38-34: 16 Nov is current canonical upcoming hearing");

    // 5. Calendar PATCH to update start date updates linked case nextHearing
    const nextHearingDate4 = new Date("2026-11-23T10:00:00.000Z");
    const calPatchRes = await request(app)
      .patch(`/api/calendar/events/${nov16Event._id}`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        start: nextHearingDate4.toISOString(),
        remarks: "Date adjusted on calendar",
      });
    assert(calPatchRes.status === 200, "S38-35: Calendar PATCH returns 200");
    const updatedCaseCheck = await Case.findById(caseId);
    assert(
      new Date(updatedCaseCheck?.nextHearing!).getTime() === nextHearingDate4.getTime(),
      "S38-36: Case.nextHearing synchronized from calendar PATCH to 23 Nov"
    );

    // 6. Invalid dates rejected without partial updates
    const invalidDateRes = await request(app)
      .patch(`/api/cases/${caseId}`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        nextHearing: "not-a-valid-date",
      });
    assert(invalidDateRes.status === 400, "S38-37: Invalid date format on case patch rejected with 400");
    const caseAfterInvalid = await Case.findById(caseId);
    assert(
      new Date(caseAfterInvalid?.nextHearing!).getTime() === nextHearingDate4.getTime(),
      "S38-38: Case nextHearing preserved intact after invalid date rejection"
    );

    // 7. Authorization: Unauthorized user cannot record hearing or update case
    const unauthRecordRes = await request(app)
      .post(`/api/calendar/events/${nov16Event._id}/record-hearing`)
      .set("Authorization", `Bearer ${s38UnauthToken}`)
      .send({
        status: "held",
        remarks: "Malicious update attempt",
      });
    assert(unauthRecordRes.status === 403, "S38-39: Unauthorized user blocked from recording hearing with 403");

    // 8. Unlinked hearing events do not cause case updates
    const unlinkedEventRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        title: "Unlinked General Hearing Mock",
        start: new Date("2026-12-01T10:00:00.000Z").toISOString(),
        type: "hearing",
      });
    assert(unlinkedEventRes.status === 201, "S38-40: Unlinked hearing event created -> 201");
    const unlinkedRecordRes = await request(app)
      .post(`/api/calendar/events/${unlinkedEventRes.body.event._id}/record-hearing`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        status: "held",
        remarks: "Should fail gracefully",
      });
    assert(unlinkedRecordRes.status === 400, "S38-41: Unlinked hearing rejected by record-hearing with 400");

    // 9. Editing unrelated calendar event types continues to work
    const taskEventRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        title: "Internal Partner Strategy Meeting",
        start: new Date("2026-12-05T14:00:00.000Z").toISOString(),
        type: "firm_event",
      });
    assert(taskEventRes.status === 201, "S38-42: Non-hearing event created -> 201");
    const taskPatchRes = await request(app)
      .patch(`/api/calendar/events/${taskEventRes.body.event._id}`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({
        title: "Internal Partner Strategy Meeting - Updated",
      });
    assert(taskPatchRes.status === 200, "S38-43: Non-hearing event edit returns 200");
    assert(taskPatchRes.body.event.title === "Internal Partner Strategy Meeting - Updated", "S38-44: Title updated successfully");

    // 10. Reopening case retains all hearing history and remarks
    await request(app)
      .post(`/api/cases/${caseId}/complete`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({ note: "Closing matter" });
    const reopenedRes = await request(app)
      .post(`/api/cases/${caseId}/reopen`)
      .set("Authorization", `Bearer ${s38AdminToken}`)
      .send({ reason: "Reopening matter to record further hearings" });
    assert(reopenedRes.status === 200, "S38-45: Case reopen returns 200");

    const caseReopenedHearings = await request(app)
      .get(`/api/cases/${caseId}/hearings`)
      .set("Authorization", `Bearer ${s38AdminToken}`);
    assert(caseReopenedHearings.status === 200, "S38-46: Hearing history query on reopened case returns 200");
    assert(caseReopenedHearings.body.hearings.length >= 2, "S38-47: Reopened case preserved all historical hearing entries");
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
