"use client";

import { cn } from "@/lib/utils";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only fixed top-4 left-4 z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground font-medium shadow-lg transition-all duration-150",
        "focus:opacity-100 focus:scale-100",
      )}
    >
      Skip to main content
    </a>
  );
}