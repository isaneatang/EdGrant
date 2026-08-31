"use client";

import { createConfig, createStorage, cookieStorage, http, injected } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { supportedChains, localAnvil, botchainTestnet, botchainMainnet } from "@/lib/chains";

/**
 * Wallet + transport configuration.
 *
 * Injected wallets are the default path and need no configuration: EIP-6963 discovery
 * is on in wagmi, so every injected wallet the browser announces shows up without us
 * enumerating them, and that connection goes browser -> RPC and nowhere else.
 *
 * WalletConnect is added ONLY when a Reown project id is configured. This is a
 * deliberate reversal of the original injected-only stance, and the trade is worth
 * stating rather than burying: without it, a donor on a phone can connect only from
 * inside a wallet's own browser, which excludes most mobile users, and mobile is not
 * a minority case for this audience. With it, Reown's relay sits in the connection
 * path and sees session metadata, so the "no third party is involved in a donation"
 * claim narrows to "no third party can touch the money", which is still true and is
 * the property that actually matters.
 *
 * It is opt-in by absence: with no project id the app is exactly as it was before,
 * injected-only, rather than half-configured and failing at connect time. The same
 * principle the chain config uses, where an unconfigured thing says so instead of guessing.
 *
 * `batch: false` on the public networks: BOT Chain's public RPC is rate-limited and
 * Multicall3 exists, so wagmi batches reads through the contract rather than by
 * stuffing JSON-RPC batches the node may reject.
 */

/**
 * Public by design. It identifies the app to Reown's relay and is visible in any
 * browser. It is not a secret and must never be treated as one.
 */
const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();

let cached: ReturnType<typeof build> | undefined;

function build() {
  return createConfig({
    chains: supportedChains,
    connectors: [
      injected({ shimDisconnect: true }),
      ...(reownProjectId
        ? [
            walletConnect({
              projectId: reownProjectId,
              showQrModal: true,
              metadata: {
                name: "EdGrant",
                description:
                  "Verified education funding. Contributions are paid to a school's verified wallet, never to the student.",
                url: "https://edgrant.vercel.app",
                icons: [],
              },
            }),
          ]
        : []),
    ],
    transports: {
      [localAnvil.id]: http(localAnvil.rpcUrls.default.http[0]),
      [botchainTestnet.id]: http(botchainTestnet.rpcUrls.default.http[0], {
        batch: false,
        retryCount: 2,
      }),
      [botchainMainnet.id]: http(botchainMainnet.rpcUrls.default.http[0], {
        batch: false,
        retryCount: 2,
      }),
    },
    ssr: true,
    storage: createStorage({ storage: cookieStorage, key: "edgrant" }),
  });
}

export function getWagmiConfig() {
  if (!cached) cached = build();
  return cached;
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof build>;
  }
}
