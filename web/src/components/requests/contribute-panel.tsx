"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { educationFundingVaultAbi, erc20Abi } from "@/lib/abi";
import { contractsFor, TOKEN_SYMBOL } from "@/lib/contracts";
import { formatAmount, parseAmount, toAmountInput } from "@/lib/format";
import type { RequestState } from "@/lib/request";
import { useDeployment, useMyContribution, useTokenState } from "@/hooks/use-edgrant";
import { useTxRunner } from "@/hooks/use-tx";
import { WalletButton } from "@/components/shell/wallet-button";
import { Callout } from "@/components/ui/callout";
import { CheckIcon, SpinnerIcon } from "@/components/ui/icons";

/**
 * The contribute form: amount, approval, contribution.
 *
 * USDT on BOT Chain has no EIP-2612 `permit` — verified live, `DOMAIN_SEPARATOR()` and
 * `nonces()` both revert — so contributing genuinely takes two transactions. Rather than
 * hide that behind a single button that opens two wallet prompts, the two steps are shown
 * as two steps, numbered, with the current one highlighted. A donor who understands what
 * they are signing is the entire point of this product.
 *
 * The approval is for the exact amount being contributed, not unlimited. Slightly more
 * friction on a second contribution; considerably less standing authority granted to a
 * contract. For a product whose argument is "grant no more power than the mechanism
 * needs", unlimited approval by default would be incoherent.
 */
export function ContributePanel({
  requestId,
  state,
  remaining,
  goal,
}: {
  requestId: bigint;
  state: RequestState;
  remaining: bigint;
  goal: bigint;
}) {
  const { isConnected } = useAccount();
  const { chainId, ready } = useDeployment();
  const contracts = contractsFor(chainId);
  const { balance, allowance } = useTokenState();
  const { data: alreadyGiven } = useMyContribution(requestId);

  // Two runners, deliberately. A single shared one meant the approval finishing counted as
  // "done" for the whole panel: the amount field was cleared and the contribute button went
  // disabled, so a donor who had just approved had to retype the figure they had already
  // committed to. Each step now owns its own state.
  const approveTx = useTxRunner();
  const contributeTx = useTxRunner();
  const busy = approveTx.isBusy || contributeTx.isBusy;

  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => parseAmount(input), [input]);
  const amount = parsed.ok ? parsed.value : 0n;

  const problem = useMemo(() => {
    if (!touched && input === "") return null;
    if (!parsed.ok) return parsed.error;
    if (parsed.value > remaining) {
      return `Only ${formatAmount(remaining)} is still outstanding. The vault rejects overfunding rather than trimming your contribution.`;
    }
    if (balance !== undefined && parsed.value > balance) {
      return `Your balance is ${formatAmount(balance)}.`;
    }
    return null;
  }, [parsed, touched, input, remaining, balance]);

  const needsApproval = allowance !== undefined && amount > 0n && allowance < amount;
  const canSubmit = parsed.ok && problem === null && !busy;

  if (!ready || !contracts) return null;

  if (!state.canContribute) return null;

  if (!isConnected) {
    return (
      <section className="card p-4 sm:p-5">
        <p className="text-sm font-medium text-ink">Contribute</p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
          Connect a wallet holding {TOKEN_SYMBOL} to contribute. EdGrant never asks for a seed
          phrase or a private key, and there is no code path here that could.
        </p>
        <div className="mt-4">
          <WalletButton />
        </div>
      </section>
    );
  }

  const presets = buildPresets(remaining);

  return (
    <section className="card overflow-hidden" aria-labelledby="contribute-heading">
      <header className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <h2 id="contribute-heading" className="eyebrow font-sans! text-ink">
          Contribute
        </h2>
        <p className="tabular text-[0.75rem] text-ink-muted">
          Balance {balance === undefined ? "—" : formatAmount(balance)}
        </p>
      </header>

      <div className="px-4 py-4 sm:px-5">
        {alreadyGiven !== undefined && alreadyGiven > 0n ? (
          <p className="mb-4 rounded-sm border border-evidence-rule bg-evidence-soft px-3 py-2 text-[0.8125rem] text-evidence">
            You have already contributed{" "}
            <span className="tabular font-medium">{formatAmount(alreadyGiven)}</span> to this
            balance.
          </p>
        ) : null}

        <label htmlFor="contribute-amount" className="label-text">
          Amount in {TOKEN_SYMBOL}
        </label>
        <div className="relative">
          <input
            id="contribute-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={problem !== null}
            aria-describedby={problem ? "contribute-problem" : undefined}
            className={`field tabular pr-16 font-mono text-lg ${problem ? "field-invalid" : ""}`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.8125rem] text-ink-faint">
            {TOKEN_SYMBOL}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setInput(toAmountInput(preset.value));
                setTouched(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {problem ? (
          <p id="contribute-problem" role="alert" className="mt-3 text-[0.8125rem] text-fault">
            {problem}
          </p>
        ) : null}

        {/* Two-step progress. Always both steps, so the flow is never a surprise. */}
        <ol className="mt-5 space-y-2">
          <Step
            index={1}
            title={`Approve the vault to move ${amount > 0n ? formatAmount(amount) : `your ${TOKEN_SYMBOL}`}`}
            body={
              amount === 0n
                ? "Approved for exactly the amount you enter — never unlimited."
                : needsApproval
                  ? "For exactly this amount, never unlimited. USDT on BOT Chain has no permit(), so this cannot be folded into a single signature."
                  : "Already approved for this amount — and for no more than it, because the approval is never unlimited."
            }
            state={amount === 0n ? "waiting" : needsApproval ? "current" : "done"}
          />
          <Step
            index={2}
            title="Contribute to this fee balance"
            body="The vault takes custody. It can only ever send this to the school's verified wallet, or back to you."
            state={amount === 0n ? "waiting" : needsApproval ? "waiting" : "current"}
          />
        </ol>

        <div className="mt-5">
          {needsApproval ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() =>
                approveTx.run({
                  address: contracts.token,
                  abi: erc20Abi,
                  functionName: "approve",
                  args: [contracts.vault, amount],
                  label: "Approval",
                  success: `The vault may now move ${formatAmount(amount)} from your wallet. Nothing has moved yet.`,
                })
              }
              className="btn btn-primary w-full"
            >
              {approveTx.isBusy ? <SpinnerIcon size={15} /> : null}
              {approveTx.stage === "signing"
                ? "Confirm in your wallet…"
                : approveTx.stage === "mining"
                  ? "Approving…"
                  : `Step 1 · Approve ${amount > 0n ? formatAmount(amount) : TOKEN_SYMBOL}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSubmit || amount === 0n}
              onClick={async () => {
                const receipt = await contributeTx.run({
                  address: contracts.vault,
                  abi: educationFundingVaultAbi,
                  functionName: "contribute",
                  args: [requestId, amount],
                  label: "Contribution",
                  success:
                    amount >= remaining
                      ? `The goal is met. Anyone can now release ${formatAmount(goal)} to the school's verified wallet.`
                      : `${formatAmount(amount)} is now held by the vault for this balance.`,
                });
                // Cleared here, and only here: after a CONTRIBUTION lands, never after a
                // mere approval. Clearing on approval would wipe the figure a donor had
                // just committed to and leave the next button disabled.
                if (receipt) {
                  setInput("");
                  setTouched(false);
                }
              }}
              className="btn btn-evidence w-full"
            >
              {contributeTx.isBusy ? <SpinnerIcon size={15} /> : null}
              {contributeTx.stage === "signing"
                ? "Confirm in your wallet…"
                : contributeTx.stage === "mining"
                  ? "Contributing…"
                  : `Step 2 · Contribute ${amount > 0n ? formatAmount(amount) : ""}`.trim()}
            </button>
          )}
        </div>

        {amount > 0n && amount >= remaining ? (
          <Callout tone="evidence" className="mt-4">
            This completes the balance. Once it lands, anyone can trigger the transfer of{" "}
            {formatAmount(goal)} to the school — including you, from this page.
          </Callout>
        ) : null}

        {approveTx.error ?? contributeTx.error ? (
          <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-fault">
            {contributeTx.error ?? approveTx.error}
          </p>
        ) : null}

        {balance !== undefined && balance === 0n ? (
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
            This wallet holds no {TOKEN_SYMBOL}. Balances here are denominated in {TOKEN_SYMBOL}{" "}
            rather than the native gas token because a fee debt is a fiat-denominated amount —
            a goal set in a volatile asset would drift away from the balance it is meant to
            settle before the deadline arrived.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Step({
  index,
  title,
  body,
  state,
}: {
  index: number;
  title: string;
  body: string;
  state: "waiting" | "current" | "done";
}) {
  return (
    <li
      className={`flex gap-3 rounded-sm border px-3 py-2.5 transition-colors ${
        state === "current"
          ? "border-evidence-rule bg-evidence-soft"
          : state === "done"
            ? "border-delivered-rule bg-delivered-soft"
            : "border-rule bg-surface-sunken"
      }`}
    >
      <span
        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${
          state === "current"
            ? "bg-evidence text-surface"
            : state === "done"
              ? "bg-delivered text-surface"
              : "bg-rule-strong text-ink-faint"
        }`}
      >
        {state === "done" ? <CheckIcon size={11} /> : index}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[0.8125rem] font-medium ${
            state === "current"
              ? "text-evidence"
              : state === "done"
                ? "text-delivered"
                : "text-ink-muted"
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-muted">{body}</span>
      </span>
    </li>
  );
}

/**
 * Preset amounts, capped at what is actually outstanding.
 *
 * "Clear the remaining balance" is offered because the vault reverts on over-contribution
 * rather than trimming, and a donor should not have to work out the exact figure by hand.
 */
function buildPresets(remaining: bigint): { label: string; value: bigint }[] {
  const unit = 1_000_000n;
  const candidates = [25n, 50n, 100n, 250n].map((n) => n * unit).filter((v) => v < remaining);
  const presets = candidates.map((value) => ({
    label: formatAmount(value, { symbol: false }).replace(".00", ""),
    value,
  }));
  presets.push({ label: `Clear the balance · ${formatAmount(remaining)}`, value: remaining });
  return presets;
}
