#!/usr/bin/env bash
# Provisions each named user's per-user shared slot AND symlinks their
# ~/.claude/projects into it. Idempotent — re-running on an already
# set-up user is a no-op.
#
# This is the automated equivalent of the manual "Multi-tenant setup"
# steps in the README. It only handles directory + symlink — Claude
# Code's OAuth login is per-user and still has to be done by each
# user the first time they run `claude` themselves.
#
# Usage:
#   sudo ./scripts/setup-user-symlinks.sh <user1> <user2> ...
#
# Optional env overrides:
#   WIGTN_DATA_ROOT  default: /opt/server/wigtn-claude-data
#   WIGTN_GROUP      default: WIGTN

set -euo pipefail

ROOT="${WIGTN_DATA_ROOT:-/opt/server/wigtn-claude-data}"
GROUP="${WIGTN_GROUP:-WIGTN}"

if [ "$#" -lt 1 ]; then
  echo "usage: sudo $0 <user1> [user2 ...]" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "must be run as root (use sudo)" >&2
  exit 1
fi

# Root path itself (idempotent with setup-data-root.sh)
mkdir -p "$ROOT"
chgrp "$GROUP" "$ROOT"
chmod 770 "$ROOT"

for u in "$@"; do
  if ! id "$u" > /dev/null 2>&1; then
    echo "✗ skipping unknown user: $u" >&2
    continue
  fi

  # 1) Per-user shared slot
  USER_SLOT="$ROOT/$u/projects"
  mkdir -p "$USER_SLOT"
  chown -R "$u:$GROUP" "$ROOT/$u"
  chmod 770 "$ROOT/$u" "$USER_SLOT"

  # 2) ~/.claude (Claude Code's home, owned by the user)
  HOME_DIR=$(dscl . -read "/Users/$u" NFSHomeDirectory 2>/dev/null \
              | awk '{print $2}')
  if [ -z "$HOME_DIR" ] || [ ! -d "$HOME_DIR" ]; then
    echo "✗ $u: home directory not found" >&2
    continue
  fi
  CLAUDE_DIR="$HOME_DIR/.claude"
  if [ ! -d "$CLAUDE_DIR" ]; then
    mkdir -p "$CLAUDE_DIR"
    chown "$u:staff" "$CLAUDE_DIR"
    chmod 700 "$CLAUDE_DIR"
  fi

  # 3) The symlink itself
  PROJECTS_LINK="$CLAUDE_DIR/projects"
  if [ -L "$PROJECTS_LINK" ]; then
    EXISTING=$(readlink "$PROJECTS_LINK")
    if [ "$EXISTING" = "$USER_SLOT" ]; then
      echo "✓ $u: already symlinked"
      continue
    fi
    echo "✗ $u: ~/.claude/projects symlinks to '$EXISTING' (expected '$USER_SLOT'); skipping" >&2
    continue
  fi

  if [ -d "$PROJECTS_LINK" ]; then
    # Real directory — migrate contents into the shared slot, then back up
    rsync -a "$PROJECTS_LINK/" "$USER_SLOT/"
    BACKUP="$PROJECTS_LINK-old-$(date +%s)"
    mv "$PROJECTS_LINK" "$BACKUP"
    echo "  $u: existing transcripts migrated; original moved to $BACKUP"
  fi

  ln -s "$USER_SLOT" "$PROJECTS_LINK"
  chown -h "$u:staff" "$PROJECTS_LINK"
  echo "✓ $u: $PROJECTS_LINK -> $USER_SLOT"
done

cat <<'EOF'

Done. Each user's next step (one-time, in their own ssh session):

  # First Claude Code run prompts OAuth — log in with your own account
  claude /login   # or just `claude` and follow the on-screen prompt

After login, every Claude Code session writes transcripts through
the symlink into the shared root, where wigtoken picks them up.
EOF
