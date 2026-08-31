"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getWagmiConfig } from "@/lib/wagmi";
import { ThemeProvider } from "./theme";
import { ToastProvider } from "./toast";

/**
 * Query defaults are tuned for BOT Chain: ~0.7s blocks, and a public RPC that
 * rate-limits. Polling every 12s keeps a feed feeling live without hammering the
 * node, and refetch-on-focus is off because a donor tabbing back should not trigger
 * a burst of reads. Every write path explicitly invalidates what it changed, which
 * is more precise than a short stale time anyway.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 8_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
