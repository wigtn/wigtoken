export interface Config {
  server: string;
  token: string;
  theme: "purple" | "teal" | "amber" | "mono" | "auto";
  density: "compact" | "comfortable";
}

const THEMES: Config["theme"][] = ["purple", "teal", "amber", "mono", "auto"];

interface Props {
  config: Config;
  onChange: (c: Config) => void;
}

export default function ConfigBar({ config, onChange }: Props) {
  function update<K extends keyof Config>(key: K, value: Config[K]) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="mb-6 rounded-xl border border-neutral-900 bg-neutral-950/60 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <div className="mb-1 text-neutral-400">Server</div>
          <input
            type="text"
            value={config.server}
            onChange={(e) => update("server", e.target.value)}
            placeholder="https://token.example.com"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-[12px] focus:border-purple-500 focus:outline-none"
          />
        </label>
        <label className="text-xs">
          <div className="mb-1 text-neutral-400">Embed token</div>
          <input
            type="text"
            value={config.token}
            onChange={(e) => update("token", e.target.value)}
            placeholder="we_…"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-[12px] focus:border-purple-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="text-xs">
          <div className="mb-1 text-neutral-400">Theme</div>
          <div className="flex gap-1">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update("theme", t)}
                className={`rounded-md border px-2 py-1 text-[11px] capitalize ${
                  config.theme === t
                    ? "border-purple-500 bg-purple-500/10 text-purple-200"
                    : "border-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs">
          <div className="mb-1 text-neutral-400">Density</div>
          <div className="flex gap-1">
            {(["compact", "comfortable"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => update("density", d)}
                className={`rounded-md border px-2 py-1 text-[11px] capitalize ${
                  config.density === d
                    ? "border-purple-500 bg-purple-500/10 text-purple-200"
                    : "border-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">
        Set <code>VITE_DEMO_SERVER</code> and <code>VITE_DEMO_TOKEN</code>{" "}
        env vars to point at your own server. Out of the box this site
        renders against a public demo instance — useful for screenshots,
        not for production.
      </p>
    </div>
  );
}
