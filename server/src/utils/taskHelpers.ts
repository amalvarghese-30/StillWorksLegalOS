/**
 * Helper utilities for task client and assignee resolution
 */

export function resolveTaskClientName(task: any): string {
  if (!task) return "General Client";
  if (task.clientId && typeof task.clientId === "object" && task.clientId.name) {
    return task.clientId.name;
  }
  if (task.callReminder?.clientName) {
    return task.callReminder.clientName;
  }
  if (task.caseId && typeof task.caseId === "object") {
    if (Array.isArray(task.caseId.parties) && task.caseId.parties.length > 0) {
      const p = task.caseId.parties[0];
      return p?.name || p?.partyName || "";
    }
    if (task.caseId.title) {
      return task.caseId.title;
    }
  }
  return "General Client";
}

export function resolveTaskAssigneeName(task: any): string {
  if (!task) return "Unassigned";
  if (task.assignedTo && typeof task.assignedTo === "object" && task.assignedTo.name) {
    return task.assignedTo.name;
  }
  return "Unassigned";
}
