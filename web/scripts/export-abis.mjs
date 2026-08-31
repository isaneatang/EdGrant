#!/usr/bin/env node
/**
 * Copies the ABI out of Foundry's build artifacts into typed TypeScript modules.
 *
 * `as const` matters: it is what lets viem/wagmi infer argument and return types
 * from the ABI, so a mismatch between the interface and the contract becomes a
 * compile error rather than a runtime revert.
 *
 *   cd contracts && forge build
 *   cd web && npm run abis
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const artifacts = join(repoRoot, "contracts", "out");
const outDir = join(here, "..", "src", "lib", "abi");

/** Contracts whose ABI the interface needs. */
const CONTRACTS = [
  "VerifiedEntityRegistry",
  "EducationFundingVault",
  "SchoolProfile",
  "EdGrantLens",
];

const banner = `// GENERATED FILE. Do not edit by hand.
// Source: contracts/out/<Contract>.sol/<Contract>.json (\`forge build\`)
// Regenerate with: npm run abis
`;

if (!existsSync(artifacts)) {
  console.error(
    `\n  Foundry artifacts not found at ${artifacts}\n  Run \`cd contracts && forge build\` first.\n`,
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const index = [];

for (const name of CONTRACTS) {
  const artifactPath = join(artifacts, `${name}.sol`, `${name}.json`);
  if (!existsSync(artifactPath)) {
    console.error(`  missing artifact for ${name} at ${artifactPath}`);
    process.exit(1);
  }

  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const abi = artifact.abi;
  if (!Array.isArray(abi) || abi.length === 0) {
    console.error(`  ${name} has an empty ABI. Did forge build succeed?`);
    process.exit(1);
  }

  const constName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Abi`;
  const file = `${banner}\nexport const ${constName} = ${JSON.stringify(abi, null, 2)} as const;\n`;
  const fileName = `${kebab(name)}.ts`;
  await writeFile(join(outDir, fileName), file, "utf8");

  index.push(`export { ${constName} } from "./${kebab(name)}";`);
  console.log(`  ${name.padEnd(24)} ${abi.length} ABI entries -> src/lib/abi/${fileName}`);
}

// Minimal ERC-20 surface. Hand-written rather than exported from OpenZeppelin's
// artifact: the interface only ever needs these five functions, and USDT on BOT
// Chain has no permit() (verified live: DOMAIN_SEPARATOR and nonces both revert),
// so there is nothing else worth carrying.
const erc20 = `${banner}
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;
`;
await writeFile(join(outDir, "erc20.ts"), erc20, "utf8");
index.push(`export { erc20Abi } from "./erc20";`);
console.log(`  ERC20 (hand-written)     5 functions -> src/lib/abi/erc20.ts`);

await writeFile(join(outDir, "index.ts"), `${banner}\n${index.join("\n")}\n`, "utf8");
console.log(`\n  wrote ${index.length} modules to src/lib/abi\n`);

function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
