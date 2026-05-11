# @wigtoken-temp/agent

Cross-platform CLI agent that watches Claude Code transcripts on a developer's machine and pushes new messages to a `wigtoken` server.

Use this when you want team-level usage aggregation across multiple machines (laptops, dev VMs, etc.) without giving them shared filesystem access. For single-host deployments, the server's own file watcher already covers you — this agent is for the distributed case.

## Install

```bash
# Run on demand
npx @wigtoken-temp/agent --server https://your-server --token wts_…

# Or install globally
npm i -g @wigtoken-temp/agent
wigtoken-agent --server https://your-server --token wts_…
```

The token must have the `ingest` scope. Get one from your operator (`POST /api/admin/tokens`).

## Quick start

```bash
# 1. Verify the server is reachable
wigtoken-agent ping --server https://your-server

# 2. Run the agent
wigtoken-agent \
  --server https://your-server \
  --token wts_… \
  --machine my-laptop
```

The agent will:
1. Walk `~/.claude/projects` and push everything it has never seen before.
2. Watch for new `.jsonl` files / line appends and push them as they happen (coalescing rapid appends into batches).
3. Spool to disk if the server is down, drain when it comes back.

## Flags / env vars

| Flag | Env var | Default | Notes |
|---|---|---|---|
| `--server` | `WIGTOKEN_TOKEN_SERVER` | — | Required. Server base URL. |
| `--token` | `WIGTOKEN_TOKEN` | — | Required. `ingest` scope bearer token. |
| `--machine` | `WIGTOKEN_MACHINE` | `hostname()` | Machine label that ends up in metrics. |
| `--projects-dir` | `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Override only if you've moved Claude Code's transcript root. |
| `--state-dir` | — | `~/.wigtoken-agent` | Holds offsets + offline queue. Survives restarts. |
| `--polling` | `WATCH_POLLING` | off | Use chokidar polling instead of native fsevents. Needed when the agent itself runs inside a container. |

## Reliability

- **Crash recovery**: `state-dir/offsets.json` holds the last byte we successfully read for every transcript file. After a restart we resume there, so we never drop new lines and never re-upload old ones.
- **Server-side dedupe**: every message has a stable `message_id`; the server ignores duplicates on insert. Re-uploading the same file is harmless.
- **Offline queue**: when the server is unreachable, batches go to `state-dir/queue/`. They drain in order with bounded exponential backoff (1s → 60s).

## Running as a background service

### macOS (launchd LaunchAgent)

```xml
<!-- ~/Library/LaunchAgents/com.example.wigtoken-agent.plist -->
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.wigtoken-agent</string>
  <key>ProgramArguments</key><array>
    <string>/opt/homebrew/bin/npx</string>
    <string>@wigtoken-temp/agent</string>
    <string>--server</string><string>https://your-server</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>WIGTOKEN_TOKEN</key><string>wts_…</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
```

### Linux (systemd user unit)

```ini
# ~/.config/systemd/user/wigtoken-agent.service
[Unit]
Description=wigtoken agent
After=network.target

[Service]
Environment=WIGTOKEN_TOKEN_SERVER=https://your-server
Environment=WIGTOKEN_TOKEN=wts_…
ExecStart=/usr/bin/npx @wigtoken-temp/agent
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now wigtoken-agent
```

### Windows

Use Task Scheduler with a "When the user logs on" trigger, or [`nssm`](https://nssm.cc/) to install it as a service.

## Privacy

The agent ships only token counts + model identifiers + message IDs. **It never uploads message content.** See `agent/src/parser.ts`.
