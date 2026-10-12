import mongoose from "mongoose";
import { Category, slugify, type CategoryType } from "../models/Category.js";

export interface TaxonomyGroup {
  name: string;
  type: CategoryType;
  items: Array<{
    name: string;
    originalRaw?: string;
    note?: string;
  }>;
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
      { name: "Rectification Deed", note: "Added per Section 4.2 specification" },
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
      { name: "SPECIAL LEGAL WORK" },
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
      {
        name: "Item Purchaser",
        originalRaw: "ITEM PURHCASER",
        note: "Spelling variant flagged from raw Excel",
      },
      {
        name: "Computer Repairing",
        originalRaw: "COMPUTER REPARINF",
        note: "Spelling variant flagged from raw Excel",
      },
      {
        name: "Xerox Machine",
        originalRaw: "XEROX MACHIN",
        note: "Spelling variant flagged from raw Excel",
      },
      {
        name: "Office Maintenance",
        originalRaw: "OFFICE MAINTAN",
        note: "Spelling variant flagged from raw Excel",
      },
      {
        name: "Printing and Stationery",
        originalRaw: "PRINTING AND SRTATONERY",
        note: "Spelling variant flagged from raw Excel",
      },
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

      const existingChild = await Category.findOne({
        parentId: parent._id,
        slug: childSlug,
      });

      if (!existingChild) {
        await Category.create({
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
        skipped++;
      }
    }
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
