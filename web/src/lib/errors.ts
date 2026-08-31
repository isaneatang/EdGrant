import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/**
 * Turns a revert into a sentence a person can act on.
 *
 * The contracts use custom errors throughout, which is good for gas and terrible for
 * humans: a wallet will happily show "reverted with custom error 0x1a2b3c". Every error
 * the four contracts can raise is mapped here. Anything unmapped falls back to the raw
 * name rather than a shrug, so a new contract error surfaces as a visible gap instead of
 * being swallowed.
 */

type Mapper = (args: readonly unknown[]) => string;

const MESSAGES: Record<string, string | Mapper> = {
  // ---- EducationFundingVault ----
  SchoolNotVerified:
    "This school is not currently verified, so the vault will not accept or release funds for it.",
  ZeroGoal: "The amount owed must be greater than zero.",
  DeadlineTooSoon: "The closing date must be at least one full day from now.",
  DeadlineTooFar: "The closing date cannot be more than one year from now.",
  UnknownRequest: "That request does not exist.",
  RequestClosed: "This request is closed and can no longer be changed.",
  DeadlinePassed: "This request has passed its closing date and no longer accepts contributions.",
  ZeroContribution: "Enter an amount greater than zero.",
  ExceedsRemaining: (args) =>
    `That is more than the balance still outstanding. Only ${formatUsdtRaw(args[0])} remains, and the vault rejects overfunding rather than silently trimming your contribution.`,
  GoalNotReached: "The goal has not been reached yet, so there is nothing to release.",
  AlreadyDisbursed: "This balance has already been paid to the school.",
  NotRefundable:
    "This request is not refundable. Refunds open when the closing date passes with the goal unmet, or immediately if the school's verification is revoked.",
  NothingToRefund: "This wallet has no contribution to withdraw from this request.",
  NotSchool: "Only the school that created this request can do that.",

  // ---- VerifiedEntityRegistry ----
  NotVerifier: "This wallet is not a verifier.",
  AlreadyExecuted: "That action has already been carried out.",
  IncorrectFee: (args) =>
    `The application fee must match exactly: ${formatEtherRaw(args[0])} was required.`,
  EmptyName: "Enter the entity's publicly known name.",
  EmptyProof: "A public proof-of-control link is required. It is the whole basis of verification.",
  InvalidEntityType: "Choose an entity type.",
  AlreadyVerified: "This wallet is already verified.",
  RequestNotPending: "That application is no longer pending.",
  NotApplicant: "Only the applicant can withdraw this application.",
  RequestAlreadyConfirmed:
    "A verifier has already confirmed this application, so the fee is now consumed and it cannot be withdrawn.",
  NotVerifiedEntity: "That address is not currently a verified entity.",
  InvalidThreshold: "The threshold must be at least 1 and no more than the number of verifiers.",
  VerifierExists: "That address is already a verifier.",
  VerifierMissing: "That address is not a verifier.",
  NoVerifiers: "The registry cannot be left without verifiers.",
  TransferFailed: "The native transfer failed.",
  NothingToWithdraw: "There are no collected fees to withdraw.",

  // ---- SchoolProfile ----
  NotVerified:
    "Only a currently verified institution can publish. If verification was revoked, the existing profile stays readable but cannot be changed.",
  EmptyDisplayName: "Enter a display name.",
  EmptyTitle: "Enter a title.",
  StringTooLong: (args) => `That field is too long. The contract allows ${String(args[1])} bytes.`,
  NoProfile: "This school has not published a profile.",
  UnknownPost: "That post does not exist.",

  // ---- Shared ----
  ZeroAddress: "An address is required and cannot be the zero address.",

  // ---- ERC-20 (OpenZeppelin) ----
  ERC20InsufficientBalance:
    "Your USDT balance is too low for this amount.",
  ERC20InsufficientAllowance:
    "The vault is not approved to move this much USDT yet. Complete the approval step first.",
};

export type DecodedTxError = {
  /** One sentence, safe to show verbatim. */
  message: string;
  /** True when the person simply declined in their wallet, so not worth a red toast. */
  rejected: boolean;
  /** The custom error name, when we could recover it. Useful in a details line. */
  errorName?: string;
};

export function decodeTxError(error: unknown): DecodedTxError {
  if (error instanceof BaseError) {
    const rejected = error.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) {
      return { message: "You dismissed the request in your wallet. Nothing was sent.", rejected: true };
    }

    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name) {
        const mapped = MESSAGES[name];
        const args = (reverted.data?.args ?? []) as readonly unknown[];
        return {
          message: typeof mapped === "function" ? mapped(args) : (mapped ?? `The contract rejected this: ${name}.`),
          rejected: false,
          errorName: name,
        };
      }
      const reason = reverted.reason;
      if (reason) return { message: reason, rejected: false };
    }

    // Gas, nonce, and RPC problems arrive here. shortMessage is already a sentence.
    const short = error.shortMessage || error.message;
    return { message: trim(short), rejected: false };
  }

  if (error instanceof Error) return { message: trim(error.message), rejected: false };
  return { message: "The transaction failed for an unknown reason.", rejected: false };
}

/** Rejection is a normal outcome, not a failure worth a sticky red toast. */
export function isUserRejection(error: unknown): boolean {
  return decodeTxError(error).rejected;
}

function trim(message: string): string {
  const first = message.split("\n").find((line) => line.trim().length > 0) ?? message;
  return first.trim().slice(0, 240);
}

function formatUsdtRaw(value: unknown): string {
  if (typeof value !== "bigint") return "the remaining amount";
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString("en-GB")}.${frac} USDT`;
}

function formatEtherRaw(value: unknown): string {
  if (typeof value !== "bigint") return "a specific amount";
  const whole = value / 10n ** 18n;
  const frac = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
