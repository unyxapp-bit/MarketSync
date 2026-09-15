import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  History,
  LayoutGrid,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { StoreSwitcher } from "./StoreSwitcher";

const SIDEBAR_COLLAPSED_KEY = "marketsync:sidebarCollapsed";

const operationLinks = [
  { to: "/app", label: "Visão geral", icon: LayoutGrid, end: true },
  { to: "/app/schedules", label: "Escalas", icon: CalendarDays },
  { to: "/app/conflicts", label: "Conflitos", icon: CircleAlert },
  { to: "/app/employees", label: "Colaboradores", icon: Users },
];

const managementLinks = [
  { to: "/app/rules", label: "Regras", icon: ShieldCheck },
  { to: "/app/publications", label: "Publicações", icon: Clock3 },
  { to: "/app/audit", label: "Auditoria", icon: History },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

function NavGroup({
  title,
  links,
  onNavigate,
  collapsed,
}: {
  title: string;
  links: typeof operationLinks;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  return (
    <>
      {!collapsed && <p>{title}</p>}
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "active" : "")}
          title={collapsed ? label : undefined}
        >
          <Icon size={17} />
          {!collapsed && label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const closeMobileNav = () => setMobileNavOpen(false);
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Private browsing or storage disabled — the choice just won't survive a reload.
      }
      return next;
    });
  };

  return (
    <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside
        className={`app-sidebar ${mobileNavOpen ? "open" : ""}`}
        aria-label="Navegação principal"
      >
        <div className="sidebar-brand">
          <span className="logo-dot" />
          <strong>
            Market<span>Sync</span>
          </strong>
          <button
            className="sidebar-close"
            type="button"
            onClick={closeMobileNav}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <NavGroup title="OPERAÇÃO" links={operationLinks} onNavigate={closeMobileNav} collapsed={collapsed} />
        <NavGroup title="GESTÃO" links={managementLinks} onNavigate={closeMobileNav} collapsed={collapsed} />
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Recolher</span>}
        </button>
        {!collapsed && (
          <small>
            Planejamento seguro
            <br />e rastreável
          </small>
        )}
      </aside>
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={closeMobileNav}
        />
      )}
      <div className="app-content">
        <header className="topbar">
          <div className="logo">
            <span className="logo-dot" />
            <strong>
              Market<span>Sync</span>
            </strong>
          </div>
          <StoreSwitcher />
          <button
            className="menu"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={19} />
          </button>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
