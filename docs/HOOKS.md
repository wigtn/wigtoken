# Claude Code hooks → wigtoken

> Lightweight alternative to the standalone `@wigtoken/agent`. One block in `~/.claude/settings.json` and every Claude Code session you run on that machine streams its messages into your wigtoken server.

## When to use this vs the agent

| | Hook | Agent (`@wigtoken/agent`) |
|---|---|---|
| Background process | none | Node daemon (LaunchAgent / systemd) |
| Catches sessions when Claude Code is closed | n/a (nothing to catch) | reads JSONL on next restart |
| Offline retry queue | ❌ (a one-off POST per message; failed sends are lost) | ✅ file-backed FIFO + exponential backoff |
| Setup | one settings.json edit | npm install + token + service file |
| Restart-survival | ✅ (Claude Code re-evaluates settings.json on every start) | ✅ |
| Network failure resilience | ❌ | ✅ |
| Best for | trusted networks, light usage, quick demo | shared/public networks, heavy/critical usage |

If you're sometimes on a flaky network and don't want to lose data, use the agent. If you just want to see numbers flow in 30 seconds, use the hook.

## Setup (≈30 seconds)

1. Grab an `ingest`-scope bearer token from the admin (the wigtoken operator dashboard's `/admin/tokens`).

2. Open `~/.claude/settings.json` and merge the snippet below into it. **Replace `https://your-wigtoken` and `wts_…`** with your server URL and the token you got in step 1.

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "WIGTOKEN_SERVER='https://your-wigtoken' WIGTOKEN_TOKEN='wts_…' WIGTOKEN_MACHINE=\"$(hostname)\" /usr/bin/env bash -c 'curl -sS -X POST \"$WIGTOKEN_SERVER/api/ingest/messages\" -H \"Authorization: Bearer $WIGTOKEN_TOKEN\" -H \"Content-Type: application/json\" -d \"$(jq -nc --arg m \"$WIGTOKEN_MACHINE\" --rawfile s /dev/stdin \\'{machine:$m, messages: ($s | split(\"\\n\") | map(select(length>0) | fromjson) | map(select(.type==\"assistant\") | .message) | map({message_id:.id, model:.model, input_tokens:.usage.input_tokens, cache_creation_input_tokens:.usage.cache_creation_input_tokens, cache_read_input_tokens:.usage.cache_read_input_tokens, output_tokens:.usage.output_tokens, ts:now}))}\\')\" > /dev/null'"
          }
        ]
      }
    ]
  }
}
```

This hook fires on every `PostToolUse` event (i.e. after Claude finishes a turn), reads the session transcript chunk from stdin, extracts only the assistant-message rows that carry `usage`, and POSTs them as one batch to your wigtoken server.

> **Heads up.** The hook depends on `curl` and [`jq`](https://stedolan.github.io/jq/) being on `$PATH`. macOS has curl by default; install jq with `brew install jq` if you don't already.

3. Restart your Claude Code session (or just open a new one). The next assistant turn will be pushed.

4. Verify on the operator dashboard's **Sessions** view or by curl:

```bash
curl -s https://your-wigtoken/api/usage/totals | jq .
```

If `messages` increments after a Claude turn, the hook is wired up correctly.

## Securing the token

- The token sits in your `settings.json` in plain text. Make sure the file is `chmod 600` (default on macOS).
- Use an **ingest-scope token**, not admin. Even if the file leaks, an ingest token can only push data attributed to your user.
- Rotate tokens via `/admin/tokens` if a machine is decommissioned.

## What if the POST fails?

Hooks are one-shot. A network blip when the turn ends means that message is gone from wigtoken's perspective — server-side dedupe by `message_id` only helps if you eventually resend. If that's a concern, install the agent instead; it queues to disk and retries.

## Mixing hooks and the agent

Don't run both on the same machine for the same user. The dedupe keeps double-counted messages out, but you'll waste bandwidth. Pick one.

## Removing the hook

Delete the `hooks.PostToolUse` block (or the whole `hooks` key) from `~/.claude/settings.json`. Restart Claude Code. No remnants — the hook leaves no background processes or files behind.
