/**
 * Every URI in this system is supplied by the entity being displayed — the proof URI
 * by an applicant, logo/banner/website by a school. All of it is untrusted input that
 * we then render as something a donor is invited to click.
 *
 * So: an allowlist, not a blocklist. Only http and https become live links. Anything
 * else — javascript:, data:, vbscript:, or a scheme we simply have not thought about —
 * is displayed as inert text with a note saying why. `ipfs://` is common enough in this
 * space to be worth resolving through a public gateway, but the raw value is always
 * shown too so nobody has to trust our gateway choice.
 */

export type SafeUri =
  | { kind: "http"; href: string; display: string; host: string }
  | { kind: "ipfs"; href: string; display: string; host: string }
  | { kind: "unsafe"; display: string; reason: string }
  | { kind: "empty" };

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function classifyUri(raw: string | undefined | null): SafeUri {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "empty" };

  if (value.toLowerCase().startsWith("ipfs://")) {
    const path = value.slice("ipfs://".length).replace(/^ipfs\//i, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9./_-]*$/.test(path)) {
      return { kind: "unsafe", display: value, reason: "Malformed IPFS path" };
    }
    return {
      kind: "ipfs",
      href: `${IPFS_GATEWAY}${path}`,
      display: value,
      host: "ipfs.io (public gateway)",
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // A bare domain is the most common well-intentioned mistake. Upgrade it rather
    // than rejecting, but only if it actually looks like a hostname.
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/.*)?$/i.test(value)) {
      try {
        const upgraded = new URL(`https://${value}`);
        return {
          kind: "http",
          href: upgraded.toString(),
          display: value,
          host: upgraded.host,
        };
      } catch {
        /* fall through */
      }
    }
    return { kind: "unsafe", display: value, reason: "Not a valid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      kind: "unsafe",
      display: value,
      reason: `Unsupported scheme "${url.protocol.replace(":", "")}"`,
    };
  }

  return { kind: "http", href: url.toString(), display: value, host: url.host };
}

/** Href for an <a>, or null when the value must not become a link. */
export function safeHref(raw: string | undefined | null): string | null {
  const classified = classifyUri(raw);
  return classified.kind === "http" || classified.kind === "ipfs" ? classified.href : null;
}

/** Src for an <img>, or null. Images are never proxied through our server. */
export function safeImageSrc(raw: string | undefined | null): string | null {
  return safeHref(raw);
}

/** `https://registrar.example.edu/notices/wallet` -> `registrar.example.edu` */
export function hostOf(raw: string | undefined | null): string | null {
  const classified = classifyUri(raw);
  if (classified.kind === "http" || classified.kind === "ipfs") return classified.host;
  return null;
}
