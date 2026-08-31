import type { Metadata } from "next";
import { RequestDetail } from "@/components/requests/request-detail";

export const metadata: Metadata = {
  title: "Fee request",
  description:
    "An outstanding school fee balance attested on-chain by a verified institution. See exactly where the money goes before you contribute.",
};

/** Ids are `uint256` assigned in order by the vault. Anything else is not an id. */
function parseRequestId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    const id = BigInt(value);
    return id >= 0n && id <= 2n ** 256n - 1n ? id : null;
  } catch {
    return null;
  }
}

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail requestId={parseRequestId(id)} />;
}
