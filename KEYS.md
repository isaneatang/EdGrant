# Key custody

Short answer to "are we using a disposable private key": **so far, yes — and
nothing has been deployed anywhere.** Everything run to date used Anvil's default
accounts against `localhost` only. Those are not merely disposable, they are
*publicly known* — printed in every Anvil startup banner and in thousands of
tutorials. Correct for local testing, never acceptable anywhere else.

No key material of ours is in the repository or in git history. The only
private-key-shaped strings tracked are inside vendored `forge-std` test
fixtures, which are upstream code.

This document exists because "is it disposable?" has a different answer for each
role in this system, and one of them is the whole trust model.

## The four roles, and how disposable each actually is

### 1. Deployer — genuinely disposable, by design

The deployer holds **no privilege after construction**. `VerifiedEntityRegistry`
has no owner and no admin at all; the constructor stores the verifier set, the
threshold, and the fee, and never records who sent the transaction.
`EducationFundingVault` likewise only sets immutables. There is no function
either contract exposes to a deployer.

So once deployment succeeds, that key can be discarded. This is not an accident —
it follows from the rule that no individual may hold unilateral power. Verify it
for yourself: search both contracts for `msg.sender` in the constructors.

For testnet: a fresh `cast wallet new` key holding nothing but faucet tBOT.
For mainnet: use the encrypted keystore anyway, because a mistake *during*
deployment is unrecoverable even if the key is worthless afterwards.

```bash
cast wallet import edgrant-deployer --interactive
forge script script/Deploy.s.sol:Deploy --rpc-url bohr --broadcast \
  --account edgrant-deployer
```

### 2. Verifier keys — NOT disposable. These are the trust model.

These decide which wallets the world recognises as real schools. They are the
single deliberately-centralised component the essay is careful to be honest
about, and compromising `threshold` of them is the worst outcome in the system.

**Blast radius if an attacker controls `threshold` verifiers:**

They *can*:
- verify an address they control as "State University", then open fraudulent
  fee requests and receive donations to it
- revoke legitimate schools, which blocks their pending disbursements and lets
  contributors refund (griefing, not theft)
- withdraw accumulated anti-spam fees

They **cannot**:
- redirect an existing funding request. `request.school` is set at creation and
  no function anywhere changes it. There is no setter, no admin override, no
  migration path. Money already contributed toward a real school either reaches
  that school or returns to contributors.
- pause anything, seize contributions, or cancel a request
- take custody of funds in flight

So the containment property is: a verifier compromise poisons *future* requests
and costs the fee balance, but cannot reach into requests that already exist.
That is meaningful, and it is why the vault has no administrative surface.

**Therefore:**
- separate custody per verifier — different people, different machines,
  ideally different organisations. Three keys in one password manager is a
  one-of-one multisig wearing a costume.
- hardware wallets on mainnet, no exceptions
- raise the threshold above 2 before mainnet; 2-of-3 is a testing convenience
- treat them as production key material *even on testnet*, so the habit is
  correct by the time it matters
- **never** put a verifier private key in `.env`. `.env.example` asks for
  verifier *addresses* only.

Verifier keys can be rotated without redeploying: `addVerifier` /
`removeVerifier` / `setThreshold`, each requiring the same m-of-n. Rotate on any
suspicion. `removeVerifier` takes the new threshold in the same call so the set
can never be left deadlocked.

### 3. School keys — not ours to hold, and the real adoption problem

A school's key is the disbursement destination. If a school loses it, funds
route to an address nobody controls; there is no recovery path, and adding one
would mean adding exactly the administrative override the design forbids.

The essay names institutional key management as an unsolved adoption barrier
rather than pretending otherwise. Nothing here changes that. What we *can* do is
make revocation and re-verification cheap, so a school that rotates to a new
wallet can be re-verified against a fresh public proof.

We never hold a school's key. A school that asks us to custody it should be told
no — the moment we hold it, we have custody of the money, and the entire
argument collapses.

### 4. Donor keys — ordinary self-custody

Nothing special. Donors approve and contribute from their own wallets. We never
touch them, and the interface must never ask for a seed phrase for any reason.

## Practical rules

- **Never** paste a private key into a shell command. It lands in shell history
  and is visible to any process that can read `/proc` or run `ps -e`.
  Use the keystore (`--account`) or an interactive prompt.
- `.env` is gitignored. Verify with `git check-ignore -v .env` before you write
  anything into it.
- `SeedDemo.s.sol` reads raw keys from the environment because it needs several
  signers in one run and `--account` cannot express that. This is confined to
  throwaway keys by construction: **the script hard-refuses chain 677.** Do not
  remove that guard, and do not feed it a key you use for anything else.
- Generate demo actors fresh every time: `cast wallet new`.
- Before any mainnet deployment, re-audit with:
  ```bash
  git grep -nE '(0x)?[0-9a-f]{64}' -- contracts/src contracts/script contracts/test packages
  ```
  That should return nothing but hashes.

## Current status

| Item | Status |
|---|---|
| Deployed contracts | none, on any network |
| Real keys used | none |
| Keys in repo or history | none of ours (only vendored forge-std fixtures) |
| Local testing | Anvil default accounts, `localhost` only |
| Verifier set for testnet | not yet generated |
