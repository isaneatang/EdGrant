"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { MenuIcon } from "@/components/ui/icons";
import { PRIMARY_NAV, isActive } from "./nav-items";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-rule bg-canvas/92 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="container-page flex h-14 items-center gap-3 sm:h-16">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-sm"
            aria-label="EdGrant home"
          >
            <Mark />
            <span className="hidden font-serif text-[1.0625rem] leading-none font-semibold tracking-tight text-ink sm:block">
              EdGrant
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="ml-4 hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {PRIMARY_NAV.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex h-9 items-center rounded-sm px-3 text-[0.875rem] transition-colors ${
                        active
                          ? "bg-surface-sunken font-medium text-ink"
                          : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <WalletButton compact />
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-sm text-ink-soft hover:bg-surface-sunken hover:text-ink lg:hidden"
            >
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} returnFocusRef={triggerRef} />
    </>
  );
}

/** Wordmark: a seal over a rule. Institutional, not a logo-with-a-swoosh. */
function Mark() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-evidence-rule bg-evidence-soft"
      aria-hidden
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="text-evidence">
        <path
          d="M12 3.2 19 6.6v5.1c0 4.2-2.8 7.4-7 9.1-4.2-1.7-7-4.9-7-9.1V6.6L12 3.2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m8.9 12.1 2.2 2.2 4-4.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
