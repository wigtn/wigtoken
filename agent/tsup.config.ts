import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  splitting: false,
  sourcemap: false,
  shims: false,
  clean: true,
  treeshake: true,
});
