import { describe, expect, it } from "vitest";
import { classifyUri, hostOf, safeHref, safeImageSrc } from "./uri";

/**
 * Every URI here is supplied by the entity being displayed, the proof URI by an applicant
 * and logo/banner/website by a school, then rendered as something a donor is invited to
 * click. So this is an allowlist, and these tests exist to make sure it stays one.
 */
describe("classifyUri", () => {
  it("accepts http and https", () => {
    const result = classifyUri("https://registrar.example.edu/notices/wallet");
    expect(result.kind).toBe("http");
    if (result.kind === "http") {
      expect(result.host).toBe("registrar.example.edu");
      expect(result.href).toBe("https://registrar.example.edu/notices/wallet");
    }
    expect(classifyUri("http://example.edu").kind).toBe("http");
  });

  it("upgrades a bare hostname, which is the common well-meant mistake", () => {
    const result = classifyUri("example.edu/payments");
    expect(result.kind).toBe("http");
    if (result.kind === "http") {
      expect(result.href).toBe("https://example.edu/payments");
      expect(result.display).toBe("example.edu/payments");
    }
  });

  it("resolves ipfs:// through a gateway but keeps the raw value visible", () => {
    const result = classifyUri("ipfs://bafybeigdyrzt5example/proof.html");
    expect(result.kind).toBe("ipfs");
    if (result.kind === "ipfs") {
      expect(result.href).toBe("https://ipfs.io/ipfs/bafybeigdyrzt5example/proof.html");
      expect(result.display).toBe("ipfs://bafybeigdyrzt5example/proof.html");
      expect(result.host).toContain("gateway");
    }
  });

  it("refuses every scheme that could execute or smuggle content", () => {
    const hostile = [
      "javascript:alert(document.domain)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/uuid",
      "about:blank",
      "chrome://settings",
      "mailto:registrar@example.edu",
      "tel:+15551234567",
      "ftp://example.edu/proof.txt",
      "ws://example.edu",
    ];
    for (const value of hostile) {
      const result = classifyUri(value);
      expect(result.kind, `expected ${value} to be rejected`).toBe("unsafe");
      expect(safeHref(value), `expected no href for ${value}`).toBeNull();
      expect(safeImageSrc(value), `expected no img src for ${value}`).toBeNull();
    }
  });

  it("reports empty and unparseable input distinctly", () => {
    expect(classifyUri("").kind).toBe("empty");
    expect(classifyUri("   ").kind).toBe("empty");
    expect(classifyUri(undefined).kind).toBe("empty");
    expect(classifyUri(null).kind).toBe("empty");
    expect(classifyUri("not a url at all").kind).toBe("unsafe");
    expect(classifyUri("ipfs://../../etc/passwd").kind).toBe("unsafe");
  });

  it("always carries a reason when it refuses, so the UI can say why", () => {
    const result = classifyUri("javascript:alert(1)");
    expect(result.kind).toBe("unsafe");
    if (result.kind === "unsafe") {
      expect(result.reason.length).toBeGreaterThan(0);
      // The raw value is still preserved for display, because a hostile proof URI is itself a
      // finding a donor should be able to see.
      expect(result.display).toBe("javascript:alert(1)");
    }
  });
});

describe("hostOf", () => {
  it("extracts the host a verifier is actually being asked to judge", () => {
    expect(hostOf("https://registrar.example.edu/a/b?c=d")).toBe("registrar.example.edu");
    expect(hostOf("https://example.edu:8443/x")).toBe("example.edu:8443");
    expect(hostOf("javascript:alert(1)")).toBeNull();
    expect(hostOf("")).toBeNull();
  });
});
