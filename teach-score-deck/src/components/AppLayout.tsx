import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import { useAppStore } from "@/store/useAppStore";
import AppSidebar from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 768;

const getInitial = (name?: string, username?: string): string =>
  (name ?? username ?? "U").charAt(0).toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Scrim behind the mobile drawer */
const MobileScrim = memo(({ onClose }: { onClose: () => void }) => (
  <div
    aria-hidden="true"
    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
    onClick={onClose}
  />
));
MobileScrim.displayName = "MobileScrim";

/** Sticky mobile topbar */
const MobileTopbar = memo(
  ({
    onMenuOpen,
    name,
    username,
  }: {
    onMenuOpen: () => void;
    name?: string;
    username?: string;
  }) => {
    const displayName = name ?? username ?? "User";
    const initial = getInitial(name, username);

    return (
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0e1118]/90 px-4 backdrop-blur-sm md:hidden">
        {/* Hamburger */}
        <button
          onClick={onMenuOpen}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Identity */}
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-white/50">{displayName}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-[11px] font-semibold text-blue-300">
            {initial}
          </span>
        </div>
      </header>
    );
  }
);
MobileTopbar.displayName = "MobileTopbar";

/** Page footer */
const PageFooter = memo(() => (
  <footer className="shrink-0 border-t border-white/[0.05] px-6 py-4 text-center">
    <p className="text-[11px] text-white/15">
      © {new Date().getFullYear()} Instructor Hub. All rights reserved.
    </p>
  </footer>
));
PageFooter.displayName = "PageFooter";

// ─────────────────────────────────────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────────────────────────────────────

const AppLayout = ({ children }: AppLayoutProps) => {
  const currentUser = useAppStore((s) => s.currentUser);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  );

  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Responsive listener ────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mobile = window.innerWidth < MOBILE_BREAKPOINT;
        setIsMobile(mobile);
        if (!mobile) setMobileOpen(false);
      });
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Lock body scroll when drawer is open ──────────────────────────────
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // ── Keyboard: close on Escape ──────────────────────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const openMenu  = useCallback(() => setMobileOpen(true), []);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0d14]">

      {/* ── Mobile scrim ──────────────────────────────────────────────── */}
      {mobileOpen && <MobileScrim onClose={closeMenu} />}

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <div
        ref={sidebarRef}
        className={cn(
          // Base
          "sidebar-container z-50 shrink-0 transition-transform duration-300 ease-in-out",
          // Mobile: fixed drawer
          isMobile && "fixed inset-y-0 left-0",
          // Mobile open/closed translation
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full"),
          // Desktop: always in flow, never translated
          !isMobile && "relative translate-x-0"
        )}
      >
        <AppSidebar onClose={closeMenu} />
      </div>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Mobile topbar — only rendered on mobile */}
        {isMobile && (
          <MobileTopbar
            onMenuOpen={openMenu}
            name={currentUser?.name}
            username={currentUser?.username}
          />
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

        <PageFooter />
      </div>
    </div>
  );
};

export default memo(AppLayout);