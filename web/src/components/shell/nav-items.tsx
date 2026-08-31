import {
  BuildingIcon,
  LedgerIcon,
  SealIcon,
  UsersIcon,
  InfoIcon,
} from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  /** Shown in the mobile drawer only, where there is room to explain. */
  hint: string;
  icon: React.ReactNode;
  /** Match nested routes as well as the exact path. */
  prefix?: boolean;
};

/** Primary navigation: what a supporter is here to do. */
export const PRIMARY_NAV: NavItem[] = [
  {
    href: "/",
    label: "Fee requests",
    hint: "Open balances attested by verified institutions",
    icon: <LedgerIcon size={17} />,
  },
  {
    href: "/schools",
    label: "Institutions",
    hint: "Verified schools and what they have actually been paid",
    icon: <BuildingIcon size={17} />,
    prefix: true,
  },
  {
    href: "/portfolio",
    label: "Your contributions",
    hint: "What you have given, and anything you can withdraw",
    icon: <UsersIcon size={17} />,
  },
  {
    href: "/how-it-works",
    label: "How it works",
    hint: "The trust model, and the one place it needs a human",
    icon: <InfoIcon size={17} />,
  },
];

/** Consoles: only relevant if you hold one of the two privileged roles. */
export const CONSOLE_NAV: NavItem[] = [
  {
    href: "/school/admin",
    label: "School console",
    hint: "Publish a profile, post notices, attest fee balances",
    icon: <BuildingIcon size={17} />,
  },
  {
    href: "/verifier",
    label: "Verifier console",
    hint: "Review proof-of-control applications and confirm them",
    icon: <SealIcon size={17} />,
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.prefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}
