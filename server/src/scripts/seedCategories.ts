import mongoose from "mongoose";
import { Category, slugify, type CategoryType } from "../models/Category.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export interface TaxonomyItem {
  name: string;
  originalRaw?: string;
  note?: string;
  children?: TaxonomyItem[];
}

export interface TaxonomyGroup {
  name: string;
  type: CategoryType;
  items: TaxonomyItem[];
}

export const EXCEL_TAXONOMY: TaxonomyGroup[] = [
  {
    name: "TRANSFER OF PROPERTY",
    type: "legal",
    items: [
      { name: "Memorandum of Understanding (MOU)" },
      { name: "File no and Documents Filing" },
      { name: "Agreement for Sale" },
      { name: "Gift Deed" },
      { name: "CIDCO Transfer" },
      { name: "CIDCO Mortgage Permission" },
      { name: "Sale Deed" },
      { name: "Power of Attorney (POA)" },
      { name: "Other Property Transfer Work" },
      { name: "SOCIETY DOCUMENTS" },
      { name: "Possession Letter" },
    ],
  },
  {
    name: "ONLY CIDCO WORK",
    type: "legal",
    items: [
      { name: "CIDCO APPLICATION" },
      { name: "CIDCO Transfer Permission" },
      { name: "CIDCO Mortgage Permission" },
      { name: "CIDCO Missing Document Matters" },
      { name: "Other CIDCO Work" },
      { name: "CIDCO HEIRSHIP TRANSFER" },
      { name: "CIDCO FINAL ORDER" },
      { name: "CIDCO Leasehold Transfer" },
      { name: "CIDCO NOC" },
      { name: "CIDCO Duplicate / Missing Documents" },
      { name: "CIDCO Mutation / Name Change" },
    ],
  },
  {
    name: "HEIRSHIP & COURT MATTERS",
    type: "legal",
    items: [
      { name: "Application and Report" },
      { name: "No-Claim" },
      { name: "Consent Affidavit" },
      { name: "Court Order / Heirship Certificate" },
      { name: "WILLS & SUCCESSION" },
      {
        name: "SPECIAL LEGAL WORK",
        children: [
          { name: "SOCIETY WORK" },
          { name: "CONVEYANCE & DEEMED CONVEYANCE" },
          { name: "BANK & LOAN DOCUMENTATION" },
          { name: "FAMILY COURT MATTERS" },
          { name: "CRIMINAL COURT MATTERS" },
          { name: "CONSUMER MATTERS" },
          { name: "BUSINESS & COMMERCIAL AGREEMENTS" },
          { name: "LEGAL NOTICES & REPLIES" },
          { name: "AFFIDAVITS & DECLARATIONS" },
          { name: "GOVERNMENT & AUTHORITY WORK" },
          { name: "Succession Certificate" },
          { name: "Probate" },
          { name: "Letters of Administration" },
          { name: "Civil Court Matters" },
          { name: "RTS Appeal" },
          { name: "Legal Heir Documentation" },
          { name: "Court Petition / Application" },
        ],
      },
    ],
  },
  {
    name: "TITLE SEARCH AND MISSING DOCUMENTS",
    type: "legal",
    items: [
      { name: "Public Notice" },
      { name: "Publication" },
      { name: "Title Search Report" },
      { name: "Certified Copies" },
      { name: "NO-Claim certificates" },
      { name: "Chain of Title Verification" },
      { name: "Property Document Verification" },
      { name: "Index II / Search" },
      { name: "Missing Document Affidavit" },
    ],
  },
  {
    name: "REDEVELOPMENT WORK / RERA",
    type: "legal",
    items: [
      {
        name: "Development Agreement and Related Documents",
        originalRaw: "Development Agreement;  and Related Documents",
        note: "Normalized semicolon and extra spaces",
      },
      { name: "Permanent Alternate Accommodation Agreement" },
      { name: "Power of Attorney" },
      { name: "Society Resolutions" },
      { name: "REDEVELOPMENT WORK" },
      { name: "RERA Complaint" },
      { name: "RERA Compliance" },
      { name: "Redevelopment POA" },
      { name: "Deemed Conveyance" },
      { name: "Society Redevelopment NOC" },
    ],
  },
  {
    name: "OTHER WORKS",
    type: "legal",
    items: [
      { name: "Affidavits" },
      { name: "Undertakings" },
      { name: "Indemnity Bonds" },
      { name: "Legal Notices" },
      { name: "Other Applications and Letters" },
      { name: "MSEDCL Name Transfer" },
      { name: "NMMC Transfer" },
      { name: "MAHANAGAR GAS" },
      { name: "SOCIETY DOCUMENTS" },
      { name: "WATER TAX" },
      { name: "Society NOC" },
      { name: "Society Share Transfer" },
      { name: "Society Nomination" },
      { name: "Legal Notice Reply" },
      { name: "Bank NOC" },
      { name: "Loan Closure" },
      { name: "Public Notice" },
    ],
  },
  {
    name: "REGISTRATION ONLY",
    type: "legal",
    items: [
      { name: "Power of Attorney (POA)" },
      { name: "Gift Deed" },
      { name: "Mortgage Deed" },
      { name: "Builders Agreements" },
      { name: "Release Deed" },
      { name: "Assignment Deed" },
      { name: "Rectification Deed", note: "Primary Excel source placement" },
      { name: "Cancellation Deed" },
      { name: "WILL" },
      { name: "Agreement for Sale Registration" },
      { name: "Sale Deed Registration" },
      { name: "Leave and Licence Registration" },
      { name: "Exchange Deed" },
      { name: "Confirmation Deed" },
      { name: "Lease Deed" },
      { name: "Transfer Deed" },
    ],
  },
  {
    name: "LAND / PLOT / REVENUE MATTERS",
    type: "legal",
    items: [
      { name: "SEARCH" },
      { name: "TITLE" },
      { name: "DEED" },
      { name: "DOCUMENTS" },
      { name: "OTHER" },
      { name: "7/12 Extract" },
      { name: "Property Card" },
      { name: "Mutation Entry" },
      { name: "NA Permission" },
      { name: "Land Measurement" },
      { name: "Revenue Appeal" },
      { name: "Land Record Correction" },
    ],
  },
  {
    name: "OFFICE ADMIN WORK",
    type: "admin",
    items: [
      { name: "ITEM PURCHASER" },
      { name: "COMPUTER REPAIRING" },
      { name: "XEROX MACHINE" },
      { name: "OFFICE MAINTAIN" },
      { name: "PRINTING AND STATIONERY" },
      { name: "OFFICE ASSETS MAINTENANCE" },
      { name: "OTHER OFFICE RELATED WORKS" },
      { name: "Office Stationery" },
      { name: "Computer / Printer Maintenance" },
      { name: "Staff Work Allocation" },
      { name: "Software Bug Reporting" },
      { name: "Office Expenses" },
    ],
  },
];

export async function seedCategories(): Promise<{
  parentsCreated: number;
  childrenCreated: number;
  skipped: number;
  spellingVariants: Array<{ original: string; normalized: string; parent: string }>;
  inserted: number;
  total: number;
}> {
  let parentsCreated = 0;
  let childrenCreated = 0;
  let skipped = 0;
  const spellingVariants: Array<{ original: string; normalized: string; parent: string }> = [];

  for (let pIdx = 0; pIdx < EXCEL_TAXONOMY.length; pIdx++) {
    const group = EXCEL_TAXONOMY[pIdx]!;
    const parentSlug = slugify(group.name);

    let parent = await Category.findOne({ parentId: null, slug: parentSlug });
    if (!parent) {
      parent = await Category.findOne({
        parentId: null,
        name: { $regex: new RegExp(`^${escapeRegex(group.name)}$`, "i") },
      });
    }

    if (!parent) {
      parent = await Category.create({
        name: group.name,
        slug: parentSlug,
        parentId: null,
        ancestors: [],
        level: 1,
        categoryType: group.type,
        isActive: true,
        displayOrder: pIdx * 10,
        isCustom: false,
      });
      parentsCreated++;
    } else {
      let changed = false;
      if (parent.name !== group.name) {
        parent.name = group.name;
        changed = true;
      }
      if (parent.slug !== parentSlug) {
        parent.slug = parentSlug;
        changed = true;
      }
      if (parent.categoryType !== group.type) {
        parent.categoryType = group.type;
        changed = true;
      }
      if (!parent.isActive) {
        parent.isActive = true;
        changed = true;
      }
      if (changed) await parent.save();
      skipped++;
    }

    for (let cIdx = 0; cIdx < group.items.length; cIdx++) {
      const item = group.items[cIdx]!;
      const childSlug = slugify(item.name);

      if (item.originalRaw && item.originalRaw !== item.name) {
        spellingVariants.push({
          original: item.originalRaw,
          normalized: item.name,
          parent: group.name,
        });
      }

      let child = await Category.findOne({
        parentId: parent._id,
        slug: childSlug,
      });

      if (!child) {
        child = await Category.findOne({
          parentId: parent._id,
          name: { $regex: new RegExp(`^${escapeRegex(item.name)}$`, "i") },
        });
      }

      // Check legacy slug aliases (e.g., office-maintenance -> office-maintain)
      if (!child && item.name === "OFFICE MAINTAIN") {
        child = await Category.findOne({
          parentId: parent._id,
          slug: { $in: ["office-maintenance", "office-maintain"] },
        });
      }

      if (!child) {
        child = await Category.create({
          name: item.name,
          slug: childSlug,
          parentId: parent._id,
          ancestors: [parent._id],
          level: 2,
          categoryType: group.type,
          isActive: true,
          displayOrder: cIdx,
          isCustom: false,
          description: item.note || "",
        });
        childrenCreated++;
      } else {
        let changed = false;
        if (child.name !== item.name) {
          child.name = item.name;
          changed = true;
        }
        if (child.slug !== childSlug) {
          child.slug = childSlug;
          changed = true;
        }
        if (child.level !== 2) {
          child.level = 2;
          changed = true;
        }
        if (child.categoryType !== group.type) {
          child.categoryType = group.type;
          changed = true;
        }
        if (!child.isActive) {
          child.isActive = true;
          changed = true;
        }
        if (changed) await child.save();
        skipped++;
      }

      // Process nested children (level 3)
      if (Array.isArray(item.children) && item.children.length > 0) {
        for (let gIdx = 0; gIdx < item.children.length; gIdx++) {
          const grandChild = item.children[gIdx]!;
          const grandChildSlug = slugify(grandChild.name);

          // 1. Look for existing child under child._id
          let nestedDoc = await Category.findOne({
            parentId: child._id,
            slug: grandChildSlug,
          });

          if (!nestedDoc && grandChild.name === "Legal Heir Documentation") {
            nestedDoc = await Category.findOne({
              parentId: child._id,
              slug: "legal-heir",
            });
          }

          if (!nestedDoc) {
            nestedDoc = await Category.findOne({
              parentId: child._id,
              name: { $regex: new RegExp(`^${escapeRegex(grandChild.name)}$`, "i") },
            });
          }

          if (!nestedDoc && grandChild.name === "Legal Heir Documentation") {
            nestedDoc = await Category.findOne({
              parentId: child._id,
              name: { $regex: /^Legal Heir$/i },
            });
          }

          // 2. If not found under child._id, check if it was previously placed directly under parent._id
          if (!nestedDoc) {
            const searchSlugs = [grandChildSlug];
            if (grandChild.name === "Legal Heir Documentation" || grandChild.name === "Legal Heir") {
              searchSlugs.push("legal-heir", "legal-heir-documentation");
            }
            const oldUnderParent = await Category.findOne({
              parentId: parent._id,
              $or: [
                { slug: { $in: searchSlugs } },
                { name: { $regex: new RegExp(`^${escapeRegex(grandChild.name)}$`, "i") } },
                ...(grandChild.name === "Legal Heir Documentation" ? [{ name: { $regex: /^Legal Heir$/i } }] : []),
              ],
            });

            if (oldUnderParent) {
              oldUnderParent.parentId = child._id;
              oldUnderParent.ancestors = [parent._id, child._id];
              oldUnderParent.level = 3;
              oldUnderParent.name = grandChild.name;
              oldUnderParent.slug = grandChildSlug;
              oldUnderParent.displayOrder = gIdx;
              oldUnderParent.isActive = true;
              oldUnderParent.categoryType = group.type;
              await oldUnderParent.save();
              nestedDoc = oldUnderParent;
              skipped++;
            }
          }

          // 3. If still not found, create under child._id
          if (!nestedDoc) {
            nestedDoc = await Category.create({
              name: grandChild.name,
              slug: grandChildSlug,
              parentId: child._id,
              ancestors: [parent._id, child._id],
              level: 3,
              categoryType: group.type,
              isActive: true,
              displayOrder: gIdx,
              isCustom: false,
              description: grandChild.note || "",
            });
            childrenCreated++;
          } else {
            let changed = false;
            if (nestedDoc.name !== grandChild.name) {
              nestedDoc.name = grandChild.name;
              changed = true;
            }
            if (nestedDoc.slug !== grandChildSlug) {
              nestedDoc.slug = grandChildSlug;
              changed = true;
            }
            if (nestedDoc.level !== 3) {
              nestedDoc.level = 3;
              changed = true;
            }
            if (!nestedDoc.isActive) {
              nestedDoc.isActive = true;
              changed = true;
            }
            if (nestedDoc.parentId?.toString() !== child._id.toString()) {
              nestedDoc.parentId = child._id;
              nestedDoc.ancestors = [parent._id, child._id];
              changed = true;
            }
            if (changed) await nestedDoc.save();
            skipped++;
          }
        }
      }
    }

    // Special hierarchy guarantee for HEIRSHIP & COURT MATTERS:
    // Ensure that none of the 17 nested categories remain as direct children of HEIRSHIP & COURT MATTERS,
    // and exactly the 6 designated categories remain direct children.
    if (group.name === "HEIRSHIP & COURT MATTERS") {
      const allowedDirectSlugs = new Set([
        slugify("Application and Report"),
        slugify("No-Claim"),
        slugify("Consent Affidavit"),
        slugify("Court Order / Heirship Certificate"),
        slugify("WILLS & SUCCESSION"),
        slugify("SPECIAL LEGAL WORK"),
        "wills-succession",
        "wills-and-succession",
      ]);

      const specialDoc = await Category.findOne({ parentId: parent._id, slug: "special-legal-work" });
      if (specialDoc) {
        // Clean up any direct category wrongly placed under specialDoc
        const itemsUnderSpecial = await Category.find({ parentId: specialDoc._id });
        for (const sItem of itemsUnderSpecial) {
          if (allowedDirectSlugs.has(sItem.slug) && sItem.slug !== "special-legal-work") {
            const alreadyUnderParent = await Category.findOne({ parentId: parent._id, slug: sItem.slug });
            if (alreadyUnderParent) {
              await Category.deleteOne({ _id: sItem._id });
            } else {
              sItem.parentId = parent._id;
              sItem.ancestors = [parent._id];
              sItem.level = 2;
              await sItem.save();
            }
          }
        }

        const remainingDirect = await Category.find({ parentId: parent._id });
        for (const rem of remainingDirect) {
          if (!allowedDirectSlugs.has(rem.slug)) {
            const alreadyInSpecial = await Category.findOne({ parentId: specialDoc._id, slug: rem.slug });
            if (alreadyInSpecial) {
              await Category.deleteOne({ _id: rem._id });
            } else {
              rem.parentId = specialDoc._id;
              rem.ancestors = [parent._id, specialDoc._id];
              rem.level = 3;
              await rem.save();
            }
          }
        }
      }
    }
  }

  // Clean up duplicate Rectification Deed under TRANSFER OF PROPERTY and reparent tasks/cases
  const topParent = await Category.findOne({ parentId: null, slug: "transfer-of-property" });
  const regParent = await Category.findOne({ parentId: null, slug: "registration-only" });

  if (topParent && regParent) {
    const topRectDeed = await Category.findOne({
      parentId: topParent._id,
      slug: "rectification-deed",
    });

    const regRectDeed = await Category.findOne({
      parentId: regParent._id,
      slug: "rectification-deed",
    });

    if (topRectDeed) {
      if (mongoose.connection.db) {
        const tasksColl = mongoose.connection.db.collection("tasks");
        const casesColl = mongoose.connection.db.collection("cases");

        // Reparent tasks referencing TRANSFER OF PROPERTY -> Rectification Deed
        await tasksColl.updateMany(
          {
            $or: [
              { subCategory: "Rectification Deed", mainCategory: "TRANSFER OF PROPERTY" },
              { category: "Rectification Deed", mainCategory: "TRANSFER OF PROPERTY" },
              { categoryPath: { $all: ["TRANSFER OF PROPERTY", "Rectification Deed"] } },
              { categoryId: topRectDeed._id },
            ],
          },
          {
            $set: {
              mainCategory: "REGISTRATION ONLY",
              subCategory: "Rectification Deed",
              categoryPath: ["REGISTRATION ONLY", "Rectification Deed"],
              ...(regRectDeed ? { categoryId: regRectDeed._id } : {}),
            },
          }
        );

        // Reparent cases if any specifically had mainCategory: "TRANSFER OF PROPERTY" and subCategory: "Rectification Deed"
        await casesColl.updateMany(
          {
            mainCategory: "TRANSFER OF PROPERTY",
            subCategory: "Rectification Deed",
          },
          {
            $set: {
              mainCategory: "REGISTRATION ONLY",
              subCategory: "Rectification Deed",
              categoryPath: ["REGISTRATION ONLY", "Rectification Deed"],
            },
          }
        );
      }

      await Category.deleteOne({ _id: topRectDeed._id });
    }
  }

  // Normalize any tasks or cases referencing legacy "Legal Heir" to "Legal Heir Documentation"
  if (mongoose.connection.db) {
    const tasksColl = mongoose.connection.db.collection("tasks");
    const casesColl = mongoose.connection.db.collection("cases");

    await tasksColl.updateMany(
      { subCategory: "Legal Heir" },
      { $set: { subCategory: "Legal Heir Documentation" } }
    );
    await casesColl.updateMany(
      { subCategory: "Legal Heir" },
      { $set: { subCategory: "Legal Heir Documentation" } }
    );
  }

  const total = await Category.countDocuments();
  return {
    parentsCreated,
    childrenCreated,
    skipped,
    spellingVariants,
    inserted: parentsCreated + childrenCreated,
    total,
  };
}
