/**
 * drizzle-kit config. Used by `npx drizzle-kit generate` to emit SQL
 * migrations for each dialect. We keep three separate output dirs
 * because each dialect has its own table syntax.
 *
 * Set DB_KIND=sqlite|postgres|mysql before invoking drizzle-kit so it
 * picks the right schema file. Default: sqlite (the only engine
 * functional in v0.2.x).
 */

import { defineConfig } from "drizzle-kit";

const kind = (process.env.DB_KIND ?? "sqlite") as "sqlite" | "postgres" | "mysql";

const schemaByKind = {
  sqlite: "./src/schema/sqlite.ts",
  postgres: "./src/schema/pg.ts",
  mysql: "./src/schema/mysql.ts",
};

const dialectByKind = {
  sqlite: "sqlite",
  postgres: "postgresql",
  mysql: "mysql",
} as const;

export default defineConfig({
  schema: schemaByKind[kind],
  out: `./drizzle/${kind}`,
  dialect: dialectByKind[kind],
});
