import { memo, useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

interface AppSidebarProps {
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_NAV: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    description: "Overview & statistics",
  },
  {
    name: "Attendance",
    href: "/admin/attendance",
    icon: Calendar,
    description: "Monitor staff attendance",
  },
  {
    name: "Instructors",
    href: "/admin/instructors",
    icon: Users,
    description: "Manage instructors",
  },
  {
    name: "KPI Reports",
    href: "/admin/kpi",
    icon: BarChart3,
    description: "Performance metrics",
  },
];

const INSTRUCTOR_NAV: NavItem[] = [
  {
    name: "Dashboard",
    href: "/instructor/dashboard",
    icon: LayoutDashboard,
    description: "Your overview",
  },
  {
    name: "Submit Report",
    href: "/instructor/submit-report",
    icon: FileText,
    description: "Submit daily report",
  },
  {
    name: "My Reports",
    href: "/instructor/my-reports",
    icon: Clock,
    description: "View your reports",
  },
  {
    name: "My Performance",
    href: "/instructor/kpi",
    icon: CheckSquare,
    description: "Track your KPI",
  },
];

// Avatar palette — matches AttendancePage / AdminDashboard
const AVATAR_PALETTE = [
  { bg: "bg-sky-500/15",    text: "text-sky-300"    },
  { bg: "bg-teal-500/15",   text: "text-teal-300"   },
  { bg: "bg-amber-500/15",  text: "text-amber-300"  },
  { bg: "bg-violet-500/15", text: "text-violet-300" },
  { bg: "bg-rose-500/15",   text: "text-rose-300"   },
  { bg: "bg-cyan-500/15",   text: "text-cyan-300"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

const hashIndex = (s: string): number =>
  [...s].reduce((acc, c) => acc + c.charCodeAt(0), 0);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Wordmark shown when sidebar is expanded */
const Wordmark = memo(({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
  >
    <Logo />
    <span className="text-sm font-semibold tracking-tight text-white">
      Instructor<span className="text-white/40">Hub</span>
    </span>
  </button>
));
Wordmark.displayName = "Wordmark";

/** Square logo mark */
const Logo = memo(() => (
  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600">
    <span className="text-[11px] font-bold tracking-wide text-white">IH</span>
  </div>
));
Logo.displayName = "Logo";

/** Collapse / expand toggle */
const CollapseToggle = memo(
  ({
    collapsed,
    onToggle,
  }: {
    collapsed: boolean;
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  )
);
CollapseToggle.displayName = "CollapseToggle";

/** User identity block */
const UserBlock = memo(
  ({
    name,
    role,
    collapsed,
  }: {
    name: string;
    role: string;
    collapsed: boolean;
  }) => {
    const idx = hashIndex(name) % AVATAR_PALETTE.length;
    const c = AVATAR_PALETTE[idx];
    return (
      <div
        className={cn(
          "flex items-center gap-3",
          collapsed && "justify-center"
        )}
      >
        {/* Avatar */}
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
            c.bg,
            c.text
          )}
        >
          {getInitials(name)}
        </span>

        {/* Name + role */}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/85">{name}</p>
            <p className="text-[11px] capitalize text-white/30">{role}</p>
          </div>
        )}
      </div>
    );
  }
);
UserBlock.displayName = "UserBlock";

/** Single nav item button */
const NavButton = memo(
  ({
    item,
    active,
    collapsed,
    onClick,
  }: {
    item: NavItem;
    active: boolean;
    collapsed: boolean;
    onClick: () => void;
  }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={onClick}
        title={collapsed ? item.name : undefined}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
          collapsed && "justify-center px-0",
          active
            ? "bg-blue-600/20 text-blue-300"
            : "text-white/35 hover:bg-white/[0.05] hover:text-white/75"
        )}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-blue-500" />
        )}

        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-blue-400" : "text-white/30 group-hover:text-white/60"
          )}
        />

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-medium leading-none",
                active ? "text-blue-300" : "text-white/70"
              )}
            >
              {item.name}
            </p>
            <p className="mt-0.5 text-[11px] text-white/25">{item.description}</p>
          </div>
        )}
      </button>
    );
  }
);
NavButton.displayName = "NavButton";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const AppSidebar = ({ onClose }: AppSidebarProps) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const logout      = useAppStore((s) => s.logout);
  const navigate    = useNavigate();
  const location    = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const isAdmin    = currentUser?.role === "admin";
  const displayName = currentUser?.name ?? currentUser?.username ?? "User";
  const homeHref   = isAdmin ? "/admin/dashboard" : "/instructor/dashboard";
  const navItems   = isAdmin ? ADMIN_NAV : INSTRUCTOR_NAV;

  const navigate_ = useCallback(
    (href: string) => {
      navigate(href);
      onClose?.();
    },
    [navigate, onClose]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-white/[0.05] bg-[#0e1118] transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* ── Brand Header ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-white/[0.05] px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {collapsed ? (
          <button
            onClick={() => navigate_(homeHref)}
            className="transition-opacity hover:opacity-75"
          >
            <Logo />
          </button>
        ) : (
          <Wordmark onClick={() => navigate_(homeHref)} />
        )}

        {!collapsed && (
          <CollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
        )}
      </div>

      {/* ── User Block ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-b border-white/[0.05] px-3 py-3",
          collapsed && "flex justify-center"
        )}
      >
        <UserBlock
          name={displayName}
          role={currentUser?.role ?? ""}
          collapsed={collapsed}
        />
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Collapse toggle in collapsed mode */}
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <CollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
          </div>
        )}

        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavButton
                item={item}
                active={location.pathname === item.href}
                collapsed={collapsed}
                onClick={() => navigate_(item.href)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Footer / Logout ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-white/[0.05] px-2 py-3",
          collapsed && "flex justify-center"
        )}
      >
        <button
          onClick={handleLogout}
          title="Logout"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30 transition-all hover:bg-red-500/[0.08] hover:text-red-400",
            collapsed ? "w-auto justify-center px-0" : "w-full"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default memo(AppSidebar);