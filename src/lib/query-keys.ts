import { type UseQueryOptions } from "@tanstack/react-query";

/**
 * Query keys for React Query
 */
export const queryKeys = {
  // Auth
  auth: () => ["auth"],
  // Users
  users: () => ["users"],
  user: (id: string) => ["user", id],
  // Cases
  cases: () => ["cases"],
  case: (id: string) => ["case", id],
  // Clients
  clients: () => ["clients"],
  client: (id: string) => ["client", id],
  // Documents
  documents: () => ["documents"],
  document: (id: string) => ["document", id],
  // Tasks
  tasks: () => ["tasks"],
  task: (id: string) => ["task", id],
  // Calendar
  calendar: () => ["calendar"],
  calendarEvent: (id: string) => ["calendarEvent", id],
  // Chat
  chatGroups: () => ["chatGroups"],
  chatGroup: (id: string) => ["chatGroup", id],
  chatMessages: (groupId: string) => ["chatMessages", groupId],
  // Notifications
  notifications: () => ["notifications"],
  notification: (id: string) => ["notification", id],
  // Search
  search: (term: string, limit: number) => ["search", term, limit],
} as const;

// Helper types
export type QueryKey = typeof queryKeys;