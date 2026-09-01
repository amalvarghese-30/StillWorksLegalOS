import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { searchKeys } from "./query-keys";

/**
 * Hook to perform global search with debouncing.
 * @param searchTerm The current search term
 * @param options Additional options for the query
 */
export function useSearch(searchTerm: string, options: {
  limit?: number;
} = {}) {
  const queryClient = useQueryClient();
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
  const limit = options.limit ?? 10;

  // Debounce the search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Perform the search query
  const {
    data: searchResults,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: searchKeys.global(debouncedTerm, limit),
    queryFn: async () => {
      if (!debouncedTerm.trim()) {
        return {
          cases: [],
          clients: [],
          documents: [],
          tasks: [],
          users: [],
        };
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedTerm)}&limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }
      return res.json();
    },
    // Keep previous results while searching for a new term (unless it's the first search)
    keepPreviousData: true,
  });

  return {
    searchResults: searchResults ?? {
      cases: [],
      clients: [],
      documents: [],
      tasks: [],
      users: [],
    },
    isLoading,
    isError,
    error,
    refetch,
  };
}