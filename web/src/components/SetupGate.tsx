import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setup, type SetupStatus } from "../api/client.ts";

/**
 * Sits at the top of the app and redirects to /setup whenever the
 * server reports `complete: false`. Skipped for /setup itself so the
 * wizard can render normally. We poll status once on mount and again
 * after route changes — cheap and avoids the user being stuck on a
 * stale "incomplete" verdict.
 */
export default function SetupGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setup
      .status()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (!s.complete && location.pathname !== "/setup") {
          navigate("/setup", { replace: true });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // If the status endpoint itself fails (network / 5xx) just let
        // the app render — better than blocking the dashboard on a
        // transient error.
        setError(String(err));
        setStatus({
          complete: true,
          scenario: null,
          infra: null,
          completedAt: null,
          headless: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  if (!status) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-500 flex items-center justify-center text-xs">
        loading…
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-950/40 px-4 py-1.5 text-xs text-red-300">
          setup status check failed — {error}
        </div>
      )}
      {children}
    </>
  );
}
