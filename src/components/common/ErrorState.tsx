import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Friendly, retryable error placeholder. Use this instead of an empty state
 * when a query fails, so a transient outage doesn't read as "your data is
 * gone" to a non-technical user.
 */
export function ErrorState({
  title = "Couldn't load this data",
  description = "We couldn't reach the server. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle size={20} strokeWidth={1.75} className="text-destructive" />
      <div>
        <p className="font-medium text-destructive">{title}</p>
        <p className="mt-1 text-helper text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="rounded-md" onClick={onRetry}>
          <RotateCw size={15} strokeWidth={1.75} />
          Retry
        </Button>
      )}
    </div>
  );
}
