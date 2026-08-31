"use client";

import { createConfig, createStorage, cookieStorage, http, injected } from "wagmi";
import { supportedChains, localAnvil, botchainTestnet, botchainMainnet } from "@/lib/chains";

/**
 * Wallet + transport configuration.
 *
 * Deliberately injected-only: no WalletConnect project id, no relay, no third-party
 * API key. A donor's connection goes browser -> RPC and nowhere else. EIP-6963
 * discovery is on by default in wagmi, so every injected wallet the browser
 * announces shows up without us enumerating them.
 *
 * `batch: false` on the public networks: BOT Chain's public RPC is rate-limited and
 * Multicall3 exists, so wagmi batches reads through the contract rather than by
 * stuffing JSON-RPC batches the node may reject.
 */

let cached: ReturnType<typeof build> | undefined;

function build() {
  return createConfig({
    chains: supportedChains,
    connectors: [injected({ shimDisconnect: true })],
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
