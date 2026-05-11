/**
 * Subscribe to /api/usage/stream and call the listener whenever a new
 * `totals` event lands. EventSource handles automatic reconnect on
 * its own, so callers just register and unsubscribe.
 */

import type { Totals } from "./client.ts";

export interface UsageStreamMessage {
  totals: Totals;
  timestamp: number;
}

export function subscribeToUsageStream(
  onMessage: (msg: UsageStreamMessage) => void
): () => void {
  const es = new EventSource("/api/usage/stream");

  es.addEventListener("totals", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as UsageStreamMessage;
      onMessage(data);
    } catch {
      /* malformed event — ignore */
    }
  });

  return () => es.close();
}
