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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set("io", null);
  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/cases", casesRoutes);
  app.use("/api/clients", clientsRoutes);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/reminders", remindersRoutes);
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
  console.log("\n--- Starting In-Memory MongoDB ---");
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "test_db" });
  console.log("Connected to MongoDB Memory Server\n");

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
  }

  await mongoose.disconnect();
  await mongod.stop();

  console.log(`\n========================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
