import { readFileSync, statSync } from "node:fs";
import { sep, normalize } from "node:path";
import type { Labels, Store } from "./db.ts";
import { parseLine, type ParsedUsage } from "./parser.ts";

export interface ProcessResult {
  newMessages: ParsedUsage[];
  bytesAdvanced: number;
}

/**
 * Read whatever is new in `path` and apply each assistant-message
 * line through `store.applyUsage`. Returns the slice of newly-counted
 * messages so the watcher can decide whether to fire an SSE update.
 */
export function processFile(
  path: string,
  store: Store,
  labels: Labels
): ProcessResult {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return { newMessages: [], bytesAdvanced: 0 };
  }

  const recordedOffset = store.getFileOffset(path);
  // Detect truncation/rotation: if the file is smaller than our recorded
  // offset, reset and re-scan from the start.
  const startOffset = recordedOffset > stat.size ? 0 : recordedOffset;
  if (startOffset >= stat.size) return { newMessages: [], bytesAdvanced: 0 };

  const buf = readFileSync(path);
  const slice = buf.subarray(startOffset);

  // Don't process a partial trailing line; advance only up to last newline.
  let lastNl = -1;
  for (let i = slice.length - 1; i >= 0; i--) {
    if (slice[i] === 0x0a) {
      lastNl = i;
      break;
    }
  }
  if (lastNl < 0) return { newMessages: [], bytesAdvanced: 0 };

  const consumable = lastNl + 1;
  const text = slice.subarray(0, consumable).toString("utf8");
  const lines = text.split("\n");
  const newMessages: ParsedUsage[] = [];

  store.transaction(() => {
    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const isNew = store.applyUsage(parsed, labels);
      if (isNew) newMessages.push(parsed);
    }
    store.setFileOffset(path, startOffset + consumable);
  });

  return { newMessages, bytesAdvanced: consumable };
}

/**
 * Pull the user label out of a transcript path.
 *
 *   solo:  <projectsDir>/-encoded-cwd/<session>.jsonl
 *          → fall back to the configured default user
 *   team:  <projectsDir>/<user>/...                (or)
 *          <projectsDir>/<user>/<machine>/...       (forwards-compat)
 *          → first segment under the root
 */
export function deriveLabels(
  path: string,
  projectsDir: string,
  defaults: Labels
): Labels {
  const root = normalize(projectsDir);
  const norm = normalize(path);
  if (!norm.startsWith(root)) return defaults;

  let rel = norm.slice(root.length);
  while (rel.startsWith(sep)) rel = rel.slice(sep.length);
  if (rel.length === 0) return defaults;

  const segments = rel.split(sep);
  const first = segments[0]!;

  // Solo layout: Claude Code's project dirs start with '-'.
  if (first.startsWith("-")) return defaults;

  // Team layout, two shapes the agent (or local symlinks) can produce:
  //   <user>/projects/-encoded-cwd/...                  → machine = default
  //   <user>/<machine>/projects/-encoded-cwd/...        → machine extracted
  // Anything else (segment[1] starts with '-', is undefined, etc.)
  // also falls back to the default.
  const user = first;
  let machine = defaults.machine;
  if (
    segments.length >= 3 &&
    segments[1] &&
    segments[1] !== "projects" &&
    !segments[1].startsWith("-") &&
    segments[2] === "projects"
  ) {
    machine = segments[1];
  }
  return { user, machine };
}
