"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Mode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: Mode;
  resolved: "light" | "dark";
  setMode: (mode: Mode) => void;
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = "edgrant.theme";

/**
 * Inlined into <head> before paint so the very first frame is already the right theme.
 * Kept as a string constant rather than a separate file so it cannot drift from the storage
 * key and class name the provider below uses.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var mode = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = mode;
  } catch (e) {}
})();
`;

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Read during the first client render rather than in an effect.
 *
 * The bootstrap script above has already put the right class on <html>, so React state
 * simply needs to agree with what is on screen. Doing this in an effect would mean one
 * render with the wrong value and a cascading re-render to correct it.
 */
function initialMode(): Mode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private browsing modes can throw on localStorage access.
    return "system";
  }
}

function resolve(mode: Mode): "light" | "dark" {
  return mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(initialMode()));

  // Follows the OS only while the preference is "system". Not a state initialiser: this is
  // a subscription to an external source, which is what effects are for.
  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const eff = media.matches ? "dark" : "light";
      setResolved(eff);
      apply(eff);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* preference simply will not persist */
    }
    const eff = resolve(next);
    setResolved(eff);
    apply(eff);
  }, []);

  const cycle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, cycle }),
    [mode, resolved, setMode, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
