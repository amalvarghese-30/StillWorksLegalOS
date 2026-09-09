import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { searchKeys } from "./query-keys";

export interface SearchCase {
  _id: string;
  title: string;
  number?: string;
}

export interface SearchClient {
  _id: string;
  name: string;
  kycStatus?: string;
}

export interface SearchDocument {
  _id: string;
  name: string;
  state?: string;
}

export interface SearchTask {
  _id: string;
  title: string;
  status?: string;
}

export interface SearchUser {
  _id: string;
  name: string;
  role?: string;
}

export interface SearchResults {
  cases: SearchCase[];
  clients: SearchClient[];
  documents: SearchDocument[];
  tasks: SearchTask[];
  users: SearchUser[];
}

const emptyResults: SearchResults = {
  cases: [],
  clients: [],
  documents: [],
  tasks: [],
  users: [],
};

/**
 * Hook to perform global search with debouncing.
 * @param searchTerm The current search term
 * @param options Additional options for the query
 */
export function useSearch(
  searchTerm: string,
  options: {
    limit?: number;
  } = {}
) {
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
  } = useQuery<SearchResults>({
    queryKey: searchKeys.global(debouncedTerm, limit),
    queryFn: async (): Promise<SearchResults> => {
      if (!debouncedTerm.trim()) {
        return emptyResults;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedTerm)}&limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  return {
    searchResults: searchResults ?? emptyResults,
    isLoading,
    isError,
    error,
    refetch,
  };
}