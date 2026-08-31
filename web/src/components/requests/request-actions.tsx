"use client";

import { useAccount } from "wagmi";
import { educationFundingVaultAbi } from "@/lib/abi";
import { contractsFor } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { useDeployment, useMyContribution } from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { WalletButton } from "@/components/shell/wallet-button";
import { SpinnerIcon, ArrowRightIcon } from "@/components/ui/icons";
import { AddressDisplay } from "@/components/ui/address-display";

/**
 * `release` is permissionless. Anyone can call it once the goal is met.
 *
 * That is a deliberate design choice worth surfacing rather than hiding: it means the
 * payout does not depend on the school acting, and it does not depend on us existing. It
 * is also why the goal-completing contribution does not auto-release — that would charge
 * one unlucky donor for everybody else's disbursement, and would let a recipient that
 * reverts on receipt break contributions for everyone.
 */
export function ReleaseAction({
  requestId,
  goal,
  destination,
  destinationName,
}: {
  requestId: bigint;
  goal: bigint;
  destination: string;
  destinationName: string;
}) {
  const { isConnected } = useAccount();
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const tx = useTxRunner();

  if (!contracts) return null;

  return (
    <section className="card border-evidence-rule overflow-hidden" aria-labelledby="release-heading">
      <header className="border-b border-rule px-4 py-3 sm:px-5">
        <h2 id="release-heading" className="eyebrow font-sans! text-ink">
          Ready to pay the school
        </h2>
      </header>
      <div className="px-4 py-4 sm:px-5">
        <p className="text-[0.875rem] leading-relaxed text-ink-soft">
          This balance is fully funded. The transfer is a separate, permissionless call —{" "}
          <strong className="font-medium text-ink">anyone</strong> can make it, including you.
          It does not need the school&apos;s cooperation and it does not need ours.
        </p>

        <div className="mt-4 flex flex-col gap-2 rounded-sm border border-rule bg-surface-sunken px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-ink-faint">Will transfer</p>
            <p className="tabular mt-0.5 font-serif text-lg font-semibold text-ink">
              {formatAmount(goal)}
            </p>
          </div>
          <ArrowRightIcon size={16} className="rotate-90 text-ink-faint sm:rotate-0" />
          <div className="min-w-0 sm:text-right">
            <p className="eyebrow text-ink-faint">To</p>
            <p className="mt-0.5 truncate text-[0.875rem] font-medium text-ink">
              {destinationName || "the verified institution"}
            </p>
            <AddressDisplay address={destination} chars={6} showExplorer={false} />
          </div>
        </div>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
          Verification is re-checked at this moment, not just at creation. If the badge had
          been revoked, this call would revert and contributors could withdraw instead.
        </p>

        <div className="mt-4">
          {isConnected ? (
            <button
              type="button"
              disabled={tx.isBusy}
              onClick={() =>
                tx.run({
                  address: contracts.vault,
                  abi: educationFundingVaultAbi,
                  functionName: "release",
                  args: [requestId],
                  label: "Release",
                  success: `${formatAmount(goal)} was transferred to the school's verified wallet.`,
                })
              }
              className="btn btn-evidence w-full"
            >
              {tx.isBusy ? <SpinnerIcon size={15} /> : null}
              {tx.stage === "signing"
                ? "Confirm in your wallet…"
                : tx.stage === "mining"
                  ? "Transferring…"
                  : `Send ${formatAmount(goal)} to the school`}
            </button>
          ) : (
            <WalletButton />
          )}
        </div>

        {tx.error ? (
          <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
            {tx.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Refunds are individual and pull-based. Each contributor withdraws exactly what they put
 * in — there is no pooled refund, nothing is ever swept, and no administrator is involved.
 */
export function RefundAction({
  requestId,
  reason,
}: {
  requestId: bigint;
  reason: "closed-unmet" | "verification-withdrawn";
}) {
  const { isConnected } = useAccount();
  const { chainId } = useDeployment();
  const contracts = contractsFor(chainId);
  const { data: mine } = useMyContribution(requestId);
  const tx = useTxRunner();

  if (!contracts) return null;

  const nothingToClaim = isConnected && mine !== undefined && mine === 0n;

  return (
    <section className="card overflow-hidden" aria-labelledby="refund-heading">
      <header className="border-b border-rule px-4 py-3 sm:px-5">
        <h2 id="refund-heading" className="eyebrow font-sans! text-ink">
          Withdraw your contribution
        </h2>
      </header>
      <div className="px-4 py-4 sm:px-5">
        <p className="text-[0.875rem] leading-relaxed text-ink-soft">
          {reason === "verification-withdrawn"
            ? "This school's verification has been revoked, so the vault can no longer pay it. Withdrawals are open immediately — you do not have to wait for the deadline."
            : "The deadline passed without the goal being met. Nothing was sent to the school."}{" "}
          Each contributor withdraws their own contribution. There is no pooled refund to wait
          for, and no unclaimed balance accumulates anywhere.
        </p>

        {isConnected ? (
          nothingToClaim ? (
            <p className="mt-4 rounded-sm border border-rule bg-surface-sunken px-3 py-2.5 text-[0.8125rem] text-ink-muted">
              This wallet has nothing to withdraw from this balance — either it did not
              contribute, or it has already withdrawn.
            </p>
          ) : (
            <>
              <div className="mt-4 rounded-sm border border-rule bg-surface-sunken px-3 py-2.5">
                <p className="eyebrow text-ink-faint">Your contribution</p>
                <p className="tabular mt-0.5 font-serif text-lg font-semibold text-ink">
                  {mine === undefined ? "—" : formatAmount(mine)}
                </p>
              </div>
              <button
                type="button"
                disabled={tx.isBusy || mine === undefined || mine === 0n}
                onClick={() =>
                  tx.run({
                    address: contracts.vault,
                    abi: educationFundingVaultAbi,
                    functionName: "refund",
                    args: [requestId],
                    label: "Withdrawal",
                    success: `${mine === undefined ? "Your contribution" : formatAmount(mine)} was returned to your wallet.`,
                  })
                }
                className="btn btn-primary mt-4 w-full"
              >
                {tx.isBusy ? <SpinnerIcon size={15} /> : null}
                {tx.stage === "signing"
                  ? "Confirm in your wallet…"
                  : tx.stage === "mining"
                    ? "Withdrawing…"
                    : `Withdraw ${mine === undefined ? "" : formatAmount(mine)}`.trim()}
              </button>
            </>
          )
        ) : (
          <div className="mt-4">
            <WalletButton />
          </div>
        )}

        {tx.error ? (
          <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
            {tx.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
