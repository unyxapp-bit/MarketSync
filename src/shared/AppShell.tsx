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

const navLinkClass = (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-[10px] h-[39px] rounded-sm text-[12px] font-semibold no-underline hover:bg-sidebar-hover hover:text-white ${
      collapsed ? "justify-center px-0" : "px-[10px]"
    } ${isActive ? "bg-brand text-white" : "text-sidebar-text"}`;

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
      {!collapsed && (
        <p className="mt-4 mx-[9px] mb-1.5 text-[9px] font-extrabold tracking-[1.2px] text-[#7e9aa3]">{title}</p>
      )}
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate} className={navLinkClass(collapsed)} title={collapsed ? label : undefined}>
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
    <div className="min-h-screen bg-canvas flex">
      <aside
        className={`flex flex-col gap-1 fixed inset-y-0 left-0 z-[45] bg-sidebar transition-[width] duration-150 ease-in-out py-[22px] ${
          collapsed ? "w-[72px] px-[10px]" : "w-[228px] px-3"
        } ${mobileNavOpen ? "flex" : "max-[700px]:hidden"}`}
        aria-label="Navegação principal"
      >
        <div className={`flex items-center gap-2 relative pb-6 ${collapsed ? "justify-center px-0" : "px-[10px]"}`}>
          <span className="h-[22px] w-[22px] rounded-[6px] bg-brand shrink-0" />
          {!collapsed && (
            <strong className="text-white text-[19px] tracking-[-0.7px]">
              Market<span className="text-[#56d6aa]">Sync</span>
            </strong>
          )}
          <button
            className="hidden max-[700px]:block ml-auto border-0 bg-transparent text-[#d8e4e5] p-1"
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
          className={`flex items-center gap-2 w-full h-9 px-[10px] mt-[10px] border-0 border-t border-t-[#1e2a44] bg-transparent text-sidebar-text text-[11px] font-semibold cursor-pointer hover:text-white max-[700px]:hidden ${
            collapsed ? "justify-center" : ""
          }`}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Recolher</span>}
        </button>
        {!collapsed && (
          <small className="mt-auto mx-[9px] mb-[3px] pt-[13px] border-t border-t-[#29495d] text-[#7f99a2] text-[10px] leading-[1.5]">
            Planejamento seguro
            <br />e rastreável
          </small>
        )}
      </aside>
      {mobileNavOpen && (
        <button
          className="hidden max-[700px]:block fixed inset-0 z-40 border-0 bg-[rgba(16,42,67,0.44)]"
          aria-label="Fechar menu"
          onClick={closeMobileNav}
        />
      )}
      <div
        className={`min-w-0 flex-1 transition-[margin-left] duration-150 ease-in-out max-[700px]:ml-0 ${
          collapsed ? "ml-[72px]" : "ml-[228px]"
        }`}
      >
        <header className="sticky top-0 z-20 h-[72px] max-[700px]:h-[62px] bg-surface border-b border-line flex items-center gap-8 max-[700px]:gap-4 px-[max(24px,calc((100vw-1180px)/2))] max-[700px]:px-[18px]">
          <div className="hidden max-[700px]:flex items-center gap-2 text-[19px] tracking-[-0.8px] text-[#172235]">
            <span className="h-5 w-5 rounded-[6px] bg-brand" />
            <strong>
              Market<span className="text-[#168263]">Sync</span>
            </strong>
          </div>
          <StoreSwitcher />
          <button
            className="hidden max-[700px]:block ml-auto border-0 bg-[#f5f7f9] rounded-[7px] p-2 text-[#344054]"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={19} />
          </button>
        </header>
        <main className="max-w-[1100px] mx-auto pt-11 pb-11 px-7 max-[700px]:pt-[29px] max-[700px]:pb-[29px] max-[700px]:px-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
