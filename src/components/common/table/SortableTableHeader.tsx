import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { type SortDirection } from "@/lib/sorting";
import { cn } from "@/lib/utils";

export interface SortHeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  sortKey: string;
  currentSortKey?: string | null;
  currentDirection?: SortDirection;
  onSort?: (key: string) => void;
  align?: "left" | "center" | "right";
  children: React.ReactNode;
}

export function SortHeaderButton({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  align = "left",
  children,
  className,
  ...rest
}: SortHeaderButtonProps) {
  const isActive = currentSortKey === sortKey && currentDirection !== null;

  // Compute accessible tooltip
  let tooltip = "Sort ascending";
  if (isActive) {
    tooltip = currentDirection === "asc" ? "Sort descending" : "Restore default order";
  }

  const ariaSort = isActive
    ? currentDirection === "asc"
      ? "ascending"
      : "descending"
    : "none";

  const alignClasses =
    align === "center"
      ? "justify-center mx-auto"
      : align === "right"
      ? "justify-end ml-auto"
      : "justify-start";

  return (
    <button
      type="button"
      onClick={() => onSort?.(sortKey)}
      title={tooltip}
      aria-label={`${typeof children === "string" ? children : sortKey}, ${tooltip}`}
      aria-sort={ariaSort}
      className={cn(
        "group inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm px-0.5",
        alignClasses,
        isActive
          ? "text-primary font-bold dark:text-primary"
          : "text-muted-foreground hover:text-foreground font-semibold",
        className
      )}
      {...rest}
    >
      <span className="truncate">{children}</span>

      {isActive ? (
        currentDirection === "asc" ? (
          <ArrowUp
            size={12}
            strokeWidth={2.5}
            className="shrink-0 text-primary animate-in fade-in-50 zoom-in-75 duration-150"
            aria-hidden="true"
          />
        ) : (
          <ArrowDown
            size={12}
            strokeWidth={2.5}
            className="shrink-0 text-primary animate-in fade-in-50 zoom-in-75 duration-150"
            aria-hidden="true"
          />
        )
      ) : (
        <ArrowUpDown
          size={11}
          className="shrink-0 opacity-40 group-hover:opacity-80 transition-opacity duration-150"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey?: string;
  currentSortKey?: string | null;
  currentDirection?: SortDirection;
  onSort?: (key: string) => void;
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

export function SortableTableHead({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  align = "left",
  sortable = true,
  children,
  className,
  ...thProps
}: SortableTableHeadProps) {
  const isSortable = Boolean(sortable && sortKey && onSort);

  const textAlignment =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <th
      scope="col"
      className={cn(
        "py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none",
        textAlignment,
        className
      )}
      {...thProps}
    >
      {isSortable && sortKey ? (
        <SortHeaderButton
          sortKey={sortKey}
          currentSortKey={currentSortKey}
          currentDirection={currentDirection}
          onSort={onSort}
          align={align}
        >
          {children}
        </SortHeaderButton>
      ) : (
        <span>{children}</span>
      )}
    </th>
  );
}
