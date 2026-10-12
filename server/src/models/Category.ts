import mongoose, { Document, Schema } from "mongoose";

export type CategoryType = "legal" | "admin" | "custom";

export interface ICategory extends Document {
  name: string;
  slug: string;
  parentId: mongoose.Types.ObjectId | null;
  ancestors: mongoose.Types.ObjectId[];
  level: number; // 1 = Main Category, 2 = Subcategory / Work Type, 3 = Detail
  categoryType: CategoryType;
  isActive: boolean;
  displayOrder: number;
  isCustom: boolean;
  allowedWorkTypes?: string[];
  description?: string;
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/&/g, "and")           // Replace & with 'and'
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars except -
    .replace(/\-\-+/g, "-")         // Replace multiple - with single -
    .replace(/^-+/, "")             // Trim - from start of text
    .replace(/-+$/, "");            // Trim - from end of text
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    ancestors: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    level: { type: Number, required: true, default: 1, min: 1, max: 3, index: true },
    categoryType: {
      type: String,
      enum: ["legal", "admin", "custom"],
      default: "legal",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
    isCustom: { type: Boolean, default: false },
    allowedWorkTypes: [{ type: String }],
    description: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Compound index: Uniqueness is enforced per parent so the same work type (e.g. Gift Deed)
// can legitimately exist under multiple distinct parent categories without conflict.
CategorySchema.index({ parentId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ name: "text", description: "text" });
CategorySchema.index({ level: 1, displayOrder: 1 });

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
