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
export type { IAppSettings, StorageConfig, SynologyConfig } from "./AppSettings.js";

export { Task } from "./Task.js";
export type { ITask, TaskCategory, TaskPriority, TaskStatus, ChecklistItem, CallReminder, TaskRemark } from "./Task.js";

export { CalendarEvent } from "./CalendarEvent.js";
export type { ICalendarEvent, CalendarEventType } from "./CalendarEvent.js";

export { DocumentModel } from "./Document.js";
export type { IDocument, DocumentState } from "./Document.js";

export { ChatGroup, ChatMessage } from "./Chat.js";
export type { IChatGroup, IChatMessage, ChatGroupType, ChatGroupMember } from "./Chat.js";

export { AuditLog } from "./AuditLog.js";
export type { IAuditLog, AuditAction, AuditResource } from "./AuditLog.js";

export { Category, slugify } from "./Category.js";
export type { ICategory, CategoryType } from "./Category.js";

export { ApprovalRequest } from "./ApprovalRequest.js";
export type { IApprovalRequest, ApprovalType, ApprovalStatus } from "./ApprovalRequest.js";

export { NotificationOutbox } from "./NotificationOutbox.js";
export type { INotificationOutbox, OutboxChannel, OutboxStatus } from "./NotificationOutbox.js";

export { Notification } from "./Notification.js";
export type { INotification, NotificationType } from "./Notification.js";

export { Reminder } from "./Reminder.js";
export type { IReminder, ReminderStatus, ReminderSourceType } from "./Reminder.js";

export { GmailAccount } from "./GmailAccount.js";
export type { IGmailAccount } from "./GmailAccount.js";

export { TaskReminderState } from "./TaskReminderState.js";
export type { ITaskReminderState } from "./TaskReminderState.js";

export { HearingRecord } from "./HearingRecord.js";
export type { IHearingRecord, HearingStatus } from "./HearingRecord.js";


