import type { SVGProps } from "react";

/**
 * Inline SVG only — no icon package, no font, no network request. Every glyph here is
 * a thin 1.5px stroke on a 24-unit grid so the set reads as one family.
 *
 * Deliberately absent: flames, clocks with motion, exclamation marks, rockets. The
 * iconography of urgency belongs to the thing this product replaces.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The verification seal. Used only for registry-verified facts, never decoratively. */
export function SealIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.75 14.4 4.3l2.85-.25 1.05 2.67 2.35 1.63-.86 2.73.86 2.73-2.35 1.63-1.05 2.67-2.85-.25L12 19.35l-2.4-1.55-2.85.25-1.05-2.67L3.35 13.8l.86-2.73-.86-2.73L5.7 6.71l1.05-2.66L9.6 4.3 12 2.75Z" />
      <path d="m8.9 11.9 2.1 2.1 4.1-4.2" />
    </Svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 4.5h6v6" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.5v3.75A1.75 1.75 0 0 1 16.25 20H5.75A1.75 1.75 0 0 1 4 18.25V7.75A1.75 1.75 0 0 1 5.75 6H9.5" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}

/** A closed padlock: the student has no key. Used on the custody explainer. */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Svg>
  );
}

/** Institution / school. */
export function BuildingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 20h18" />
      <path d="M4.5 20V9.5L12 5l7.5 4.5V20" />
      <path d="M9.5 20v-5h5v5" />
    </Svg>
  );
}

export function LedgerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3.25 3.25 0 0 1 0 6.1" />
      <path d="M17.5 15a5.5 5.5 0 0 1 3 4.5" />
    </Svg>
  );
}

export function SpinnerIcon({ size = 16, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`spin-slow ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.85" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Verification withdrawn. A broken seal, not a warning triangle. */
export function SealBrokenIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.75 14.4 4.3l2.85-.25 1.05 2.67 2.35 1.63-.86 2.73.86 2.73-2.35 1.63-1.05 2.67-2.85-.25L12 19.35l-2.4-1.55-2.85.25-1.05-2.67L3.35 13.8l.86-2.73-.86-2.73L5.7 6.71l1.05-2.66L9.6 4.3 12 2.75Z" />
      <path d="m9.4 9.4 5.2 5.2M14.6 9.4l-5.2 5.2" />
    </Svg>
  );
}
