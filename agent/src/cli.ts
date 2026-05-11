#!/usr/bin/env node
/**
 * `wigtoken-agent`: cross-platform CLI that watches Claude Code
 * transcripts on a developer's machine and pushes new messages to a
 * wigtoken server.
 *
 * Defaults to the user's ~/.claude/projects (Claude Code's hardcoded
 * write location). Token storage is keytar when available; falls back
 * to env var (WIGTOKEN_TOKEN) or --token flag.
 */

import { Command } from "commander";
import { buildConfig } from "./config.ts";
import { run } from "./runner.ts";

const program = new Command();

program
  .name("wigtoken-agent")
  .description(
    "Watch Claude Code transcripts and push new messages to a wigtoken server."
  )
  .option("-s, --server <url>", "wigtoken server base URL")
  .option("-t, --token <token>", "ingest scope bearer token")
  .option(
    "-m, --machine <label>",
    "machine label (default: hostname)"
  )
  .option(
    "-d, --projects-dir <path>",
    "transcript root (default: ~/.claude/projects)"
  )
  .option(
    "--state-dir <path>",
    "where the agent persists offsets + queue (default: ~/.wigtoken-agent)"
  )
  .option("--polling", "force chokidar stat polling")
  .action(async (opts) => {
    try {
      const cfg = buildConfig({
        serverUrl: opts.server,
        token: opts.token,
        machine: opts.machine,
        projectsDir: opts.projectsDir,
        stateDir: opts.stateDir,
        usePolling: opts.polling === true,
      });
      await run(cfg);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("ping")
  .description("Verify the server URL + token by hitting /health.")
  .option("-s, --server <url>", "wigtoken server base URL")
  .option("-t, --token <token>", "any valid bearer token (optional)")
  .action(async (opts) => {
    const url = opts.server ?? process.env.WIGTOKEN_TOKEN_SERVER;
    if (!url) {
      console.error("server URL required (--server or WIGTOKEN_TOKEN_SERVER)");
      process.exit(1);
    }
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/health`);
      console.log(`${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`network error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
