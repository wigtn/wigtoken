import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setup, setToken, getToken } from "../api/client.ts";
import { admin as adminApi, ApiError } from "../api/client.ts";

type Scenario = "solo" | "team" | "org";
type Infra =
  | "native-launchd"
  | "docker-single"
  | "docker-compose"
  | "kubernetes"
  | "headless";

interface ScenarioMeta {
  id: Scenario;
  title: string;
  blurb: string;
  recommendsInfra: Infra[];
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: "solo",
    title: "Solo",
    blurb: "One developer, one machine. Personal usage tracker.",
    recommendsInfra: ["native-launchd", "docker-single"],
  },
  {
    id: "team",
    title: "Team",
    blurb: "2–20 developers, shared dashboard. Embed widget on team site.",
    recommendsInfra: ["native-launchd", "docker-compose"],
  },
  {
    id: "org",
    title: "Organisation",
    blurb: "20+ developers, multiple machines, central aggregation.",
    recommendsInfra: ["docker-compose", "kubernetes"],
  },
];

const INFRA: Record<Infra, { title: string; blurb: string }> = {
  "native-launchd": {
    title: "Native (launchd / systemd)",
    blurb: "Runs as a system service. No container layer. Lightest footprint.",
  },
  "docker-single": {
    title: "Docker (single container)",
    blurb: "One container with bind-mounted ~/.claude/projects.",
  },
  "docker-compose": {
    title: "Docker Compose",
    blurb: "Server + nginx in one stack. Built-in dashboard included.",
  },
  kubernetes: {
    title: "Kubernetes",
    blurb: "Helm chart, persistent volume for SQLite. For larger orgs.",
  },
  headless: {
    title: "Headless (ingest only)",
    blurb: "No dashboard SPA. Ingest + embed widget endpoints only.",
  },
};

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [infra, setInfra] = useState<Infra | null>(null);
  const [bootstrap, setBootstrap] = useState(getToken() ?? "");
  const [embedOrigin, setEmbedOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialStatus, setInitialStatus] = useState<{ complete: boolean } | null>(null);

  useEffect(() => {
    setup
      .status()
      .then((s) => setInitialStatus({ complete: s.complete }))
      .catch(() => setInitialStatus({ complete: false }));
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return !!scenario;
    if (step === 2) return !!infra;
    if (step === 3) return bootstrap.trim().length > 0;
    return true;
  }, [step, scenario, infra, bootstrap]);

  async function handleFinish() {
    if (!scenario || !infra) return;
    setSubmitting(true);
    setError(null);
    try {
      setToken(bootstrap.trim());
      if (embedOrigin.trim()) {
        try {
          await adminApi.addEmbedOrigin({
            origin: embedOrigin.trim(),
            label: "added via setup wizard",
          });
        } catch (err) {
          // non-fatal: user can add origins later
          console.warn("embed origin add failed:", err);
        }
      }
      await setup.complete({ scenario, infra });
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else {
        setError(String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-accent to-accent-fg" />
          <div>
            <div className="text-base font-semibold">wigtoken</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              setup wizard
            </div>
          </div>
        </div>

        <Steps current={step} />

        {initialStatus?.complete && (
          <div className="mb-6 rounded-md border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            Setup is already marked complete. Re-running the wizard will
            overwrite scenario / infra labels and add a fresh embed origin,
            but won't touch existing tokens or data.
          </div>
        )}

        <div className="rounded-xl border border-neutral-900 bg-neutral-925 p-6">
          {step === 1 && (
            <StepScenario value={scenario} onChange={setScenario} />
          )}
          {step === 2 && scenario && (
            <StepInfra
              scenario={scenario}
              value={infra}
              onChange={setInfra}
            />
          )}
          {step === 3 && (
            <StepBootstrap
              value={bootstrap}
              onChange={setBootstrap}
            />
          )}
          {step === 4 && (
            <StepEmbed
              value={embedOrigin}
              onChange={setEmbedOrigin}
            />
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-40"
              disabled={step === 1 || submitting}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
            >
              ← Back
            </button>
            {step < 4 ? (
              <button
                type="button"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
                disabled={!canNext}
                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4))}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
                disabled={submitting || !scenario || !infra || !bootstrap.trim()}
                onClick={handleFinish}
              >
                {submitting ? "Finalising…" : "Finish setup"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-500">
          Configuration is stored in the local SQLite database. You can re-run
          this wizard any time by hitting{" "}
          <code className="text-neutral-300">/setup</code>.
        </div>
      </div>
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const labels = ["Scenario", "Infra", "Admin token", "Embed origin"];
  return (
    <div className="mb-6 flex items-center gap-2">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = n === current;
        const done = n < current;
        return (
          <div key={l} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-accent text-accent-fg"
                  : done
                    ? "bg-emerald-700/40 text-emerald-200"
                    : "bg-neutral-900 text-neutral-500"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <div
              className={`text-xs ${
                active ? "text-neutral-100" : "text-neutral-500"
              }`}
            >
              {l}
            </div>
            {i < labels.length - 1 && (
              <div className="ml-2 h-px flex-1 bg-neutral-900" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepScenario({
  value,
  onChange,
}: {
  value: Scenario | null;
  onChange: (s: Scenario) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold">Pick a deployment scenario</h2>
      <p className="mb-4 text-sm text-neutral-400">
        We tune defaults and infra suggestions based on this choice. You can
        change it later in <code>/admin</code>.
      </p>
      <div className="grid gap-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              value === s.id
                ? "border-accent bg-accent/10"
                : "border-neutral-900 bg-neutral-950/40 hover:border-neutral-800"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                {s.id}
              </div>
            </div>
            <div className="mt-1 text-xs text-neutral-400">{s.blurb}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function StepInfra({
  scenario,
  value,
  onChange,
}: {
  scenario: Scenario;
  value: Infra | null;
  onChange: (i: Infra) => void;
}) {
  const meta = SCENARIOS.find((s) => s.id === scenario)!;
  const recommended = new Set(meta.recommendsInfra);
  const order: Infra[] = [
    "native-launchd",
    "docker-single",
    "docker-compose",
    "kubernetes",
    "headless",
  ];
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold">Pick an infra layout</h2>
      <p className="mb-4 text-sm text-neutral-400">
        Recommended options for <b>{meta.title}</b> are marked. This only
        affects which deploy guide the dashboard links to — the server runs
        identically across all options.
      </p>
      <div className="grid gap-2">
        {order.map((id) => {
          const m = INFRA[id];
          const isRec = recommended.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                value === id
                  ? "border-accent bg-accent/10"
                  : "border-neutral-900 bg-neutral-950/40 hover:border-neutral-800"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium">{m.title}</div>
                {isRec && (
                  <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                    recommended
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-neutral-400">{m.blurb}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepBootstrap({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold">Paste the bootstrap admin token</h2>
      <p className="mb-4 text-sm text-neutral-400">
        On first launch the server prints a one-time admin token to its log.
        Paste it here so the wizard can call admin-scoped endpoints and we
        can store it in this browser. (You can rotate it later via{" "}
        <code>/admin/tokens</code>.)
      </p>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="wt_admin_…"
        className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
      />
      <div className="mt-3 rounded-md border border-neutral-900 bg-neutral-950/60 p-3 text-xs text-neutral-400">
        <div className="mb-1 font-medium text-neutral-300">Where to find it</div>
        <code className="block text-[11px] text-neutral-500">
          tail -n 40 /var/log/wigtoken.out.log
        </code>
        <div className="mt-1">
          Or check the launchd <code>StandardOutPath</code> from your
          plist.
        </div>
      </div>
    </>
  );
}

function StepEmbed({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold">
        Add an embed origin <span className="text-neutral-500">(optional)</span>
      </h2>
      <p className="mb-4 text-sm text-neutral-400">
        If you plan to embed the widget on a public site (marketing page,
        team about-page), whitelist the origin now. You can manage origins
        later in <code>/admin/embeds</code>.
      </p>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com"
        className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
      />
      <p className="mt-2 text-xs text-neutral-500">
        Leave blank to skip — the widget will still work from same-origin
        pages (your own dashboard).
      </p>
    </>
  );
}
