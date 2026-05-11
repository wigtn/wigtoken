import { NavLink, Outlet } from "react-router-dom";
import TokenGate from "./TokenGate";

interface NavItem {
  to: string;
  label: string;
  section?: "main" | "admin";
}

const NAV: NavItem[] = [
  { to: "/", label: "Overview", section: "main" },
  { to: "/users", label: "Users", section: "main" },
  { to: "/models", label: "Models", section: "main" },
  { to: "/machines", label: "Machines", section: "main" },
  { to: "/timeseries", label: "Timeseries", section: "main" },
  { to: "/sessions", label: "Sessions", section: "main" },
  { to: "/admin/tokens", label: "Tokens", section: "admin" },
  { to: "/admin/embeds", label: "Embeds", section: "admin" },
  { to: "/admin/audit", label: "Audit", section: "admin" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-neutral-900 bg-neutral-950/80 px-4 py-6">
        <div className="px-2 mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-accent to-accent-fg" />
          <div>
            <div className="text-sm font-semibold">wigtoken</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
              operator dashboard
            </div>
          </div>
        </div>

        <NavSection title="" items={NAV.filter((n) => n.section === "main")} />
        <div className="mt-6">
          <NavSection
            title="admin"
            items={NAV.filter((n) => n.section === "admin")}
          />
        </div>
        <div className="mt-8 border-t border-neutral-900 pt-4">
          <TokenGate />
        </div>
      </aside>

      <main className="flex-1 px-8 py-6 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      {title && (
        <div className="px-2 mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {title}
        </div>
      )}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `rounded-md px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-neutral-800 text-neutral-50"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
