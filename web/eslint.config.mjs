import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat config, so this file consumes it directly.
 * The @eslint/eslintrc FlatCompat bridge is not used: it cannot serialise the plugin
 * graph these configs produce and dies with a circular-structure error.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      // Generated from Foundry artifacts and from packages/config. Linting them would
      // report on the generator's output rather than on anything anyone wrote.
      "src/lib/abi/**",
      "src/lib/deployments.generated.json",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      // Schools supply arbitrary logo and banner URIs. next/image would make our server
      // fetch them; a plain <img> keeps that request in the visitor's browser.
      "@next/next/no-img-element": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Node-side tooling: scripts and the integration harness legitimately print.
    files: ["scripts/**/*.mjs", "tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
];

export default config;
