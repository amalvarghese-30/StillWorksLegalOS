import { AlertTriangle, AlertCircle, ShieldAlert, FileQuestion, RotateCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
  variant?: "error" | "warning" | "access-denied" | "not-found";
  className?: string;
  actionLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Friendly, accessible, retryable error placeholder. Use this instead of an empty state
 * when a query fails, so a transient outage doesn't read as "your data is gone".
 */
export function ErrorState({
  title = "Couldn't load this data",
  description = "We couldn't reach the server. Check your connection and try again.",
  onRetry,
  isRetrying = false,
  variant = "error",
  className = "",
  actionLabel = "Retry",
  secondaryAction,
}: ErrorStateProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "warning":
        return {
          container: "border-amber-500/30 bg-amber-500/5",
          titleText: "text-amber-700 dark:text-amber-400",
          icon: <AlertCircle size={22} strokeWidth={1.75} className="text-amber-600 dark:text-amber-400" />,
        };
      case "access-denied":
        return {
          container: "border-orange-500/30 bg-orange-500/5",
          titleText: "text-orange-700 dark:text-orange-400",
          icon: <ShieldAlert size={22} strokeWidth={1.75} className="text-orange-600 dark:text-orange-400" />,
        };
      case "not-found":
        return {
          container: "border-muted-foreground/30 bg-muted/10",
          titleText: "text-foreground",
          icon: <FileQuestion size={22} strokeWidth={1.75} className="text-muted-foreground" />,
        };
      case "error":
      default:
        return {
          container: "border-destructive/30 bg-destructive/5",
          titleText: "text-destructive",
          icon: <AlertTriangle size={22} strokeWidth={1.75} className="text-destructive" />,
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border p-8 text-center transition-all ${styles.container} ${className}`}
    >
      {styles.icon}
      <div className="max-w-md">
        <p className={`font-semibold ${styles.titleText}`}>{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5 font-medium text-xs shadow-2xs hover:bg-background"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : (
              <RotateCw size={14} strokeWidth={1.75} />
            )}
            <span>{isRetrying ? "Retrying…" : actionLabel}</span>
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs font-medium"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
