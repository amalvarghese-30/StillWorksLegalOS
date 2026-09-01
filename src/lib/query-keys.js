/**
 * Query keys for React Query
 */
export const queryKeys = {
    // Auth
    auth: () => ["auth"],
    // Users
    users: () => ["users"],
    user: (id) => ["user", id],
    // Cases
    cases: () => ["cases"],
    case: (id) => ["case", id],
    // Clients
    clients: () => ["clients"],
    client: (id) => ["client", id],
    // Documents
    documents: () => ["documents"],
    document: (id) => ["document", id],
    // Tasks
    tasks: () => ["tasks"],
    task: (id) => ["task", id],
    // Calendar
    calendar: () => ["calendar"],
    calendarEvent: (id) => ["calendarEvent", id],
    // Chat
    chatGroups: () => ["chatGroups"],
    chatGroup: (id) => ["chatGroup", id],
    chatMessages: (groupId) => ["chatMessages", groupId],
    // Notifications
    notifications: () => ["notifications"],
    notification: (id) => ["notification", id],
    // Search
    search: (term, limit) => ["search", term, limit],
};
