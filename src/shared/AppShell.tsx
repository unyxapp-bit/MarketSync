import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
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
}: {
  title: string;
  links: typeof operationLinks;
  onNavigate: () => void;
}) {
  return (
    <>
      <p>{title}</p>
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="workspace">
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
        <NavGroup title="OPERAÇÃO" links={operationLinks} onNavigate={closeMobileNav} />
        <NavGroup title="GESTÃO" links={managementLinks} onNavigate={closeMobileNav} />
        <small>
          Planejamento seguro
          <br />e rastreável
        </small>
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
