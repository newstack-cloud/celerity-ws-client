import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
