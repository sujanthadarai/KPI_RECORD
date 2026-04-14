import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, FilterX, X, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — identical to InstructorDashboard + SubmitReportPage
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  bg:        "#0b0d12",
  surface:   "#111318",
  raised:    "#1a1d24",
  border:    "rgba(255,255,255,0.06)",
  borderMed: "rgba(255,255,255,0.10)",
  text:      "#e8e6e1",
  textMuted: "rgba(232,230,225,0.45)",
  textDim:   "rgba(232,230,225,0.22)",
  accent:    "#63b3ed",
  accentDim: "rgba(99,179,237,0.10)",
  green:     "#4ade80",
  greenDim:  "rgba(74,222,128,0.10)",
  amber:     "#fbbf24",
  amberDim:  "rgba(251,191,36,0.10)",
  red:       "#f87171",
  redDim:    "rgba(248,113,113,0.10)",
  grid:      "rgba(255,255,255,0.04)",
  mono:      "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
  sans:      "'IBM Plex Sans','Inter',sans-serif",
  r:         "8px",
  rs:        "5px",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DateRange = "all" | "week" | "month" | "year";
type StatusFilter = "all" | "completed" | "pending" | "cancelled";

interface SlotMeta {
  id?: string | number;
  startTime: string;
  endTime: string;
  description: string;
  status: "completed" | "pending" | "cancelled";
}

interface ReportMeta {
  id: string | number;
  date: string;
  createdAt: string;
  timeSlots: SlotMeta[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  completed: { label: "completed", color: D.green, dim: D.greenDim, Icon: CheckCircle2 },
  pending:   { label: "pending",   color: D.amber, dim: D.amberDim, Icon: Clock        },
  cancelled: { label: "cancelled", color: D.red,   dim: D.redDim,   Icon: XCircle      },
} as const;

const ITEMS_PER_PAGE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return h > 0 ? h : 0;
}

function reportHours(report: ReportMeta): string {
  return report.timeSlots
    .reduce((s, sl) => s + calcHours(sl.startTime, sl.endTime), 0)
    .toFixed(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

const MonoPill = memo(({
  color, dim, label,
}: { color: string; dim: string; label: string }) => (
  <span style={{
    fontSize: 10, fontFamily: D.mono, fontWeight: 500,
    padding: "2px 8px", borderRadius: 20,
    background: dim, color,
    border: `1px solid ${color}30`,
    flexShrink: 0,
  }}>
    {label}
  </span>
));
MonoPill.displayName = "MonoPill";

const StatCard = memo(({
  label, value, accent, dim, Icon, sub,
}: {
  label: string; value: string | number;
  accent: string; dim: string;
  Icon: React.ElementType; sub?: string;
}) => (
  <div style={{
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: D.r, padding: "15px 17px",
    display: "flex", alignItems: "center", gap: 12,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: D.rs,
      background: dim, border: `1px solid ${accent}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon size={15} color={accent} />
    </div>
    <div>
      <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.07em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, fontFamily: D.mono, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  </div>
));
StatCard.displayName = "StatCard";

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const PageSkeleton = () => (
  <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
    {[56, 64, 120, 160, 160, 160].map((h, i) => (
      <div key={i} style={{
        height: h, borderRadius: D.r,
        background: D.surface, border: `1px solid ${D.border}`,
        animation: "skelPulse 1.6s ease-in-out infinite",
        animationDelay: `${i * 0.08}s`,
      }} />
    ))}
    <style>{`@keyframes skelPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Detail modal
// ─────────────────────────────────────────────────────────────────────────────

const ReportModal = memo(({
  report, onClose,
}: { report: ReportMeta; onClose: () => void }) => {
  const completed = report.timeSlots.filter((s) => s.status === "completed").length;
  const pending   = report.timeSlots.filter((s) => s.status === "pending").length;
  const cancelled = report.timeSlots.filter((s) => s.status === "cancelled").length;
  const hours     = reportHours(report);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.surface, border: `1px solid ${D.borderMed}`,
          borderRadius: D.r, width: "100%", maxWidth: 640,
          maxHeight: "82vh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          animation: "slideUp 0.2s ease",
        }}
      >
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${D.border}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.08em", marginBottom: 3 }}>
              report_detail
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, fontFamily: D.sans, color: D.text }}>
              {format(new Date(report.date), "EEEE, MMMM d, yyyy")}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: `1px solid ${D.border}`,
              borderRadius: D.rs, width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.textDim, transition: "all 0.15s",
            }}
            className="modal-close-btn"
          >
            <X size={13} />
          </button>
        </div>

        {/* Summary row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)",
          gap: 1, borderBottom: `1px solid ${D.border}`,
          flexShrink: 0,
        }}>
          {[
            { label: "total_tasks", value: report.timeSlots.length, color: D.text    },
            { label: "completed",   value: completed,                color: D.green   },
            { label: "pending",     value: pending,                  color: D.amber   },
            { label: "hours",       value: `${hours}h`,              color: D.accent  },
          ].map((m) => (
            <div key={m.label} style={{ padding: "13px 16px", textAlign: "center", background: D.raised }}>
              <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.07em", marginBottom: 5 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, fontFamily: D.mono, color: m.color }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Slots */}
        <div style={{ overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
          {report.timeSlots.map((slot, idx) => {
            const st = STATUS_MAP[slot.status];
            return (
              <div key={slot.id ?? idx} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "11px 14px",
                background: D.raised, borderRadius: D.rs,
                border: `1px solid ${D.border}`,
              }}>
                <span style={{
                  fontSize: 11, fontFamily: D.mono, color: D.textMuted,
                  background: D.bg, borderRadius: D.rs,
                  padding: "3px 8px", border: `1px solid ${D.border}`,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {slot.startTime} → {slot.endTime}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: D.text, fontFamily: D.sans, margin: 0 }}>
                    {slot.description}
                  </p>
                </div>
                <MonoPill color={st.color} dim={st.dim} label={st.label} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
ReportModal.displayName = "ReportModal";

// ─────────────────────────────────────────────────────────────────────────────
// Report row card
// ─────────────────────────────────────────────────────────────────────────────

const ReportCard = memo(({
  report, onView,
}: { report: ReportMeta; onView: () => void }) => {
  const completed = report.timeSlots.filter((s) => s.status === "completed").length;
  const total     = report.timeSlots.length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hours     = reportHours(report);

  return (
    <div className="report-card" style={{
      background: D.surface, border: `1px solid ${D.border}`,
      borderRadius: D.r, overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", flexWrap: "wrap", gap: 10,
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: D.rs,
            background: D.accentDim, border: `1px solid ${D.accent}20`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Calendar size={14} color={D.accent} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: D.sans, color: D.text }}>
              {format(new Date(report.date), "EEEE, MMMM d, yyyy")}
            </div>
            <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, marginTop: 2 }}>
              submitted {format(new Date(report.createdAt), "MMM d, yyyy · h:mm a")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontFamily: D.mono, color: D.textMuted,
            background: D.raised, border: `1px solid ${D.border}`,
            borderRadius: 20, padding: "2px 9px",
          }}>
            {total} slot{total !== 1 ? "s" : ""} · {hours}h
          </span>
          <span style={{
            fontSize: 10, fontFamily: D.mono, color: D.accent,
            background: D.accentDim, border: `1px solid ${D.accent}30`,
            borderRadius: 20, padding: "2px 9px",
          }}>
            {completed}/{total} done
          </span>
          <button
            onClick={onView}
            className="report-view-btn"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontFamily: D.mono, color: D.textMuted,
              background: "transparent", border: `1px solid ${D.border}`,
              borderRadius: D.rs, padding: "5px 10px",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <Eye size={11} />
            view
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "10px 18px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 2, background: D.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: 2,
            background: pct === 100
              ? D.green
              : pct >= 50
              ? D.accent
              : D.amber,
            borderRadius: 2,
            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
            boxShadow: `0 0 6px ${pct === 100 ? D.green : D.accent}60`,
          }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, flexShrink: 0 }}>
          {pct}%
        </span>
      </div>

      {/* Slot preview */}
      <div style={{ padding: "10px 18px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
        {report.timeSlots.slice(0, 3).map((slot, idx) => {
          const st = STATUS_MAP[slot.status];
          return (
            <div key={slot.id ?? idx} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 10px",
              background: D.raised, borderRadius: D.rs,
              border: `1px solid ${D.border}`,
            }}>
              <span style={{
                fontSize: 10, fontFamily: D.mono, color: D.textDim,
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {slot.startTime} → {slot.endTime}
              </span>
              <span style={{
                fontSize: 12, color: D.textMuted, fontFamily: D.sans,
                flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {slot.description}
              </span>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: st.color, flexShrink: 0,
                boxShadow: `0 0 5px ${st.color}80`,
              }} />
            </div>
          );
        })}
        {total > 3 && (
          <div style={{
            fontSize: 10, fontFamily: D.mono, color: D.textDim,
            textAlign: "center", paddingTop: 4,
          }}>
            +{total - 3} more slot{total - 3 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
});
ReportCard.displayName = "ReportCard";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const MyReportsPage = () => {
  const [search,      setSearch]      = useState("");
  const [statusFilt,  setStatusFilt]  = useState<StatusFilter>("all");
  const [dateRange,   setDateRange]   = useState<DateRange>("all");
  const [page,        setPage]        = useState(1);
  const [selected,    setSelected]    = useState<ReportMeta | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const loadedRef = useRef(false);

  const currentUser           = useAppStore((s) => s.currentUser);
  const getReportsByInstructor = useAppStore((s) => s.getReportsByInstructor);
  const fetchReports           = useAppStore((s) => s.fetchReports);
  const loading                = useAppStore((s) => s.loading);

  if (!currentUser) return null;

  const allReports: ReportMeta[] = getReportsByInstructor(currentUser.id);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setRefreshing(true);
    fetchReports()
      .catch(() => toast.error("failed to load reports"))
      .finally(() => setRefreshing(false));
  }, []); // eslint-disable-line

  // Refresh on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && loadedRef.current) {
        fetchReports().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchReports]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchReports();
      toast.success("reports refreshed");
      setPage(1);
    } catch {
      toast.error("failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [fetchReports, refreshing]);

  const exportCSV = useCallback(() => {
    if (!allReports.length) { toast.error("no reports to export"); return; }
    const headers = ["date", "start_time", "end_time", "description", "status"];
    const rows = allReports.flatMap((r) =>
      r.timeSlots.map((s) => [
        format(new Date(r.date), "yyyy-MM-dd"),
        s.startTime, s.endTime,
        `"${s.description.replace(/"/g, '""')}"`,
        s.status,
      ])
    );
    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `reports-${format(new Date(), "yyyy-MM-dd")}.csv`,
    });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(`${allReports.length} report(s) exported`);
  }, [allReports]);

  const resetFilters = useCallback(() => {
    setSearch(""); setStatusFilt("all"); setDateRange("all"); setPage(1);
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...allReports];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.timeSlots.some((s) => s.description.toLowerCase().includes(q)) ||
        format(new Date(r.date), "MMMM d, yyyy").toLowerCase().includes(q) ||
        r.date.includes(q)
      );
    }
    if (statusFilt !== "all") {
      list = list.filter((r) => r.timeSlots.some((s) => s.status === statusFilt));
    }
    if (dateRange !== "all") {
      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cutoff = new Date(today);
      if (dateRange === "week")  cutoff.setDate(today.getDate() - 7);
      if (dateRange === "month") cutoff.setMonth(today.getMonth() - 1);
      if (dateRange === "year")  cutoff.setFullYear(today.getFullYear() - 1);
      list = list.filter((r) => new Date(r.date) >= cutoff);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [allReports, search, statusFilt, dateRange]);

  useEffect(() => { setPage(1); }, [search, statusFilt, dateRange]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const hasFilters = !!(search || statusFilt !== "all" || dateRange !== "all");

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = allReports.length;
    const allSlots  = allReports.flatMap((r) => r.timeSlots);
    const done      = allSlots.filter((s) => s.status === "completed").length;
    const pend      = allSlots.filter((s) => s.status === "pending").length;
    const canc      = allSlots.filter((s) => s.status === "cancelled").length;
    const rate      = allSlots.length > 0 ? Math.round((done / allSlots.length) * 100) : 0;
    const hrs       = allReports
      .flatMap((r) => r.timeSlots)
      .reduce((s, sl) => s + calcHours(sl.startTime, sl.endTime), 0)
      .toFixed(1);
    return { total, done, pend, canc, rate, hrs };
  }, [allReports]);

  if (loading && !allReports.length && !loadedRef.current) return <PageSkeleton />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        .mrp * { box-sizing: border-box; }
        .mrp input, .mrp select { color-scheme: dark; }
        .mrp input::placeholder { color: rgba(232,230,225,0.18); }
        .mrp input:focus, .mrp select:focus { outline: none; border-color: rgba(99,179,237,0.5) !important; box-shadow: 0 0 0 3px rgba(99,179,237,0.07) !important; }
        .mrp-btn:hover     { background: rgba(255,255,255,0.06) !important; color: #e8e6e1 !important; border-color: rgba(255,255,255,0.12) !important; }
        .mrp-btn-accent:hover { opacity: 0.8 !important; }
        .report-card:hover { border-color: rgba(255,255,255,0.10) !important; }
        .report-view-btn:hover { background: rgba(99,179,237,0.08) !important; color: #63b3ed !important; border-color: rgba(99,179,237,0.25) !important; }
        .modal-close-btn:hover { background: rgba(255,255,255,0.07) !important; color: #e8e6e1 !important; }
        .mrp-filter-chip.active { background: rgba(99,179,237,0.10) !important; color: #63b3ed !important; border-color: rgba(99,179,237,0.3) !important; }
        .mrp-filter-chip:hover { border-color: rgba(255,255,255,0.12) !important; color: #e8e6e1 !important; }
        .mrp-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06) !important; color: #e8e6e1 !important; }
        .mrp-page-btn:disabled { opacity: 0.3 !important; cursor: not-allowed !important; }
        @keyframes fadeIn  { from { opacity:0; }                      to { opacity:1; }                      }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .mrp { animation: fadeIn 0.3s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="mrp" style={{
        fontFamily: D.sans, background: D.bg, color: D.text,
        fontSize: 14, lineHeight: 1.6, minHeight: "100vh",
        maxWidth: 900, margin: "0 auto", padding: "28px 20px",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: D.mono, color: D.accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              my_reports
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.4px", color: D.text, fontFamily: D.sans }}>
              Submission History
            </h1>
            <p style={{ fontSize: 13, color: D.textMuted, margin: "4px 0 0" }}>
              View and export your daily report archive
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="mrp-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: D.mono, fontSize: 11, fontWeight: 500,
                border: `1px solid ${D.border}`, borderRadius: D.rs,
                background: "transparent", color: D.textMuted,
                padding: "7px 14px", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <RefreshCw size={12} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
              {refreshing ? "refreshing…" : "refresh"}
            </button>
            <button
              className="mrp-btn-accent"
              onClick={exportCSV}
              disabled={!allReports.length}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: D.mono, fontSize: 11, fontWeight: 500,
                border: `1px solid ${D.accent}40`, borderRadius: D.rs,
                background: D.accentDim, color: D.accent,
                padding: "7px 14px", cursor: "pointer", transition: "opacity 0.15s",
                boxShadow: `0 0 10px ${D.accent}15`,
              }}
            >
              <Download size={12} />
              export_csv
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10, marginBottom: 16,
        }}>
          <StatCard label="total_reports" value={stats.total}  accent={D.text}  dim={D.raised}   Icon={FileText}    />
          <StatCard label="total_hours"   value={`${stats.hrs}h`} accent={D.accent} dim={D.accentDim} Icon={Clock}  />
          <StatCard label="completed"     value={stats.done}   accent={D.green} dim={D.greenDim} Icon={CheckCircle2} sub={`${stats.rate}% rate`} />
          <StatCard label="pending"       value={stats.pend}   accent={D.amber} dim={D.amberDim} Icon={AlertCircle}  />
          <StatCard label="cancelled"     value={stats.canc}   accent={D.red}   dim={D.redDim}   Icon={XCircle}      />
        </div>

        {/* ── Filter bar ── */}
        <div style={{
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: D.r, padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} color={D.textDim} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search descriptions or dates…"
                style={{
                  width: "100%", fontFamily: D.mono, fontSize: 12,
                  background: D.raised, border: `1px solid ${D.border}`,
                  borderRadius: D.rs, padding: "7px 10px 7px 30px",
                  color: D.text, transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
            </div>

            {/* Status filter */}
            <div style={{ display: "flex", gap: 5 }}>
              {(["all", "completed", "pending", "cancelled"] as StatusFilter[]).map((v) => {
                const isActive = statusFilt === v;
                const col = v === "all" ? D.textMuted
                  : v === "completed" ? D.green
                  : v === "pending"   ? D.amber : D.red;
                return (
                  <button
                    key={v}
                    onClick={() => setStatusFilt(v)}
                    className={`mrp-filter-chip${isActive ? " active" : ""}`}
                    style={{
                      fontFamily: D.mono, fontSize: 10, fontWeight: 500,
                      padding: "5px 10px", borderRadius: 20,
                      background: isActive ? (v === "all" ? D.raised : STATUS_MAP[v as keyof typeof STATUS_MAP]?.dim ?? D.raised) : "transparent",
                      color: isActive ? (v === "all" ? D.text : col) : D.textDim,
                      border: `1px solid ${isActive ? col + "40" : D.border}`,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>

            {/* Date range */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              style={{
                fontFamily: D.mono, fontSize: 11,
                background: D.raised, border: `1px solid ${D.border}`,
                borderRadius: D.rs, padding: "6px 10px",
                color: D.textMuted, cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <option value="all">all_time</option>
              <option value="week">last_7d</option>
              <option value="month">last_30d</option>
              <option value="year">last_year</option>
            </select>

            {/* Reset */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mrp-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontFamily: D.mono, fontSize: 10, color: D.textDim,
                  background: "transparent", border: `1px solid ${D.border}`,
                  borderRadius: D.rs, padding: "5px 10px",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <FilterX size={11} />
                reset
              </button>
            )}
          </div>
        </div>

        {/* ── Results meta ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textDim }}>
            showing <span style={{ color: D.textMuted }}>{paginated.length}</span> of <span style={{ color: D.textMuted }}>{filtered.length}</span> report{filtered.length !== 1 ? "s" : ""}
            {hasFilters && (
              <span style={{ color: D.amber }}> (filtered)</span>
            )}
          </span>
          {totalPages > 1 && (
            <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textDim }}>
              page {page}/{totalPages}
            </span>
          )}
        </div>

        {/* ── Report list or empty state ── */}
        {filtered.length === 0 ? (
          <div style={{
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: D.r, padding: "56px 20px",
            textAlign: "center",
          }}>
            <FileText size={32} color={D.textDim} style={{ margin: "0 auto 14px" }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: D.text, fontFamily: D.sans, marginBottom: 6 }}>
              {hasFilters ? "no_results_found" : "no_reports_yet"}
            </div>
            <div style={{ fontSize: 12, color: D.textDim, fontFamily: D.mono, marginBottom: 16 }}>
              {hasFilters
                ? "// no reports match the current filter criteria"
                : "// submit your first daily report to see it here"}
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mrp-btn"
                style={{
                  fontFamily: D.mono, fontSize: 11, color: D.textMuted,
                  background: "transparent", border: `1px solid ${D.border}`,
                  borderRadius: D.rs, padding: "7px 16px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                clear_filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paginated.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onView={() => setSelected(report)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 20, marginTop: 4,
          }}>
            <button
              className="mrp-page-btn mrp-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: D.mono, fontSize: 11, color: D.textMuted,
                background: "transparent", border: `1px solid ${D.border}`,
                borderRadius: D.rs, padding: "7px 14px", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <ChevronLeft size={13} /> prev
            </button>

            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1
                  : page <= 4 ? i + 1
                  : page >= totalPages - 3 ? totalPages - 6 + i
                  : page - 3 + i;
                const isActive = pg === page;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    style={{
                      width: 30, height: 30, borderRadius: D.rs,
                      fontFamily: D.mono, fontSize: 11, fontWeight: 500,
                      background: isActive ? D.accentDim : "transparent",
                      color: isActive ? D.accent : D.textDim,
                      border: `1px solid ${isActive ? D.accent + "40" : D.border}`,
                      cursor: "pointer", transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {pg}
                  </button>
                );
              })}
            </div>

            <button
              className="mrp-page-btn mrp-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: D.mono, fontSize: 11, color: D.textMuted,
                background: "transparent", border: `1px solid ${D.border}`,
                borderRadius: D.rs, padding: "7px 14px", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              next <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selected && (
        <ReportModal report={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
};

export default MyReportsPage;