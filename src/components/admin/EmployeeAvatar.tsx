import { useState } from "react";
import { cn } from "@/lib/utils";

interface EmployeeAvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  status?: string;
  showStatus?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
  "2xl": "size-20 text-xl font-bold",
};

const STATUS_SIZE_MAP = {
  xs: "size-2 -bottom-0.5 -right-0.5 ring-1",
  sm: "size-2.5 -bottom-0.5 -right-0.5 ring-1.5",
  md: "size-3 bottom-0 right-0 ring-2",
  lg: "size-3.5 bottom-0 right-0 ring-2",
  xl: "size-4 bottom-0.5 right-0.5 ring-2",
  "2xl": "size-5 bottom-1 right-1 ring-2",
};

// Refined, accessible background palettes for initials fallback
const PALETTES = [
  "bg-blue-950/80 text-blue-300 border-blue-800/60",
  "bg-indigo-950/80 text-indigo-300 border-indigo-800/60",
  "bg-violet-950/80 text-violet-300 border-violet-800/60",
  "bg-purple-950/80 text-purple-300 border-purple-800/60",
  "bg-teal-950/80 text-teal-300 border-teal-800/60",
  "bg-slate-900/90 text-slate-300 border-slate-700/60",
];

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index]!;
}

function getInitials(name?: string): string {
  if (!name) return "EMP";
  const clean = name.replace(/^Adv\.\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function EmployeeAvatar({
  name = "Employee",
  avatarUrl,
  size = "md",
  status,
  showStatus = false,
  className,
}: EmployeeAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const initials = getInitials(name);
  const palette = getPalette(name);
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const statusSizeClass = STATUS_SIZE_MAP[size] || STATUS_SIZE_MAP.md;

  const hasValidImage = Boolean(avatarUrl && !imgError);

  const statusTone =
    status === "online"
      ? "bg-emerald-500 ring-background"
      : status === "away"
      ? "bg-amber-500 ring-background"
      : "bg-slate-500 ring-background";

  return (
    <div className={cn("relative inline-flex shrink-0 select-none items-center justify-center", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-full font-display font-semibold transition-all duration-200 border",
          sizeClass,
          hasValidImage ? "bg-muted/40 border-border" : cn(palette)
        )}
      >
        {avatarUrl && !imgError ? (
          <>
            <img
              src={avatarUrl}
              alt={name}
              className={cn(
                "h-full w-full object-cover rounded-full transition-opacity duration-200",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {!imgLoaded && (
              <span className="absolute inset-0 flex items-center justify-center font-display font-medium text-muted-foreground animate-pulse">
                {initials}
              </span>
            )}
          </>
        ) : (
          <span className="flex h-full w-full items-center justify-center">{initials}</span>
        )}
      </div>

      {showStatus && status && (
        <span
          className={cn("absolute rounded-full", statusSizeClass, statusTone)}
          title={`Status: ${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
