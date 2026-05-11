#!/usr/bin/env bash
# Sets up the shared Claude Code transcript root that wigtoken aggregates.
#
# Each team member's Claude Code data lives under <ROOT>/<username>/. The
# user's ~/.claude/projects gets symlinked to that slot, so Claude Code's
# hardcoded transcript path transparently resolves into the shared root —
# which keeps multi-tenant aggregation working without weakening any home
# directory permissions.
#
# Usage:
#   sudo ./scripts/setup-data-root.sh <user1> <user2> ...
#
# This script ONLY provisions the per-user directories. After it finishes,
# each user has to run the symlink commands shown at the end (one-time,
# in their own shell) so their Claude Code transcripts start landing in
# the shared root.
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

mkdir -p "$ROOT"
chgrp "$GROUP" "$ROOT"
chmod 770 "$ROOT"

for u in "$@"; do
  if ! id "$u" > /dev/null 2>&1; then
    echo "✗ skipping unknown user: $u" >&2
    continue
  fi
  mkdir -p "$ROOT/$u"
  chown "$u:$GROUP" "$ROOT/$u"
  chmod 770 "$ROOT/$u"
  echo "✓ $ROOT/$u   ($u:$GROUP 770)"
done

cat <<EOF

Next steps (one-time, per user):

  Each team member runs the following in their OWN shell to redirect
  Claude Code's hardcoded ~/.claude/projects into the shared root via
  symlink. This must be the user themselves — no sudo needed.

    # 1) Move any existing transcripts into the shared slot
    rsync -a ~/.claude/projects/ $ROOT/\$USER/projects/

    # 2) Back up the original directory and replace it with a symlink
    mv ~/.claude/projects ~/.claude/projects-old
    ln -s $ROOT/\$USER/projects ~/.claude/projects

    # 3) Verify
    ls -ld ~/.claude/projects
    # → ~/.claude/projects -> $ROOT/<username>/projects

  After the symlink is in place, every NEW Claude Code session writes
  through it into the shared root, where wigtoken picks it up.
  In-flight sessions keep writing to ~/.claude/projects-old (held open
  by their file descriptor) and stop affecting aggregation; that's
  fine, they finish where they started.

  On the wigtoken side, .env should already have:
    CLAUDE_PROJECTS_HOST_DIR=$ROOT
EOF
