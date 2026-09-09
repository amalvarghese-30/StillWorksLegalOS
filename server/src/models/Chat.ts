import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatGroupType = "direct" | "group";

export interface ChatGroupMember {
  userId: mongoose.Types.ObjectId;
  name: string;
  role: "admin" | "member";
  joinedAt: Date;
}

export interface IChatGroup extends Document {
  name: string;
  type: ChatGroupType;
  members: ChatGroupMember[];
  createdBy: mongoose.Types.ObjectId;
  lastMessage?: {
    text: string;
    senderId: mongoose.Types.ObjectId;
    senderName: string;
    at: Date;
  };
  pinnedBy: mongoose.Types.ObjectId[];
  mutedBy: mongoose.Types.ObjectId[];
  archivedBy: mongoose.Types.ObjectId[];
  pinnedMessage?: {
    messageId: mongoose.Types.ObjectId;
    text: string;
    senderName: string;
    pinnedBy: mongoose.Types.ObjectId;
    pinnedByName: string;
    at: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatMessage extends Document {
  groupId: mongoose.Types.ObjectId;
  text: string;
  sender: mongoose.Types.ObjectId;
  senderName: string;
  senderInitials: string;
  attachments: { name: string; nasPath: string; size: string }[];
  mentions: mongoose.Types.ObjectId[];
  readBy: mongoose.Types.ObjectId[];
  reactions: { userId: mongoose.Types.ObjectId; emoji: string }[];
  replyTo?: {
    messageId: mongoose.Types.ObjectId;
    text: string;
    senderName: string;
  };
  deletedForEveryone: boolean;
  deletedFor: mongoose.Types.ObjectId[];
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ChatGroupMemberSchema = new Schema<ChatGroupMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ChatGroupSchema = new Schema<IChatGroup>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "group",
      index: true,
    },
    members: { type: [ChatGroupMemberSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastMessage: {
      type: new Schema(
        {
          text: String,
          senderId: { type: Schema.Types.ObjectId, ref: "User" },
          senderName: String,
          at: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },
    pinnedBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    mutedBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    archivedBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    pinnedMessage: {
      type: new Schema(
        {
          messageId: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
          text: String,
          senderName: String,
          pinnedBy: { type: Schema.Types.ObjectId, ref: "User" },
          pinnedByName: String,
          at: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// Index: find all groups a user belongs to
ChatGroupSchema.index({ "members.userId": 1 });

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "ChatGroup", required: true, index: true },
    text: { type: String, default: "" },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, default: "" },
    senderInitials: { type: String, default: "" },
    attachments: {
      type: [
        new Schema(
          {
            name: String,
            nasPath: String,
            size: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    mentions: { type: [Schema.Types.ObjectId], ref: "User", default: [], index: true },
    readBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    reactions: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
            emoji: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    replyTo: {
      type: new Schema(
        {
          messageId: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
          text: String,
          senderName: String,
        },
        { _id: false },
      ),
      default: undefined,
    },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// Index: fetch messages for a group sorted by time
ChatMessageSchema.index({ groupId: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const ChatGroup = mongoose.model<IChatGroup>("ChatGroup", ChatGroupSchema);
export const ChatMessage = mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
