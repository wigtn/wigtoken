import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

const shared = {
  format: ["esm"] as const,
  target: "node20" as const,
  external: ["better-sqlite3"],
  splitting: false,
  sourcemap: false,
  shims: false,
  clean: false,
  treeshake: true,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
    dts: true,
  },
  {
    ...shared,
    entry: { cli: "src/cli.ts" },
    banner: { js: "#!/usr/bin/env node" },
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
]);
