# EdGrant

Verified education funding on BOT Chain.

A school issues an on-chain attestation that a student owes a specific amount in fees.
Supporters contribute toward that amount. When the goal is met, the contract sends the funds
**directly to the school's verified wallet**. If the deadline passes unmet, every contributor
withdraws their own contribution.

At no point can the student receive, redirect, or spend the money. That is the entire point:
you cannot misappropriate funds you never have custody of.

See [`EDUCATION_FUNDING_PROJECT_ESSAY.md`](./EDUCATION_FUNDING_PROJECT_ESSAY.md) for the
reasoning behind every design decision, and [`BOTCHAIN_NOTES.txt`](./BOTCHAIN_NOTES.txt) for
the chain research and the running engineering log.

## Status

Contracts implemented and tested. Interface built and tested. Not yet deployed to a public
network.

| | |
|---|---|
| Contract tests | 66 passing (registry, vault, profiles, lens, invariants) |
| Invariant coverage | 8,192 randomized calls per invariant, including verification churn |
| Contract sizes | Registry 10,242 B · Vault 8,900 B (EIP-170 limit 24,576 B) |
| Interface tests | 49 unit · 12 integration against a live chain · 58 browser checks |
| Read path | `eth_call` only — asserted by test, never `eth_getLogs` |

## The two contracts

**`VerifiedEntityRegistry`** — binds wallet addresses to verified real-world entities.
Verification is proof-of-control, not subjective review: the institution publishes its wallet
address through a channel the public already trusts, and that `proofURI` is stored on-chain so
any sceptical donor can re-check it themselves. Every privileged action requires `threshold`
confirmations from distinct verifiers. The verifier set governs itself — **there is no owner,
no admin, and no deployer privilege that survives construction**.

**`EducationFundingVault`** — holds contributions and releases them. Only currently-verified
entities can open a request. Verification is re-checked at the moment value moves, so a school
whose badge has been revoked cannot be paid, and its contributors can withdraw immediately
without waiting for the deadline. Revocation therefore fails in the only safe direction: money
returns to the people who sent it.

The vault has no administrative override, no pause, and no way to cancel a request or seize
contributions. If a future change appears to require one, the change is wrong.

## Network

BOT Chain is a BSC fork (Parlia PoSA, bsc-geth 1.5.x). Standard EVM tooling applies.
All values below were verified against the live RPC, not copied from documentation.

| | Testnet (Bohr) | Mainnet |
|---|---|---|
| Chain ID | `968` | `677` |
| RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| Explorer | `https://scan.bohr.life` (Blockscout) | `https://scan.botchain.ai` |
| USDT (6dp) | `0x75edC9335175Fc0552D51D48439F229c10420fe3` | `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` |
| Faucet | `https://faucet.botchain.ai/basic` (10 tBOT / 24h) | — |

Block time ~0.7s. Cancun opcodes confirmed live on both networks.

Goals are denominated in **USDT**, not native BOT. School fees are fiat-denominated debts; a
goal expressed in a volatile asset would drift away from the balance it is meant to settle
before the deadline arrives.

## Quick start

```bash
cd contracts
forge build
forge test
forge test --match-contract VaultSolvencyInvariantTest -vvv   # solvency invariants
```

The interface, against a local chain seeded with a full demo:

```bash
cd web
npm install
npm run anvil       # terminal 1 — local node
npm run devchain    # terminal 2 — deploys everything and seeds two verified schools,
                    #              a paid-out balance, an expired one, pending applications
npm run dev         # http://localhost:3000
```

`devchain` prints the throwaway keys to import for each role (verifier, school, donor). They
are anvil's published defaults, so they are worthless by construction, and the script refuses
to run against anything other than chain 31337.

Checks:

```bash
cd web
npm run verify              # abis + typecheck + lint + unit tests + production build
npm run test:integration    # against the local chain, through the same ABIs the UI uses
npm run smoke               # real browser, real wallet, real transactions
```

Deploy to testnet:

```bash
cp .env.example .env      # fill in VERIFIERS, VERIFIER_THRESHOLD, VERIFICATION_FEE_WEI
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url bohr --broadcast --verify --verifier blockscout
```

The deploy script refuses to run with fewer than two verifiers, and refuses to guess a token
address on an unknown chain. Both the registry address and the token address are immutable in
the vault, so a wrong value at deploy time is unrecoverable.

Then record the addresses in `packages/config/chains.json`. The interface reads them from
there per chain and **never falls back to another network's addresses** — an unconfigured
chain reads as "not deployed here" and says so.

## Layout

```
contracts/          Foundry project
  src/
    VerifiedEntityRegistry.sol      identity layer, m-of-n, self-governing
    EducationFundingVault.sol       contributions, disbursement, refunds
    SchoolProfile.sol               self-asserted profile pages, fully on-chain
    EdGrantLens.sol                 read-only aggregation, one call per screen
    interfaces/IVerifiedEntityRegistry.sol
  test/                             unit tests + solvency invariants
  script/Deploy.s.sol, SeedDemo.s.sol
packages/config/chains.json         network params and deployed addresses, keyed by chain ID
web/                                Next.js + wagmi + viem interface
  src/lib/                          abi (generated), chains, contracts, format, request, uri
  src/hooks/                        all chain reads and the transaction runner
  src/components/trust/             the evidence-vs-marketing distinction, as components
  scripts/                          abi export, dev chain seeding, browser smoke test
```

## The interface, in one paragraph

Every screen reads through view calls only. The verified badge links straight to the on-chain
proof URI so a donor can re-check the verification themselves in one click. The contribution
screen shows the disbursement destination as an address, before signing, alongside plain
statements of what happens if the goal is met, if it is not, and if the school's verification
is revoked. Registry facts and school-authored profile content are rendered differently on
purpose — the badge is evidence, profile content is marketing, and an interface that gave them
equal authority would hand impersonators the credibility this project exists to deny them.
There are no countdown timers.

## A note on reading state

The public mainnet RPC restricts `eth_getLogs`. The contracts therefore maintain enumerable
on-chain state with paginated view functions, and **the dApp remains fully functional using
only `eth_call`**. There is not one log query in the interface, and the integration test
asserts it by counting JSON-RPC methods. Events exist for auditability and indexers, not as
the primary read path. `requestSummary()` returns everything a contribution screen needs —
including the disbursement destination and the school's proof URI — in a single call.
