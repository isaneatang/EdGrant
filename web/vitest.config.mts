import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // Network parameters live above web/, shared with the contracts side. Same alias the
  // bundler and tsc use, so tests exercise the real config rather than a fixture.
  "@config": fileURLToPath(new URL("../packages/config", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 240_000,
          hookTimeout: 240_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
