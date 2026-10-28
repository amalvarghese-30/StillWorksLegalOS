import { useState, useEffect } from "react";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string;
  initials?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

function computeInitials(name?: string, fallback = "SW"): string {
  if (!name) return fallback;
  const clean = name.replace(/^Adv\.\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Reusable UserAvatar component for Topbars, Sidebars, and Profile views.
 * Guarantees safe absolute avatar URL resolution in both Web and packaged Electron.
 * Smoothly falls back to user initials on error (e.g. missing 404 image) with zero retry loops.
 */
export function UserAvatar({
  avatarUrl,
  name,
  initials,
  className,
  imgClassName,
  fallbackClassName,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = resolveAvatarUrl(avatarUrl);

  // Reset error state when avatarUrl changes (e.g. after profile upload)
  useEffect(() => {
    setHasError(false);
  }, [resolvedUrl]);

  const displayInitials = initials || computeInitials(name);
  const hasValidImage = Boolean(resolvedUrl && !hasError);

  if (hasValidImage) {
    return (
      <img
        src={resolvedUrl}
        alt={name || "User Avatar"}
        onError={() => setHasError(true)}
        className={cn("rounded-full object-cover shrink-0 border border-border/80", className, imgClassName)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-primary/12 font-display font-semibold text-primary shrink-0 select-none",
        className,
        fallbackClassName
      )}
    >
      {displayInitials}
    </span>
  );
}
