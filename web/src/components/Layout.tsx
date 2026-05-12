import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TokenGate from "./TokenGate";
import LanguageSwitcher from "./LanguageSwitcher";

interface NavItem {
  to: string;
  /** Translation key under `nav.*` */
  labelKey: string;
  section?: "main" | "admin";
}

const NAV: NavItem[] = [
  { to: "/", labelKey: "overview", section: "main" },
  { to: "/users", labelKey: "users", section: "main" },
  { to: "/models", labelKey: "models", section: "main" },
  { to: "/machines", labelKey: "machines", section: "main" },
  { to: "/timeseries", labelKey: "timeseries", section: "main" },
  { to: "/sessions", labelKey: "sessions", section: "main" },
  { to: "/admin/tokens", labelKey: "tokens", section: "admin" },
  { to: "/admin/embeds", labelKey: "embeds", section: "admin" },
  { to: "/admin/audit", labelKey: "audit", section: "admin" },
];

export default function Layout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-neutral-900 bg-neutral-950/80 px-4 py-6 flex flex-col">
        <div className="px-2 mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-accent to-accent-fg" />
          <div>
            <div className="text-sm font-semibold">{t("brand.name")}</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
              {t("brand.tagline")}
            </div>
          </div>
        </div>

        <NavSection items={NAV.filter((n) => n.section === "main")} />
        <div className="mt-6">
          <NavSection
            title={t("nav.admin")}
            items={NAV.filter((n) => n.section === "admin")}
          />
        </div>
        <div className="mt-auto pt-4">
          <div className="border-t border-neutral-900 pt-4">
            <TokenGate />
          </div>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      <main className="flex-1 px-8 py-6 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  const { t } = useTranslation();
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
            {t(`nav.${item.labelKey}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
