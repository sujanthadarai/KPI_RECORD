import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  UserPlus,
  Mail,
  TrendingUp,
  BookOpen,
  Clock,
  Award,
  RefreshCw,
  Users,
  ChevronDown,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SortKey   = "name" | "kpi" | "classes" | "hours" | "attendance";
type FilterKey = "all" | "excellent" | "good" | "needs-attention";

interface Instructor {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  joinedAt?: string;
}

interface KPIRecord {
  instructorId: string;
  instructorName: string;
  finalKPI: number;
  attendanceScore: number;
  taskCompletionScore: number;
  timeDisciplineScore: number;
  totalWorkingHours: number;
  totalClasses: number;
  missedClasses: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name",       label: "Name"          },
  { value: "kpi",        label: "KPI Score"     },
  { value: "classes",    label: "Total Classes" },
  { value: "hours",      label: "Working Hours" },
  { value: "attendance", label: "Attendance"    },
];

const FILTER_OPTIONS: { value: FilterKey; label: string; accent: string }[] = [
  { value: "all",             label: "All",             accent: "#ffffff" },
  { value: "excellent",       label: "Excellent",       accent: "#10b981" },
  { value: "good",            label: "Good",            accent: "#f59e0b" },
  { value: "needs-attention", label: "Needs Attention", accent: "#ef4444" },
];

const AVATAR_PALETTE = [
  { bg: "bg-sky-500/15",    text: "text-sky-300"    },
  { bg: "bg-teal-500/15",   text: "text-teal-300"   },
  { bg: "bg-amber-500/15",  text: "text-amber-300"  },
  { bg: "bg-violet-500/15", text: "text-violet-300" },
  { bg: "bg-rose-500/15",   text: "text-rose-300"   },
  { bg: "bg-cyan-500/15",   text: "text-cyan-300"   },
  { bg: "bg-lime-500/15",   text: "text-lime-300"   },
  { bg: "bg-pink-500/15",   text: "text-pink-300"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);

const hashIndex = (s: string) =>
  String(s ?? "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

const kpiTier = (score: number): FilterKey =>
  score >= 80 ? "excellent" : score >= 60 ? "good" : "needs-attention";

const kpiColor = (score: number) =>
  score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";

const kpiAccent = (score: number) =>
  score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

const kpiLabel = (score: number) =>
  score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Needs Attention";

const kpiBadgeStyle = (score: number) =>
  score >= 80
    ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20"
    : score >= 60
    ? "bg-amber-500/[0.08] text-amber-400 border-amber-500/20"
    : "bg-red-500/[0.08] text-red-400 border-red-500/20";

// ─────────────────────────────────────────────────────────────────────────────
// UI Atoms
// ─────────────────────────────────────────────────────────────────────────────

const MiniBar = memo(({ value, accent }: { value: number; accent: string }) => (
  <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.04]">
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(value, 100)}%`, background: accent }}
    />
  </div>
));
MiniBar.displayName = "MiniBar";

const StatPill = memo(
  ({
    icon: Icon,
    label,
    value,
    accent,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    accent: string;
  }) => (
    <div className="flex flex-col items-center rounded-xl bg-white/[0.03] p-3 text-center">
      <Icon className="mb-1 h-3.5 w-3.5" style={{ color: accent }} />
      <p className="text-base font-light text-white leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/20">{label}</p>
    </div>
  )
);
StatPill.displayName = "StatPill";

// ─────────────────────────────────────────────────────────────────────────────
// Summary Metric Card (top row)
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
}

const MetricCard = memo(({ icon: Icon, label, value, accent, sub }: MetricCardProps) => (
  <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141720] p-5 transition-all duration-300 hover:border-white/[0.09]">
    <div
      className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full blur-2xl"
      style={{ background: accent, opacity: 0.07 }}
    />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">{label}</p>
        <p className="mt-2 text-[26px] font-light tracking-tight text-white leading-none">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-white/25">{sub}</p>}
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${accent}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
    </div>
  </div>
));
MetricCard.displayName = "MetricCard";

// ─────────────────────────────────────────────────────────────────────────────
// Instructor Card
// ─────────────────────────────────────────────────────────────────────────────

interface InstructorCardProps {
  inst: Instructor;
  kpi?: KPIRecord;
  index: number;
}

const InstructorCard = memo(({ inst, kpi, index }: InstructorCardProps) => {
  const palette = AVATAR_PALETTE[hashIndex(inst.id) % AVATAR_PALETTE.length];
  const accent  = kpi ? kpiAccent(kpi.finalKPI) : "#4f8ef7";

  return (
    <Link
      to={`/admin/instructors/${inst.id}`}
      className="group block rounded-2xl border border-white/[0.05] bg-[#141720] transition-all duration-300 hover:border-white/[0.10] hover:bg-[#161c28] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
    >
      {/* Top accent line */}
      <div
        className="h-[2px] w-full rounded-t-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accent}60, transparent)` }}
      />

      <div className="p-5">
        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                palette.bg,
                palette.text
              )}
            >
              {getInitials(inst.name)}
            </span>

            <div className="min-w-0">
              <p className="truncate font-semibold text-white/90 leading-snug">{inst.name}</p>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-white/30">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{inst.email}</span>
              </div>
            </div>
          </div>

          {/* KPI badge */}
          {kpi && (
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px] font-medium", kpiBadgeStyle(kpi.finalKPI))}
            >
              {kpiLabel(kpi.finalKPI)}
            </Badge>
          )}
        </div>

        {/* ── KPI Score ──────────────────────────── */}
        {kpi ? (
          <>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">
                  KPI Score
                </p>
                <p className={cn("text-3xl font-light leading-none mt-1", kpiColor(kpi.finalKPI))}>
                  {kpi.finalKPI}%
                </p>
              </div>
              {/* Trend icon placeholder — real data would compare periods */}
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${accent}15` }}
              >
                <TrendingUp className="h-4 w-4" style={{ color: accent }} />
              </div>
            </div>

            {/* Progress bar */}
            <MiniBar value={kpi.finalKPI} accent={accent} />

            {/* ── Sub-score pills ─────────────────── */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatPill icon={BarChart3} label="Classes"    value={kpi.totalClasses}           accent="#3b82f6" />
              <StatPill icon={Clock}     label="Hours"      value={`${kpi.totalWorkingHours}h`} accent="#8b5cf6" />
              <StatPill icon={CheckCircle2} label="Attend" value={`${kpi.attendanceScore}%`}   accent="#10b981" />
            </div>

            {/* ── Footer row ──────────────────────── */}
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-[11px]">
              <div className="flex gap-3">
                <span className="text-white/25">
                  Completion:{" "}
                  <span className="font-medium text-white/55">{kpi.taskCompletionScore}%</span>
                </span>
                <span className="text-white/25">
                  Discipline:{" "}
                  <span className="font-medium text-white/55">{kpi.timeDisciplineScore}%</span>
                </span>
              </div>
              {kpi.missedClasses > 0 && (
                <span className="flex items-center gap-1 text-red-400/70">
                  <AlertCircle className="h-3 w-3" />
                  {kpi.missedClasses} missed
                </span>
              )}
            </div>
          </>
        ) : (
          // No KPI data state
          <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-white/[0.05] py-5">
            <p className="text-xs text-white/20">No KPI data yet</p>
          </div>
        )}
      </div>

      {/* View detail hint */}
      <div className="flex items-center justify-end border-t border-white/[0.04] px-5 py-2.5">
        <span className="flex items-center gap-1 text-[10px] text-white/15 transition-colors group-hover:text-white/40">
          View profile
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
});
InstructorCard.displayName = "InstructorCard";

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const PageSkeleton = memo(() => (
  <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-4 w-64 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-9 w-36 rounded-lg bg-white/[0.04]" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.04]" />)}
    </div>
    <Skeleton className="h-12 rounded-xl bg-white/[0.04]" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-60 rounded-2xl bg-white/[0.04]" />)}
    </div>
  </div>
));
PageSkeleton.displayName = "PageSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const InstructorsPage = () => {
  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState<SortKey>("kpi");
  const [filterTier,  setFilterTier]  = useState<FilterKey>("all");
  const [refreshing,  setRefreshing]  = useState(false);
  const [sortOpen,    setSortOpen]    = useState(false);

  // ── Store ──────────────────────────────────────────────────────────────────
  const instructors      = useAppStore((s) => s.instructors) as Instructor[];
  const getAllKPIs       = useAppStore((s) => s.getAllKPIs);
  const fetchInstructors = useAppStore((s) => s.fetchInstructors);
  const fetchKPIs        = useAppStore((s) => s.fetchKPIs);
  const loading          = useAppStore((s) => s.loading);

  const kpis = useMemo<KPIRecord[]>(() => getAllKPIs(), [getAllKPIs]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchInstructors(), fetchKPIs()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInstructors, fetchKPIs]);

  useEffect(() => { handleRefresh(); }, []); // eslint-disable-line

  // ── Derived lists ──────────────────────────────────────────────────────────
  const kpiMap = useMemo(
    () => new Map(kpis.map((k) => [k.instructorId, k])),
    [kpis]
  );

  const processed = useMemo(() => {
    const q = search.toLowerCase();
    return instructors
      .filter((inst) => {
        const matchesSearch =
          inst.name.toLowerCase().includes(q) ||
          inst.email.toLowerCase().includes(q) ||
          (inst.username?.toLowerCase().includes(q) ?? false);
        if (!matchesSearch) return false;

        if (filterTier === "all") return true;
        const kpi = kpiMap.get(inst.id);
        if (!kpi) return false;
        return kpiTier(kpi.finalKPI) === filterTier;
      })
      .sort((a, b) => {
        const kA = kpiMap.get(a.id);
        const kB = kpiMap.get(b.id);
        if (sortBy === "name")       return a.name.localeCompare(b.name);
        if (sortBy === "kpi")        return (kB?.finalKPI ?? 0) - (kA?.finalKPI ?? 0);
        if (sortBy === "classes")    return (kB?.totalClasses ?? 0) - (kA?.totalClasses ?? 0);
        if (sortBy === "hours")      return (kB?.totalWorkingHours ?? 0) - (kA?.totalWorkingHours ?? 0);
        if (sortBy === "attendance") return (kB?.attendanceScore ?? 0) - (kA?.attendanceScore ?? 0);
        return 0;
      });
  }, [instructors, kpiMap, search, sortBy, filterTier]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const avgKPI     = kpis.length ? Math.round(kpis.reduce((s, k) => s + k.finalKPI, 0) / kpis.length) : 0;
    const totalClass = kpis.reduce((s, k) => s + k.totalClasses, 0);
    const totalHours = kpis.reduce((s, k) => s + k.totalWorkingHours, 0);
    const topPerf    = [...kpis].sort((a, b) => b.finalKPI - a.finalKPI)[0];
    const excellent  = kpis.filter((k) => k.finalKPI >= 80).length;
    return { avgKPI, totalClass, totalHours, topPerf, excellent };
  }, [kpis]);

  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label ?? "KPI Score";

  if (loading && instructors.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Instructors</h1>
          <p className="mt-0.5 text-sm text-white/30">
            {instructors.length} registered · {summary.excellent} high performers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-xs text-white/40 transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-30"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-all hover:bg-blue-500">
            <UserPlus className="h-3.5 w-3.5" />
            Add Instructor
          </button>
        </div>
      </div>

      {/* ── Summary Metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Users}    label="Total Staff"     value={instructors.length} accent="#3b82f6" sub="All registered" />
        <MetricCard icon={Award}    label="Avg KPI Score"   value={`${summary.avgKPI}%`} accent={kpiAccent(summary.avgKPI)}
          sub={summary.avgKPI >= 80 ? "Excellent team" : summary.avgKPI >= 60 ? "Good standing" : "Needs attention"}
        />
        <MetricCard icon={BookOpen} label="Total Classes"   value={summary.totalClass}   accent="#06b6d4" sub="Across all staff" />
        <MetricCard icon={Clock}    label="Total Hours"     value={`${summary.totalHours.toFixed(0)}h`} accent="#8b5cf6" sub="Combined logged" />
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.05] bg-[#141720] px-4 py-3">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or username…"
            className="w-full bg-transparent pl-5 text-sm text-white outline-none placeholder:text-white/20"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-white/[0.06]" />

        {/* Tier filter tabs */}
        <div className="flex overflow-hidden rounded-lg border border-white/[0.05] bg-[#0e1118] p-0.5">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterTier(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                filterTier === f.value ? "bg-white/[0.09] text-white" : "text-white/25 hover:text-white/60"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeSortLabel}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sortOpen && "rotate-180")} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1f2e] py-1 shadow-2xl">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                  className={cn(
                    "flex w-full items-center px-4 py-2 text-xs transition-colors",
                    sortBy === opt.value ? "bg-white/[0.06] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  {sortBy === opt.value && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-400" />}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-[11px] text-white/20">
          {processed.length} of {instructors.length}
        </span>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {processed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
            <Users className="h-6 w-6 text-white/15" />
          </div>
          <p className="mt-4 text-sm font-medium text-white/30">No instructors found</p>
          <p className="mt-1 text-xs text-white/15">
            {search ? "Try adjusting your search or filter" : "No instructors are currently registered"}
          </p>
          {(search || filterTier !== "all") && (
            <button
              onClick={() => { setSearch(""); setFilterTier("all"); }}
              className="mt-4 rounded-lg border border-white/[0.06] px-4 py-2 text-xs text-white/30 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processed.map((inst, i) => (
            <InstructorCard
              key={inst.id}
              inst={inst}
              kpi={kpiMap.get(inst.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {processed.length > 0 && (
        <div className="flex items-center justify-between px-1 text-[11px] text-white/15">
          <span>
            Showing {processed.length} of {instructors.length} instructors
          </span>
          {summary.topPerf && (
            <span>
              Top performer:{" "}
              <span className="text-emerald-400/70">{summary.topPerf.instructorName} · {summary.topPerf.finalKPI}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default InstructorsPage;