import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StaleDataBannerProps {
  message?: string;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Non-disruptive banner displayed when cached data is visible but a background
 * refetch encountered an error. Never hides user data; enables on-demand manual refresh.
 */
export function StaleDataBanner({
  message = "You are viewing cached information. The latest update could not be fetched from the server.",
  onRefresh,
  isRefreshing = false,
  className = "",
}: StaleDataBannerProps) {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{message}</span>
      </div>
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-7 px-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
        >
          <RotateCw size={13} className={`mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
        </Button>
      )}
    </div>
  );
}
