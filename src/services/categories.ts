import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const BASELINE_CATEGORIES: string[] = [
  "Writ Petitions",
  "Special Leave Petitions (SLP)",
  "Original Suits & Civil Suits",
  "Appeals & Revisions",
  "Company & Corporate Petitions",
  "Arbitration & Conciliation",
  "Execution Proceedings",
  "Review Petitions",
  "Criminal Appeals & Revisions",
  "Bail Applications & Anticipatory Bail",
  "Gift Deed",
  "Registration",
  "Legal Opinion & Consultation",
  "Drafting & Conveyancing",
  "Property",
  "Corporate",
  "Litigation",
  "Family",
  "Intellectual Property",
  "Tax",
  "Employment",
  "Other Work",
];

export async function fetchCategories(): Promise<string[]> {
  try {
    const res = await api.get<{ categories: string[] }>("/categories");
    const catList = res?.categories;
    if (Array.isArray(catList) && catList.length > 0) {
      // Merge baseline with fetched categories, deduplicating
      const set = new Set([...BASELINE_CATEGORIES, ...catList]);
      return Array.from(set);
    }
  } catch {
    // If dedicated /categories fails, try /tasks/options
    try {
      const taskOptRes = await api.get<{ categories: string[] }>("/tasks/options");
      const catList = taskOptRes?.categories;
      if (Array.isArray(catList) && catList.length > 0) {
        const set = new Set([...BASELINE_CATEGORIES, ...catList]);
        return Array.from(set);
      }
    } catch {
      // Fallback to baseline
    }
  }
  return BASELINE_CATEGORIES;
}

export interface CategoryNode {
  _id: string;
  name: string;
  slug: string;
  code?: string;
  level: number;
  parentId?: string | null;
  categoryType: "case" | "task" | "both";
  children?: CategoryNode[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    initialData: BASELINE_CATEGORIES,
  });
}

export const BASELINE_CATEGORY_TREE: CategoryNode[] = [
  {
    _id: "baseline-transfer-of-property",
    name: "TRANSFER OF PROPERTY",
    slug: "transfer-of-property",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-mou", name: "Memorandum of Understanding (MOU)", slug: "mou", level: 2, categoryType: "both" },
      { _id: "b-doc-filing", name: "File no and Documents Filing", slug: "doc-filing", level: 2, categoryType: "both" },
      { _id: "b-agree-sale", name: "Agreement for Sale", slug: "agree-sale", level: 2, categoryType: "both" },
      { _id: "b-gift-deed", name: "Gift Deed", slug: "gift-deed", level: 2, categoryType: "both" },
      { _id: "b-cidco-trans", name: "CIDCO Transfer", slug: "cidco-transfer", level: 2, categoryType: "both" },
      { _id: "b-cidco-mort", name: "CIDCO Mortgage Permission", slug: "cidco-mortgage", level: 2, categoryType: "both" },
      { _id: "b-sale-deed", name: "Sale Deed", slug: "sale-deed", level: 2, categoryType: "both" },
      { _id: "b-poa", name: "Power of Attorney (POA)", slug: "poa", level: 2, categoryType: "both" },
      { _id: "b-other-prop", name: "Other Property Transfer Work", slug: "other-property-transfer-work", level: 2, categoryType: "both" },
      { _id: "b-society-docs", name: "SOCIETY DOCUMENTS", slug: "society-documents", level: 2, categoryType: "both" },
      { _id: "b-poss-letter", name: "Possession Letter", slug: "possession-letter", level: 2, categoryType: "both" },
      { _id: "b-rect-deed", name: "Rectification Deed", slug: "rectification-deed", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-only-cidco-work",
    name: "ONLY CIDCO WORK",
    slug: "only-cidco-work",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-cidco-app", name: "CIDCO APPLICATION", slug: "cidco-application", level: 2, categoryType: "both" },
      { _id: "b-cidco-perm", name: "CIDCO Transfer Permission", slug: "cidco-transfer-permission", level: 2, categoryType: "both" },
      { _id: "b-cidco-mort-perm", name: "CIDCO Mortgage Permission", slug: "cidco-mortgage-permission", level: 2, categoryType: "both" },
      { _id: "b-cidco-miss", name: "CIDCO Missing Document Matters", slug: "cidco-missing-document-matters", level: 2, categoryType: "both" },
      { _id: "b-cidco-other", name: "Other CIDCO Work", slug: "other-cidco-work", level: 2, categoryType: "both" },
      { _id: "b-cidco-heir", name: "CIDCO HEIRSHIP TRANSFER", slug: "cidco-heirship-transfer", level: 2, categoryType: "both" },
      { _id: "b-cidco-final", name: "CIDCO FINAL ORDER", slug: "cidco-final-order", level: 2, categoryType: "both" },
      { _id: "b-cidco-lease", name: "CIDCO Leasehold Transfer", slug: "cidco-leasehold-transfer", level: 2, categoryType: "both" },
      { _id: "b-cidco-noc", name: "CIDCO NOC", slug: "cidco-noc", level: 2, categoryType: "both" },
      { _id: "b-cidco-mutation", name: "CIDCO Mutation / Name Change", slug: "cidco-mutation-name-change", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-heirship-court",
    name: "HEIRSHIP & COURT MATTERS",
    slug: "heirship-court-matters",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-heir-app", name: "Application and Report", slug: "application-and-report", level: 2, categoryType: "both" },
      { _id: "b-heir-noclaim", name: "No-Claim", slug: "no-claim", level: 2, categoryType: "both" },
      { _id: "b-heir-consent", name: "Consent Affidavit", slug: "consent-affidavit", level: 2, categoryType: "both" },
      { _id: "b-heir-cert", name: "Court Order / Heirship Certificate", slug: "court-order-heirship-certificate", level: 2, categoryType: "both" },
      { _id: "b-heir-succ", name: "Succession Certificate", slug: "succession-certificate", level: 2, categoryType: "both" },
      { _id: "b-heir-probate", name: "Probate", slug: "probate", level: 2, categoryType: "both" },
      { _id: "b-heir-admin", name: "Letters of Administration", slug: "letters-of-administration", level: 2, categoryType: "both" },
      { _id: "b-heir-civil", name: "Civil Court Matters", slug: "civil-court-matters", level: 2, categoryType: "both" },
      { _id: "b-heir-rts", name: "RTS Appeal", slug: "rts-appeal", level: 2, categoryType: "both" },
      { _id: "b-heir-doc", name: "Legal Heir Documentation", slug: "legal-heir-documentation", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-title-search",
    name: "TITLE SEARCH AND MISSING DOCUMENTS",
    slug: "title-search-and-missing-documents",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-pub-notice", name: "Public Notice", slug: "public-notice", level: 2, categoryType: "both" },
      { _id: "b-pub-action", name: "Publication", slug: "publication", level: 2, categoryType: "both" },
      { _id: "b-search-rep", name: "Title Search Report", slug: "title-search-report", level: 2, categoryType: "both" },
      { _id: "b-cert-copies", name: "Certified Copies", slug: "certified-copies", level: 2, categoryType: "both" },
      { _id: "b-chain-title", name: "Chain of Title Verification", slug: "chain-of-title-verification", level: 2, categoryType: "both" },
      { _id: "b-prop-verify", name: "Property Document Verification", slug: "property-document-verification", level: 2, categoryType: "both" },
      { _id: "b-index-ii", name: "Index II / Search", slug: "index-ii-search", level: 2, categoryType: "both" },
      { _id: "b-miss-aff", name: "Missing Document Affidavit", slug: "missing-document-affidavit", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-redevelopment-rera",
    name: "REDEVELOPMENT WORK / RERA",
    slug: "redevelopment-work-rera",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-da-rel", name: "Development Agreement and Related Documents", slug: "development-agreement-and-related-documents", level: 2, categoryType: "both" },
      { _id: "b-paaa", name: "Permanent Alternate Accommodation Agreement", slug: "permanent-alternate-accommodation-agreement", level: 2, categoryType: "both" },
      { _id: "b-redev-poa", name: "Power of Attorney", slug: "power-of-attorney", level: 2, categoryType: "both" },
      { _id: "b-soc-res", name: "Society Resolutions", slug: "society-resolutions", level: 2, categoryType: "both" },
      { _id: "b-rera-comp", name: "RERA Complaint", slug: "rera-complaint", level: 2, categoryType: "both" },
      { _id: "b-rera-compli", name: "RERA Compliance", slug: "rera-compliance", level: 2, categoryType: "both" },
      { _id: "b-deemed-conv", name: "Deemed Conveyance", slug: "deemed-conveyance", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-registration-only",
    name: "REGISTRATION ONLY",
    slug: "registration-only",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-reg-poa", name: "Power of Attorney (POA)", slug: "power-of-attorney-poa", level: 2, categoryType: "both" },
      { _id: "b-reg-gift", name: "Gift Deed", slug: "gift-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-mort", name: "Mortgage Deed", slug: "mortgage-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-build", name: "Builders Agreements", slug: "builders-agreements", level: 2, categoryType: "both" },
      { _id: "b-reg-rel", name: "Release Deed", slug: "release-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-ass", name: "Assignment Deed", slug: "assignment-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-rect", name: "Rectification Deed", slug: "rectification-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-canc", name: "Cancellation Deed", slug: "cancellation-deed", level: 2, categoryType: "both" },
      { _id: "b-reg-will", name: "WILL", slug: "will", level: 2, categoryType: "both" },
      { _id: "b-reg-sale-agr", name: "Agreement for Sale Registration", slug: "agreement-for-sale-registration", level: 2, categoryType: "both" },
      { _id: "b-reg-sale", name: "Sale Deed Registration", slug: "sale-deed-registration", level: 2, categoryType: "both" },
      { _id: "b-reg-lic", name: "Leave and Licence Registration", slug: "leave-and-licence-registration", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-other-works",
    name: "OTHER WORKS",
    slug: "other-works",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-oth-aff", name: "Affidavits", slug: "affidavits", level: 2, categoryType: "both" },
      { _id: "b-oth-und", name: "Undertakings", slug: "undertakings", level: 2, categoryType: "both" },
      { _id: "b-oth-ind", name: "Indemnity Bonds", slug: "indemnity-bonds", level: 2, categoryType: "both" },
      { _id: "b-oth-not", name: "Legal Notices", slug: "legal-notices", level: 2, categoryType: "both" },
      { _id: "b-oth-msedcl", name: "MSEDCL Name Transfer", slug: "msedcl-name-transfer", level: 2, categoryType: "both" },
      { _id: "b-oth-nmmc", name: "NMMC Transfer", slug: "nmmc-transfer", level: 2, categoryType: "both" },
      { _id: "b-oth-gas", name: "MAHANAGAR GAS", slug: "mahanagar-gas", level: 2, categoryType: "both" },
      { _id: "b-oth-water", name: "WATER TAX", slug: "water-tax", level: 2, categoryType: "both" },
      { _id: "b-oth-soc-noc", name: "Society NOC", slug: "society-noc", level: 2, categoryType: "both" },
      { _id: "b-oth-soc-share", name: "Society Share Transfer", slug: "society-share-transfer", level: 2, categoryType: "both" },
      { _id: "b-oth-bank-noc", name: "Bank NOC", slug: "bank-noc", level: 2, categoryType: "both" },
    ],
  },
  {
    _id: "baseline-other-work",
    name: "Other Work",
    slug: "other-work",
    level: 1,
    categoryType: "both",
    children: [
      { _id: "b-custom-matter", name: "Custom Matters & Consultation", slug: "custom-matters-and-consultation", level: 2, categoryType: "both" },
      { _id: "b-rect-other", name: "Rectification Deed", slug: "rectification-deed", level: 2, categoryType: "both" },
    ],
  },
];

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  try {
    const res = await api.get<{ tree: CategoryNode[] }>("/categories/tree");
    if (Array.isArray(res?.tree) && res.tree.length > 0) {
      return res.tree;
    }
  } catch (err) {
    console.error("Failed to fetch category tree, falling back to master baseline:", err);
  }
  return BASELINE_CATEGORY_TREE;
}

export function useCategoryTree() {
  return useQuery<CategoryNode[]>({
    queryKey: ["categories", "tree"],
    queryFn: fetchCategoryTree,
    staleTime: 1000 * 60 * 15,
    initialData: BASELINE_CATEGORY_TREE,
  });
}
