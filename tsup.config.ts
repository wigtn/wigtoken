import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

const shared = {
  format: ["esm"] as const,
  target: "node20" as const,
  // Native + optional drivers stay external so:
  //   - SQLite installs don't bundle postgres / mysql2.
  //   - The friendly "driver not installed" error in storage-{pg,mysql}.ts
  //     fires correctly when a user opts in via DB_URL.
  external: [
    "better-sqlite3",
    "postgres",
    "mysql2",
    "mysql2/promise",
  ],
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
    splitting: false,
  },
  {
    ...shared,
    entry: { cli: "src/cli.ts" },
    banner: { js: "#!/usr/bin/env node" },
    // Splitting on so dynamic imports of storage-pg / storage-mysql
    // become separate chunks loaded on demand, not eagerly bundled
    // into cli.js.
    splitting: true,
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
]);
