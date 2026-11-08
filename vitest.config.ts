import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/types.ts", "src/index.ts", "src/next.tsx"],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
