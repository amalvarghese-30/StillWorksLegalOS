// Barrel export for all Mongoose models
export { User } from "./User.js";
export type { IUser, UserRole, UserStatus, UserPermissions } from "./User.js";

export { Session } from "./Session.js";
export type { ISession } from "./Session.js";

export { Client } from "./Client.js";
export type { IClient, ClientType, ClientTag, KYCStatus, SubClient } from "./Client.js";

export { Case } from "./Case.js";
export type { ICase, CaseStatus, CasePriority, CasePractice, CaseParty, CaseNote, CaseTimelineEntry } from "./Case.js";

export { AppSettings } from "./AppSettings.js";
export type { IAppSettings, SynologyConfig } from "./AppSettings.js";

export { Task } from "./Task.js";
export type { ITask, TaskCategory, TaskPriority, TaskStatus, ChecklistItem, CallReminder } from "./Task.js";

export { CalendarEvent } from "./CalendarEvent.js";
export type { ICalendarEvent, CalendarEventType } from "./CalendarEvent.js";

export { DocumentModel } from "./Document.js";
export type { IDocument, DocumentState } from "./Document.js";

export { ChatGroup, ChatMessage } from "./Chat.js";
export type { IChatGroup, IChatMessage, ChatGroupType, ChatGroupMember } from "./Chat.js";

export { AuditLog } from "./AuditLog.js";
export type { IAuditLog, AuditAction, AuditResource } from "./AuditLog.js";
