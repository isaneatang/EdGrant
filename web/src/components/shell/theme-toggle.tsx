"use client";

import { useTheme } from "@/providers/theme";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, cycle } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Switch to ${next} appearance`}
      title={`Switch to ${next} appearance`}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      {resolved === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}
