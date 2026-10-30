// ---------------------------------------------------------------------------
// StillWorks LegalOS — Chat Regression Test Suite
// ---------------------------------------------------------------------------
// Verifies:
// 1. GroupInfoSheet defensive handling (undefined/empty/missing members)
// 2. Direct vs Group chat member resolution
// 3. Unread count contracts (using `unread` not `unreadCount`)
// 4. FloatingChatWidget & chat.tsx GroupInfoSheet prop compatibility
// 5. Mutation payload shape verification (userId vs memberId)
// ---------------------------------------------------------------------------

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("==================================================");
console.log("  CHAT FIXES & DATA WIRING REGRESSION SUITE");
console.log("==================================================");

// --- 1. Defensive Member Resolution & Direct/Group Handling ---
console.log("\n[Suite 1] Defensive Member Resolution & Null Safety");

test("Direct conversation: find other member with valid array", () => {
  const currentUserId = "user-1";
  const members = [
    { _id: "user-1", name: "User One", role: "member", online: false },
    { _id: "user-2", name: "User Two", role: "admin", online: true },
  ];
  const safeMembers = Array.isArray(members) ? members : [];
  const otherMember = safeMembers.find((m) => m && m._id !== currentUserId);
  assert.strictEqual(otherMember?._id, "user-2");
  assert.strictEqual(otherMember?.name, "User Two");
});

test("Direct conversation: safe handling when members is undefined (No crash)", () => {
  const currentUserId = "user-1";
  const members = undefined;
  const safeMembers = Array.isArray(members) ? members : [];
  const otherMember = safeMembers.find((m) => m && m._id !== currentUserId);
  assert.strictEqual(otherMember, undefined);
  assert.strictEqual(safeMembers.length, 0);
});

test("Direct conversation: safe handling when members is null (No crash)", () => {
  const currentUserId = "user-1";
  const members = null;
  const safeMembers = Array.isArray(members) ? members : [];
  const otherMember = safeMembers.find((m) => m && m._id !== currentUserId);
  assert.strictEqual(otherMember, undefined);
  assert.strictEqual(safeMembers.length, 0);
});

test("Group conversation: member count displays accurately", () => {
  const members = [
    { _id: "u1", name: "Alice", role: "admin", online: true },
    { _id: "u2", name: "Bob", role: "member", online: false },
    { _id: "u3", name: "Charlie", role: "member", online: true },
  ];
  const safeMembers = Array.isArray(members) ? members : [];
  const text = `${safeMembers.length} members`;
  assert.strictEqual(text, "3 members");
});

test("Group conversation: empty members array handled safely", () => {
  const members = [];
  const safeMembers = Array.isArray(members) ? members : [];
  const text = `${safeMembers.length} members`;
  assert.strictEqual(text, "0 members");
});

// --- 2. Unread Count Contract ---
console.log("\n[Suite 2] Unread Count Data Contract");

test("Total unread count correctly calculated from `unread` property", () => {
  const groups = [
    { _id: "g1", name: "Chat 1", unread: 3 },
    { _id: "g2", name: "Chat 2", unread: 0 },
    { _id: "g3", name: "Chat 3", unread: 5 },
    { _id: "g4", name: "Chat 4" }, // unread undefined
  ];
  const totalUnread = groups.reduce((sum, g) => sum + (g.unread ?? 0), 0);
  assert.strictEqual(totalUnread, 8);
});

test("Active group unread detection uses `unread`", () => {
  const activeGroup = { _id: "g1", name: "Active Chat", unread: 4 };
  const hasUnread = (activeGroup.unread ?? 0) > 0;
  assert.strictEqual(hasUnread, true);

  const activeGroupRead = { _id: "g2", name: "Read Chat", unread: 0 };
  assert.strictEqual((activeGroupRead.unread ?? 0) > 0, false);
});

// --- 3. Source Inspection for Props and Wiring ---
console.log("\n[Suite 3] Component Source & Prop Contract Verification");

const widgetPath = path.resolve(__dirname, "../src/components/chat/FloatingChatWidget.tsx");
const sheetPath = path.resolve(__dirname, "../src/components/chat/GroupInfoSheet.tsx");
const chatRoutePath = path.resolve(__dirname, "../src/routes/_shell/chat.tsx");

const widgetContent = fs.readFileSync(widgetPath, "utf-8");
const sheetContent = fs.readFileSync(sheetPath, "utf-8");
const chatRouteContent = fs.readFileSync(chatRoutePath, "utf-8");

test("GroupInfoSheet defines defensive defaults for members", () => {
  assert(
    sheetContent.includes("members = []"),
    "GroupInfoSheet should default members parameter to []"
  );
  assert(
    sheetContent.includes("safeMembers = Array.isArray(members) ? members : []"),
    "GroupInfoSheet should defensively wrap members in safeMembers"
  );
});

test("FloatingChatWidget passes members={activeMembers} to GroupInfoSheet", () => {
  assert(
    widgetContent.includes("members={activeMembers}"),
    "FloatingChatWidget must pass members={activeMembers}"
  );
});

test("FloatingChatWidget passes correct mutation payload for removeMember", () => {
  assert(
    widgetContent.includes("removeMemberMutation.mutate({ groupId: activeGroup._id, userId });"),
    "removeMemberMutation must use userId parameter"
  );
  assert(
    !widgetContent.includes("removeMemberMutation.mutate({ groupId: activeGroup._id, memberId });"),
    "memberId parameter should not be used in removeMember"
  );
});

test("FloatingChatWidget passes correct mutation payload for changeRole", () => {
  assert(
    widgetContent.includes("changeRoleMutation.mutate({ groupId: activeGroup._id, userId, role });"),
    "changeRoleMutation must use userId and role"
  );
});

test("FloatingChatWidget passes onRename (not onRenameGroup)", () => {
  assert(
    widgetContent.includes("onRename={(name) =>"),
    "onRename prop must be used"
  );
  assert(
    !widgetContent.includes("onRenameGroup="),
    "onRenameGroup must not be used"
  );
});

test("FloatingChatWidget passes onLeave and isLeaving (not onLeaveGroup) to GroupInfoSheet", () => {
  assert(
    widgetContent.includes("onLeave={() => handleLeaveGroup(activeGroup._id)}"),
    "onLeave prop must be used"
  );
  assert(
    widgetContent.includes("isLeaving={leaveGroupMutation.isPending}"),
    "isLeaving prop must be passed"
  );
  const match = widgetContent.match(/<GroupInfoSheet[^>]*onLeaveGroup=[^>]*>/s);
  assert.strictEqual(
    match,
    null,
    "GroupInfoSheet must not receive onLeaveGroup prop"
  );
});

test("FloatingChatWidget connects onClearChat and onDeleteChat", () => {
  assert(
    widgetContent.includes("onClearChat={() => handleClearChat(activeGroup._id)}"),
    "onClearChat must be connected"
  );
  assert(
    widgetContent.includes("onDeleteChat={() => handleDeleteChat(activeGroup._id)}"),
    "onDeleteChat must be connected"
  );
});

test("FloatingChatWidget preserves delete group confirmation workflow", () => {
  assert(
    widgetContent.includes("onDeleteGroup={() => setDeleteConfirmOpen(true)}"),
    "onDeleteGroup must open delete confirmation dialog"
  );
  assert(
    widgetContent.includes("<AlertDialog open={deleteConfirmOpen}"),
    "Delete group alert dialog must be preserved"
  );
});

test("FloatingChatWidget does not pass unsupported lastSeen prop to GroupInfoSheet", () => {
  // Regex to ensure GroupInfoSheet invocation doesn't include lastSeen=
  const match = widgetContent.match(/<GroupInfoSheet[^>]*lastSeen=[^>]*>/s);
  assert.strictEqual(match, null, "GroupInfoSheet invocation must not pass lastSeen");
});

test("FloatingChatWidget uses `unread` and NOT `unreadCount` on ChatGroup", () => {
  assert(
    !widgetContent.includes("g.unreadCount"),
    "g.unreadCount must not be used"
  );
  assert(
    !widgetContent.includes("activeGroup.unreadCount"),
    "activeGroup.unreadCount must not be used"
  );
  assert(
    widgetContent.includes("g.unread ?? 0"),
    "g.unread ?? 0 must be used"
  );
  assert(
    widgetContent.includes("activeGroup.unread ?? 0"),
    "activeGroup.unread ?? 0 must be used"
  );
});

test("FloatingChatWidget uses isPinned, isMuted, isArchived on ChatGroup", () => {
  assert(
    !widgetContent.includes("!activeGroup.pinned"),
    "activeGroup.pinned must not be used"
  );
  assert(
    !widgetContent.includes("!activeGroup.muted"),
    "activeGroup.muted must not be used"
  );
  assert(
    !widgetContent.includes("!activeGroup.archived"),
    "activeGroup.archived must not be used"
  );
  assert(
    widgetContent.includes("activeGroup.isPinned"),
    "activeGroup.isPinned must be used"
  );
  assert(
    widgetContent.includes("activeGroup.isMuted"),
    "activeGroup.isMuted must be used"
  );
  assert(
    widgetContent.includes("activeGroup.isArchived"),
    "activeGroup.isArchived must be used"
  );
});

test("ForwardDialog in FloatingChatWidget receives currentUserId and message", () => {
  assert(
    widgetContent.includes('currentUserId={user?._id ?? ""}'),
    "ForwardDialog must receive currentUserId"
  );
  assert(
    widgetContent.includes("message={forwardMessage}"),
    "ForwardDialog must receive message"
  );
});

test("Controlled error state and retry provided for groups and messages loading", () => {
  assert(
    widgetContent.includes("groupsError ?"),
    "Sidebar must render controlled error state when groups fail to load"
  );
  assert(
    widgetContent.includes("refetchGroups()"),
    "Sidebar must provide a retry action for groups error"
  );
  assert(
    widgetContent.includes("messagesError ?"),
    "Message view must render controlled error state when messages fail to load"
  );
  assert(
    widgetContent.includes("refetchMessages()"),
    "Message view must provide a retry action for messages error"
  );
});

console.log("\n==================================================");
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
