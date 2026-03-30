import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/index.browser.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
