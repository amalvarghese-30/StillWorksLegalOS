// scratch/run-full-audit.mjs
// Automated End-to-End API, Security, RBAC & Functional Test Runner

const BASE_URL = "http://localhost:3001/api";

const results = [];

function recordTest(id, module, title, status, details, severity = "INFO") {
  results.push({ id, module, title, status, details, severity });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon} [${id}] [${module}] ${title} -> ${status}${status !== "PASS" ? " (" + severity + "): " + details : ""}`);
}

async function run() {
  console.log("==================================================================");
  console.log("STILLWORKS LEGALOS — PRODUCTION QA & SECURITY AUDIT TEST RUNNER");
  console.log("Target:", BASE_URL);
  console.log("==================================================================\n");

  let adminToken = "";
  let employeeToken = "";
  let adminUserId = "";
  let employeeUserId = "";

  // ---------------------------------------------------------------------------
  // 1. HEALTH & BASELINE
  // ---------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === "ok") {
      recordTest("API-001", "Health", "GET /api/health returns 200 and uptime", "PASS");
    } else {
      recordTest("API-001", "Health", "GET /api/health returned unexpected status", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("API-001", "Health", "GET /api/health failed to connect", "FAIL", err.message, "CRITICAL");
  }

  // ---------------------------------------------------------------------------
  // 2. AUTHENTICATION & LOGIN
  // ---------------------------------------------------------------------------
  // 2.1 Admin login
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rohan@stillworks.legal", password: "password123" }),
    });
    const data = await res.json();
    if (res.status === 200 && data.accessToken && data.user?.role === "admin") {
      adminToken = data.accessToken;
      adminUserId = data.user._id;
      recordTest("AUTH-001", "Auth", "Admin login succeeds with valid credentials", "PASS");
    } else {
      recordTest("AUTH-001", "Auth", "Admin login failed", "FAIL", JSON.stringify(data), "CRITICAL");
    }
  } catch (err) {
    recordTest("AUTH-001", "Auth", "Admin login network error", "FAIL", err.message, "CRITICAL");
  }

  // 2.2 Employee login (Priya)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "priya@stillworks.legal", password: "password123" }),
    });
    const data = await res.json();
    if (res.status === 200 && data.accessToken && data.user?.role === "legal_assistant") {
      employeeToken = data.accessToken;
      employeeUserId = data.user._id;
      recordTest("AUTH-002", "Auth", "Employee login succeeds with valid credentials", "PASS");
    } else {
      recordTest("AUTH-002", "Auth", "Employee login failed", "FAIL", JSON.stringify(data), "CRITICAL");
    }
  } catch (err) {
    recordTest("AUTH-002", "Auth", "Employee login network error", "FAIL", err.message, "CRITICAL");
  }

  // 2.3 Invalid credentials (wrong password)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rohan@stillworks.legal", password: "WrongPassword123!" }),
    });
    if (res.status === 401) {
      recordTest("AUTH-003", "Auth", "Invalid password rejected with 401", "PASS");
    } else {
      recordTest("AUTH-003", "Auth", "Invalid password did not return 401", "FAIL", `Status: ${res.status}`, "HIGH");
    }
  } catch (err) {
    recordTest("AUTH-003", "Auth", "Invalid password test error", "FAIL", err.message, "HIGH");
  }

  // 2.4 Non-existent user
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent.user.test@stillworks.legal", password: "password123" }),
    });
    if (res.status === 401) {
      recordTest("AUTH-004", "Auth", "Non-existent user rejected with 401 (no account enumeration)", "PASS");
    } else {
      recordTest("AUTH-004", "Auth", "Non-existent user did not return 401", "FAIL", `Status: ${res.status}`, "MEDIUM");
    }
  } catch (err) {
    recordTest("AUTH-004", "Auth", "Non-existent user test error", "FAIL", err.message, "MEDIUM");
  }

  // 2.5 Missing email/password
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }),
    });
    if (res.status === 400) {
      recordTest("AUTH-005", "Auth", "Missing fields rejected with 400", "PASS");
    } else {
      recordTest("AUTH-005", "Auth", "Missing fields did not return 400", "FAIL", `Status: ${res.status}`, "MEDIUM");
    }
  } catch (err) {
    recordTest("AUTH-005", "Auth", "Missing fields error", "FAIL", err.message, "MEDIUM");
  }

  // 2.6 NoSQL Injection attempt on Login
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: { "$gt": "" }, password: "password123" }),
    });
    // In express with express.json(), { $gt: "" } becomes an object.
    // If inputIdentifier = email.toLowerCase().trim() is called on non-string without checking, does it crash?
    if (res.status === 500) {
      const data = await res.json();
      recordTest("SEC-001", "Security", "NoSQL injection on login caused 500 unhandled TypeError crash", "FAIL", `Crashed with: ${JSON.stringify(data)} (email.toLowerCase is not a function when object passed)`, "HIGH");
    } else if (res.status === 400 || res.status === 401) {
      recordTest("SEC-001", "Security", "NoSQL injection on login safely rejected", "PASS");
    } else {
      recordTest("SEC-001", "Security", "NoSQL injection on login unexpected response", "WARN", `Status: ${res.status}`, "MEDIUM");
    }
  } catch (err) {
    recordTest("SEC-001", "Security", "NoSQL injection test error", "FAIL", err.message, "HIGH");
  }

  // 2.7 Token verification on protected route without token
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    if (res.status === 401) {
      recordTest("AUTH-006", "Auth", "Unauthenticated request to /auth/me rejected with 401", "PASS");
    } else {
      recordTest("AUTH-006", "Auth", "Unauthenticated request to /auth/me did not return 401", "FAIL", `Status: ${res.status}`, "CRITICAL");
    }
  } catch (err) {
    recordTest("AUTH-006", "Auth", "Unauthenticated me error", "FAIL", err.message, "HIGH");
  }

  // 2.8 Invalid JWT token
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: "Bearer invalid.jwt.token.here" },
    });
    if (res.status === 401) {
      recordTest("AUTH-007", "Auth", "Malformed JWT rejected with 401", "PASS");
    } else {
      recordTest("AUTH-007", "Auth", "Malformed JWT did not return 401", "FAIL", `Status: ${res.status}`, "CRITICAL");
    }
  } catch (err) {
    recordTest("AUTH-007", "Auth", "Malformed JWT error", "FAIL", err.message, "HIGH");
  }

  // 2.9 Valid JWT /auth/me
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.user?.email === "rohan@stillworks.legal") {
      recordTest("AUTH-008", "Auth", "Valid admin token returns profile on /auth/me", "PASS");
    } else {
      recordTest("AUTH-008", "Auth", "Valid admin token failed on /auth/me", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("AUTH-008", "Auth", "/auth/me error", "FAIL", err.message, "HIGH");
  }

  // ---------------------------------------------------------------------------
  // 3. AUTHORIZATION & RBAC TESTING
  // ---------------------------------------------------------------------------
  // 3.1 Can Priya (employee without admin permissions) access GET /api/admin/employees?
  try {
    const res = await fetch(`${BASE_URL}/admin/employees`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    if (res.status === 403) {
      recordTest("RBAC-001", "RBAC", "Employee without 'employees' perm denied GET /api/admin/employees with 403", "PASS");
    } else {
      recordTest("RBAC-001", "RBAC", "Employee accessed /api/admin/employees without permission!", "FAIL", `Status: ${res.status}, body: ${JSON.stringify(data).slice(0, 100)}`, "CRITICAL");
    }
  } catch (err) {
    recordTest("RBAC-001", "RBAC", "RBAC-001 test error", "FAIL", err.message, "HIGH");
  }

  // 3.2 Can Priya access GET /api/admin/audit-logs?
  try {
    const res = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    if (res.status === 403) {
      recordTest("RBAC-002", "RBAC", "Employee without 'auditLogs' perm denied GET /api/admin/audit-logs with 403", "PASS");
    } else {
      recordTest("RBAC-002", "RBAC", "Employee accessed /api/admin/audit-logs without permission!", "FAIL", `Status: ${res.status}`, "HIGH");
    }
  } catch (err) {
    recordTest("RBAC-002", "RBAC", "RBAC-002 test error", "FAIL", err.message, "HIGH");
  }

  // 3.3 Can Priya access GET /api/admin/storage?
  try {
    const res = await fetch(`${BASE_URL}/admin/storage`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    if (res.status === 403) {
      recordTest("RBAC-003", "RBAC", "Employee without 'settings' perm denied GET /api/admin/storage with 403", "PASS");
    } else {
      recordTest("RBAC-003", "RBAC", "Employee accessed /api/admin/storage without permission!", "FAIL", `Status: ${res.status}`, "HIGH");
    }
  } catch (err) {
    recordTest("RBAC-003", "RBAC", "RBAC-003 test error", "FAIL", err.message, "HIGH");
  }

  // 3.4 Can Priya modify storage config via PATCH /api/admin/storage?
  try {
    const res = await fetch(`${BASE_URL}/admin/storage`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${employeeToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://attacker-controlled.site" }),
    });
    if (res.status === 403) {
      recordTest("RBAC-004", "RBAC", "Employee without 'settings' perm denied PATCH /api/admin/storage with 403", "PASS");
    } else {
      recordTest("RBAC-004", "RBAC", "Employee modified storage config without permission!", "FAIL", `Status: ${res.status}`, "CRITICAL");
    }
  } catch (err) {
    recordTest("RBAC-004", "RBAC", "RBAC-004 test error", "FAIL", err.message, "CRITICAL");
  }

  // 3.5 Can Priya delete another user via DELETE /api/admin/employees/:id?
  try {
    const res = await fetch(`${BASE_URL}/admin/employees/${adminUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    if (res.status === 403) {
      recordTest("RBAC-005", "RBAC", "Employee denied DELETE /api/admin/employees/:id with 403", "PASS");
    } else {
      recordTest("RBAC-005", "RBAC", "Employee deleted admin or endpoint allowed unprivileged delete!", "FAIL", `Status: ${res.status}`, "CRITICAL");
    }
  } catch (err) {
    recordTest("RBAC-005", "RBAC", "RBAC-005 test error", "FAIL", err.message, "CRITICAL");
  }

  // 3.6 Can Admin delete their own account? (Should return 400 "You cannot delete your own account")
  try {
    const res = await fetch(`${BASE_URL}/admin/employees/${adminUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 400) {
      recordTest("RBAC-006", "RBAC", "Admin cannot delete their own account (returned 400)", "PASS");
    } else {
      recordTest("RBAC-006", "RBAC", "Admin self-deletion check failed", "FAIL", `Status: ${res.status}`, "HIGH");
    }
  } catch (err) {
    recordTest("RBAC-006", "RBAC", "RBAC-006 test error", "FAIL", err.message, "HIGH");
  }

  // ---------------------------------------------------------------------------
  // 4. CLIENTS MODULE TESTS
  // ---------------------------------------------------------------------------
  let testClientId = "";
  // 4.1 Create Client as Admin
  try {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Audit Client Inc",
        phone: "+91 99999 88888",
        email: "audit.client@test.legal",
        type: "Corporate",
        tag: "Active",
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.client?._id) {
      testClientId = data.client._id;
      recordTest("CLIENT-001", "Clients", "Create valid client returns 201 with client._id", "PASS");
    } else {
      recordTest("CLIENT-001", "Clients", "Create client failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("CLIENT-001", "Clients", "Create client error", "FAIL", err.message, "HIGH");
  }

  // 4.2 Create Client missing name
  try {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "noname@client.test" }),
    });
    if (res.status === 400) {
      recordTest("CLIENT-002", "Clients", "Create client without name rejected with 400", "PASS");
    } else {
      recordTest("CLIENT-002", "Clients", "Create client without name did not return 400", "FAIL", `Status: ${res.status}`, "MEDIUM");
    }
  } catch (err) {
    recordTest("CLIENT-002", "Clients", "Create client missing name error", "FAIL", err.message, "MEDIUM");
  }

  // 4.3 Read Client by ID
  if (testClientId) {
    try {
      const res = await fetch(`${BASE_URL}/clients/${testClientId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.client?.name === "Test Audit Client Inc") {
        recordTest("CLIENT-003", "Clients", "Read client by ID returns 200", "PASS");
      } else {
        recordTest("CLIENT-003", "Clients", "Read client by ID failed", "FAIL", JSON.stringify(data), "HIGH");
      }
    } catch (err) {
      recordTest("CLIENT-003", "Clients", "Read client error", "FAIL", err.message, "HIGH");
    }
  }

  // 4.4 Update Client
  if (testClientId) {
    try {
      const res = await fetch(`${BASE_URL}/clients/${testClientId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ address: "42 Nariman Point, Mumbai" }),
      });
      const data = await res.json();
      if (res.status === 200 && data.client?.address === "42 Nariman Point, Mumbai") {
        recordTest("CLIENT-004", "Clients", "Update client returns 200 with updated fields", "PASS");
      } else {
        recordTest("CLIENT-004", "Clients", "Update client failed", "FAIL", JSON.stringify(data), "HIGH");
      }
    } catch (err) {
      recordTest("CLIENT-004", "Clients", "Update client error", "FAIL", err.message, "HIGH");
    }
  }

  // ---------------------------------------------------------------------------
  // 5. CASES MODULE TESTS
  // ---------------------------------------------------------------------------
  let testCaseId = "";
  // 5.1 Create Case as Admin
  try {
    const res = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Audit Test Case: State vs Test Corp",
        practice: "Criminal",
        court: "Bombay High Court",
        priority: "High",
        status: "Active",
        assignedTo: employeeUserId,
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.case?._id) {
      testCaseId = data.case._id;
      recordTest("CASE-001", "Cases", "Create valid case returns 201 with case._id", "PASS");
    } else {
      recordTest("CASE-001", "Cases", "Create case failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("CASE-001", "Cases", "Create case error", "FAIL", err.message, "HIGH");
  }

  // 5.2 Create Case missing title
  try {
    const res = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ practice: "Tax" }),
    });
    if (res.status === 400) {
      recordTest("CASE-002", "Cases", "Create case without title rejected with 400", "PASS");
    } else {
      recordTest("CASE-002", "Cases", "Create case without title did not return 400", "FAIL", `Status: ${res.status}`, "MEDIUM");
    }
  } catch (err) {
    recordTest("CASE-002", "Cases", "Create case missing title error", "FAIL", err.message, "MEDIUM");
  }

  // 5.3 Non-admin assigning case to another user (should assign to themselves or reject)
  try {
    const res = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${employeeToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Priya Self Assigned Case",
        assignedTo: adminUserId, // Trying to assign to Rohan
      }),
    });
    const data = await res.json();
    if (res.status === 201) {
      // Backend should force assignedTo to be Priya's userId
      if (data.case?.assignedTo?._id === employeeUserId || data.case?.assignedTo === employeeUserId) {
        recordTest("CASE-003", "Cases", "Non-admin cannot reassign case on creation (overridden to self)", "PASS");
      } else {
        recordTest("CASE-003", "Cases", "Non-admin assigned case to another user without admin rights!", "FAIL", `assignedTo: ${data.case?.assignedTo}`, "HIGH");
      }
      // cleanup case
      if (data.case?._id) {
        await fetch(`${BASE_URL}/cases/${data.case._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
    }
  } catch (err) {
    recordTest("CASE-003", "Cases", "Case assignment test error", "FAIL", err.message, "HIGH");
  }

  // 5.4 Read Case Details by ID
  if (testCaseId) {
    try {
      const res = await fetch(`${BASE_URL}/cases/${testCaseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.case?.title) {
        recordTest("CASE-004", "Cases", "Read case details returns 200 with populated relations", "PASS");
      } else {
        recordTest("CASE-004", "Cases", "Read case details failed", "FAIL", JSON.stringify(data), "HIGH");
      }
    } catch (err) {
      recordTest("CASE-004", "Cases", "Read case error", "FAIL", err.message, "HIGH");
    }
  }

  // 5.5 Case IDOR: Can another employee without cases permission access a case they are NOT assigned to?
  // Let's create a case assigned strictly to Rohan:
  let rohanPrivateCaseId = "";
  try {
    const res = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Rohan Confidential Private Case",
        practice: "Arbitration",
        assignedTo: adminUserId,
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.case?._id) {
      rohanPrivateCaseId = data.case._id;
    }
  } catch (err) {
    console.error("Failed to create rohan private case:", err);
  }

  if (rohanPrivateCaseId) {
    try {
      // Priya has permissions.cases = true in user record currently. Let's check:
      const res = await fetch(`${BASE_URL}/cases/${rohanPrivateCaseId}`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      const data = await res.json();
      // In authorization.ts: canAccessCase returns true if userPermissions?.cases === true.
      // If Priya has cases: true, she can view all cases.
      // What about a user who has cases: false?
      recordTest("CASE-005", "Cases", `Priya access to confidential case: status ${res.status}`, "INFO", `Priya permissions.cases is ${res.status === 200 ? "ENABLED (allowed)" : "DISABLED (denied: 403)"}`);
    } catch (err) {
      recordTest("CASE-005", "Cases", "IDOR check error", "FAIL", err.message, "HIGH");
    }
  }

  // ---------------------------------------------------------------------------
  // 6. TASKS MODULE TESTS
  // ---------------------------------------------------------------------------
  let testTaskId = "";
  // 6.1 Create Task as Admin assigned to Priya
  try {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Audit Test Task: File Written Statement",
        priority: "High",
        category: "Court Filing",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        assignedTo: employeeUserId,
        caseId: testCaseId || undefined,
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.task?._id) {
      testTaskId = data.task._id;
      recordTest("TASK-001", "Tasks", "Create valid task returns 201 with task._id", "PASS");
    } else {
      recordTest("TASK-001", "Tasks", "Create task failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("TASK-001", "Tasks", "Create task error", "FAIL", err.message, "HIGH");
  }

  // 6.2 Employee completing their task
  if (testTaskId) {
    try {
      const res = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${employeeToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (res.status === 200 && data.task?.status === "completed") {
        recordTest("TASK-002", "Tasks", "Employee updates task status to completed returns 200", "PASS");
      } else {
        recordTest("TASK-002", "Tasks", "Task update status failed", "FAIL", JSON.stringify(data), "HIGH");
      }
    } catch (err) {
      recordTest("TASK-002", "Tasks", "Task update error", "FAIL", err.message, "HIGH");
    }
  }

  // 6.3 Non-admin attempting to reassign task to someone else
  if (testTaskId) {
    try {
      const res = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${employeeToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: adminUserId }),
      });
      if (res.status === 403) {
        recordTest("TASK-003", "Tasks", "Non-admin cannot reassign task to another user (403)", "PASS");
      } else {
        recordTest("TASK-003", "Tasks", "Non-admin reassigned task to another user!", "FAIL", `Status: ${res.status}`, "HIGH");
      }
    } catch (err) {
      recordTest("TASK-003", "Tasks", "Task reassign error", "FAIL", err.message, "HIGH");
    }
  }

  // ---------------------------------------------------------------------------
  // 7. CALENDAR & HEARINGS MODULE TESTS
  // ---------------------------------------------------------------------------
  let testEventId = "";
  // 7.1 Create hearing as Admin
  try {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hearing before Justice S. Patel",
        type: "hearing",
        start: new Date(Date.now() + 3 * 86400000).toISOString(),
        end: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
        caseId: testCaseId || undefined,
        assignedTo: [employeeUserId],
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.event?._id) {
      testEventId = data.event._id;
      recordTest("CAL-001", "Calendar", "Create calendar hearing returns 201 with event._id", "PASS");
    } else {
      recordTest("CAL-001", "Calendar", "Create hearing failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("CAL-001", "Calendar", "Create hearing error", "FAIL", err.message, "HIGH");
  }

  // 7.2 Calendar events listing with date filter
  try {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.events)) {
      recordTest("CAL-002", "Calendar", "GET /api/calendar/events returns list array", "PASS");
    } else {
      recordTest("CAL-002", "Calendar", "GET /api/calendar/events failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("CAL-002", "Calendar", "GET /api/calendar/events error", "FAIL", err.message, "HIGH");
  }

  // ---------------------------------------------------------------------------
  // 8. NOTIFICATIONS MODULE TESTS
  // ---------------------------------------------------------------------------
  // 8.1 Employee fetches their notifications
  try {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.notifications)) {
      recordTest("NOTIF-001", "Notifications", `GET /api/notifications returns array (${data.total} notifications found)`, "PASS");
    } else {
      recordTest("NOTIF-001", "Notifications", "GET /api/notifications failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("NOTIF-001", "Notifications", "GET /api/notifications error", "FAIL", err.message, "HIGH");
  }

  // 8.2 Unread count
  try {
    const res = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && typeof data.unreadCount === "number") {
      recordTest("NOTIF-002", "Notifications", `GET /api/notifications/unread-count returns integer (${data.unreadCount})`, "PASS");
    } else {
      recordTest("NOTIF-002", "Notifications", "GET /api/notifications/unread-count failed", "FAIL", JSON.stringify(data), "MEDIUM");
    }
  } catch (err) {
    recordTest("NOTIF-002", "Notifications", "Unread count error", "FAIL", err.message, "MEDIUM");
  }

  // 8.3 Mark all notifications as read
  try {
    const res = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    if (res.status === 200) {
      recordTest("NOTIF-003", "Notifications", "PATCH /api/notifications/read-all marks notifications as read", "PASS");
    } else {
      recordTest("NOTIF-003", "Notifications", "Mark all read failed", "FAIL", JSON.stringify(data), "MEDIUM");
    }
  } catch (err) {
    recordTest("NOTIF-003", "Notifications", "Mark all read error", "FAIL", err.message, "MEDIUM");
  }

  // ---------------------------------------------------------------------------
  // 9. SEARCH MODULE TESTS
  // ---------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/search?q=Statement`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.cases && data.tasks && data.clients && data.documents) {
      recordTest("SEARCH-001", "Search", "GET /api/search?q=... returns aggregated multi-entity results", "PASS");
    } else {
      recordTest("SEARCH-001", "Search", "GET /api/search failed or returned invalid shape", "FAIL", JSON.stringify(data), "MEDIUM");
    }
  } catch (err) {
    recordTest("SEARCH-001", "Search", "Search error", "FAIL", err.message, "MEDIUM");
  }

  // 9.2 Empty query should return empty lists without crashing
  try {
    const res = await fetch(`${BASE_URL}/search?q=`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.cases.length === 0) {
      recordTest("SEARCH-002", "Search", "GET /api/search with empty query returns empty results cleanly", "PASS");
    } else {
      recordTest("SEARCH-002", "Search", "GET /api/search with empty query failed", "FAIL", JSON.stringify(data), "LOW");
    }
  } catch (err) {
    recordTest("SEARCH-002", "Search", "Empty search error", "FAIL", err.message, "LOW");
  }

  // ---------------------------------------------------------------------------
  // 10. CHAT MODULE TESTS
  // ---------------------------------------------------------------------------
  let testGroupId = "";
  // 10.1 List chat groups
  try {
    const res = await fetch(`${BASE_URL}/chat/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.groups)) {
      recordTest("CHAT-001", "Chat", `GET /api/chat/groups returns list (${data.groups.length} groups)`, "PASS");
      if (data.groups.length > 0) testGroupId = data.groups[0]._id;
    } else {
      recordTest("CHAT-001", "Chat", "GET /api/chat/groups failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("CHAT-001", "Chat", "Chat groups error", "FAIL", err.message, "HIGH");
  }

  // 10.2 Send message to existing group
  if (testGroupId) {
    try {
      const res = await fetch(`${BASE_URL}/chat/groups/${testGroupId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Automated QA Audit Verification Message." }),
      });
      const data = await res.json();
      if (res.status === 201 && data.message?._id) {
        recordTest("CHAT-002", "Chat", "POST message to chat group succeeds with 201", "PASS");
      } else {
        recordTest("CHAT-002", "Chat", "POST message failed", "FAIL", JSON.stringify(data), "HIGH");
      }
    } catch (err) {
      recordTest("CHAT-002", "Chat", "Send message error", "FAIL", err.message, "HIGH");
    }
  }

  // 10.3 Send message over length cap (>10000 chars)
  if (testGroupId) {
    try {
      const hugeText = "A".repeat(10001);
      const res = await fetch(`${BASE_URL}/chat/groups/${testGroupId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: hugeText }),
      });
      if (res.status === 400) {
        recordTest("CHAT-003", "Chat", "Message over 10,000 character limit rejected with 400", "PASS");
      } else {
        recordTest("CHAT-003", "Chat", "Message over limit did not return 400", "FAIL", `Status: ${res.status}`, "MEDIUM");
      }
    } catch (err) {
      recordTest("CHAT-003", "Chat", "Message length test error", "FAIL", err.message, "MEDIUM");
    }
  }

  // ---------------------------------------------------------------------------
  // 11. AUDIT LOGS & TAMPER-EVIDENCE
  // ---------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.logs)) {
      recordTest("AUDIT-001", "AuditLog", `GET /api/admin/audit-logs returns log trail (${data.total} logs in DB)`, "PASS");
    } else {
      recordTest("AUDIT-001", "AuditLog", "GET audit logs failed", "FAIL", JSON.stringify(data), "HIGH");
    }
  } catch (err) {
    recordTest("AUDIT-001", "AuditLog", "Audit logs error", "FAIL", err.message, "HIGH");
  }

  // 11.2 Verify audit log chain integrity
  try {
    const res = await fetch(`${BASE_URL}/admin/integrity/audit-chain`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.valid === true) {
      recordTest("AUDIT-002", "AuditLog", `Cryptographic SHA-256 audit log chain verified: VALID (${data.totalChecked} checked)`, "PASS");
    } else {
      recordTest("AUDIT-002", "AuditLog", "Audit log chain verification failed or broken!", "FAIL", JSON.stringify(data), "CRITICAL");
    }
  } catch (err) {
    recordTest("AUDIT-002", "AuditLog", "Audit chain verify error", "FAIL", err.message, "HIGH");
  }

  // ---------------------------------------------------------------------------
  // 12. CLEANUP TEST DATA
  // ---------------------------------------------------------------------------
  if (testTaskId) {
    await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }
  if (testEventId) {
    await fetch(`${BASE_URL}/calendar/events/${testEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }
  if (testCaseId) {
    await fetch(`${BASE_URL}/cases/${testCaseId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }
  if (rohanPrivateCaseId) {
    await fetch(`${BASE_URL}/cases/${rohanPrivateCaseId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }
  if (testClientId) {
    await fetch(`${BASE_URL}/clients/${testClientId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }

  console.log("\n==================================================================");
  console.log("TEST RUN COMPLETE");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const warnings = results.filter(r => r.status === "WARN" || r.status === "INFO").length;
  console.log(`Passed: ${passed} | Failed: ${failed} | Warnings/Info: ${warnings} | Total: ${results.length}`);
  console.log("==================================================================");
}

run();
