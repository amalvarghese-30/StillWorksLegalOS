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
    if (Array.isArray(res.data?.categories) && res.data.categories.length > 0) {
      // Merge baseline with fetched categories, deduplicating
      const set = new Set([...BASELINE_CATEGORIES, ...res.data.categories]);
      return Array.from(set);
    }
  } catch {
    // If dedicated /categories fails, try /tasks/options
    try {
      const taskOptRes = await api.get<{ categories: string[] }>("/tasks/options");
      if (Array.isArray(taskOptRes.data?.categories) && taskOptRes.data.categories.length > 0) {
        const set = new Set([...BASELINE_CATEGORIES, ...taskOptRes.data.categories]);
        return Array.from(set);
      }
    } catch {
      // Fallback to baseline
    }
  }
  return BASELINE_CATEGORIES;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    initialData: BASELINE_CATEGORIES,
  });
}
