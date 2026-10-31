import { useState, useMemo, useCallback } from "react";
import {
  type SortDirection,
  type SortState,
  type AccessorFn,
  getNextSortState,
  sortData,
} from "@/lib/sorting";

export interface UseTableSortingOptions<T, TKey extends string = string> {
  initialKey?: TKey | null;
  initialDirection?: SortDirection;
  accessors?: Record<string, AccessorFn<T>>;
}

export interface SortProps<TKey extends string = string> {
  sortKey: TKey;
  currentSortKey: TKey | null;
  currentDirection: SortDirection;
  onSort: (key: TKey) => void;
}

export interface UseTableSortingReturn<T, TKey extends string = string> {
  sortedData: T[];
  sortKey: TKey | null;
  sortDirection: SortDirection;
  onSort: (key: TKey) => void;
  resetSort: () => void;
  setSort: (key: TKey | null, direction: SortDirection) => void;
  getSortProps: (key: TKey) => SortProps<TKey>;
  isSorted: boolean;
}

/**
 * Reusable table sorting hook supporting 3-state cycling:
 * 1. Ascending
 * 2. Descending
 * 3. Default / Reset to original order
 */
export function useTableSorting<T, TKey extends string = string>(
  data: readonly T[],
  options?: UseTableSortingOptions<T, TKey>
): UseTableSortingReturn<T, TKey> {
  const [sortState, setSortState] = useState<SortState<TKey>>({
    key: options?.initialKey ?? null,
    direction: options?.initialDirection ?? null,
  });

  const onSort = useCallback((targetKey: TKey) => {
    setSortState((prev) => getNextSortState(prev.key, prev.direction, targetKey));
  }, []);

  const resetSort = useCallback(() => {
    setSortState({ key: null, direction: null });
  }, []);

  const setSort = useCallback((key: TKey | null, direction: SortDirection) => {
    setSortState({ key, direction });
  }, []);

  const sortedData = useMemo(() => {
    return sortData(data, sortState.key, sortState.direction, options?.accessors);
  }, [data, sortState.key, sortState.direction, options?.accessors]);

  const getSortProps = useCallback(
    (key: TKey): SortProps<TKey> => ({
      sortKey: key,
      currentSortKey: sortState.key,
      currentDirection: sortState.direction,
      onSort,
    }),
    [sortState.key, sortState.direction, onSort]
  );

  return {
    sortedData,
    sortKey: sortState.key,
    sortDirection: sortState.direction,
    onSort,
    resetSort,
    setSort,
    getSortProps,
    isSorted: sortState.direction !== null && sortState.key !== null,
  };
}
