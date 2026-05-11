/**
 * Small UI for setting/clearing the bearer token in localStorage.
 * Lives in the sidebar; admin views show a banner asking to set one
 * when calls return 401.
 */

import { useState } from "react";
import { clearToken, getToken, setToken } from "@/api/client";

export default function TokenGate() {
  const [current, setCurrent] = useState<string | null>(getToken());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const masked = current ? current.slice(0, 6) + "…" + current.slice(-4) : null;

  if (editing || !current) {
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          setToken(t);
          setCurrent(t);
          setDraft("");
          setEditing(false);
          // Force any cached 401 queries to refetch.
          window.location.reload();
        }}
      >
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="wts_… or emb_…"
          className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs font-mono text-neutral-100 outline-none focus:border-accent"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded bg-accent px-2 py-1 text-xs font-medium hover:bg-accent-fg"
          >
            Save
          </button>
          {current && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
              className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        token
      </div>
      <div className="font-mono text-xs text-neutral-300">{masked}</div>
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:text-neutral-100"
        >
          Change
        </button>
        <button
          onClick={() => {
            clearToken();
            setCurrent(null);
            window.location.reload();
          }}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-rose-400 hover:text-rose-300"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
