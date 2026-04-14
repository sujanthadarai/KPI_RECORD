import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users, BookOpen, CheckCircle2, Clock, RefreshCw, Download,
  TrendingUp, AlertCircle, Award, BarChart3, PieChart as PieChartIcon,
  FileText, Filter, X, ShieldAlert, Activity, UserCheck,
  ArrowUpRight, ArrowDownRight, Target, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types (Matching Backend Response)
// ─────────────────────────────────────────────────────────────────────────────

type SlotStatus = "completed" | "pending" | "cancelled";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  description: string;
  status: SlotStatus;
}

interface Report {
  id: number;
  instructor: number;
  instructor_name: string;
  date: string;
  time_slots: TimeSlot[];
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: number;
  instructor: number;
  instructor_name: string;
  date: string;
  leave_type: string;
  check_in?: string;
  check_out?: string;
  is_late: boolean;
  is_early_leave: boolean;
  notes?: string;
}

interface KPIResponse {
  instructorId: number;
  instructorName: string;
  attendanceScore: number;
  taskCompletionScore: number;
  timeDisciplineScore: number;
  finalKPI: number;
  totalWorkingHours: number;
  totalClasses: number;
  missedClasses: number;
  presentDays: number;
  totalDays: number;
}

interface Instructor {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

const STATUS_STYLES: Record<SlotStatus, string> = {
  completed: "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/[0.08] text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/[0.08] text-red-400 border-red-500/20",
};

const METRIC_OPTIONS: { value: keyof KPIMetrics; label: string }[] = [
  { value: "finalKPI", label: "KPI Score" },
  { value: "attendanceScore", label: "Attendance" },
  { value: "taskCompletionScore", label: "Completion" },
  { value: "timeDisciplineScore", label: "Discipline" },
];

interface KPIMetrics {
  finalKPI: number;
  attendanceScore: number;
  taskCompletionScore: number;
  timeDisciplineScore: number;
}

const TODAY = new Date().toISOString().split("T")[0];

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.07)",
    background: "#1a1f2e",
    fontSize: 12,
    color: "#fff",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
};

const AXIS_STYLE = { fontSize: 11, fill: "rgba(255,255,255,0.25)" };
const GRID_PROPS = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.04)" };

const AVATAR_PALETTE = [
  { bg: "bg-sky-500/15", text: "text-sky-300" },
  { bg: "bg-teal-500/15", text: "text-teal-300" },
  { bg: "bg-amber-500/15", text: "text-amber-300" },
  { bg: "bg-violet-500/15", text: "text-violet-300" },
  { bg: "bg-rose-500/15", text: "text-rose-300" },
  { bg: "bg-cyan-500/15", text: "text-cyan-300" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const toCSV = (headers: string[], rows: (string | number)[][]): string =>
  [headers, ...rows].map((r) => r.join(",")).join("\n");

const kpiColor = (v: number) => v >= 80 ? "text-emerald-400" : v >= 60 ? "text-amber-400" : "text-red-400";
const kpiAccent = (v: number) => v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";
const getInitials = (name: string) =>
  name?.trim().split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "??";

// ─────────────────────────────────────────────────────────────────────────────
// UI Atoms
// ─────────────────────────────────────────────────────────────────────────────

const Panel = memo(({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141720]", className)}>
    {children}
  </div>
));
Panel.displayName = "Panel";

const PanelHeader = memo(({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
    {children}
  </div>
));
PanelHeader.displayName = "PanelHeader";

const SectionTitle = memo(({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-white/30" />
    <span className="text-sm font-semibold text-white">{title}</span>
    {count !== undefined && (
      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-white/30">{count}</span>
    )}
  </div>
));
SectionTitle.displayName = "SectionTitle";

const EmptyState = memo(({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-14 gap-3">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
      <AlertCircle className="h-5 w-5 text-white/15" />
    </div>
    <p className="text-sm text-white/25">{message}</p>
  </div>
));
EmptyState.displayName = "EmptyState";

const IconButton = memo(({ onClick, disabled, label, children }: {
  onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-xs text-white/40 transition-all hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
  >
    {children}
    {label}
  </button>
));
IconButton.displayName = "IconButton";

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  trendNeutral?: boolean;
}

const MetricCard = memo(({ icon: Icon, label, value, accent, subtitle, trend, trendUp, trendNeutral }: MetricCardProps) => (
  <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141720] p-5 transition-all duration-300 hover:border-white/[0.09] hover:bg-[#161c28]">
    <div
      className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-70"
      style={{ background: accent, opacity: 0.06 }}
    />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">{label}</p>
        <p className="mt-2 text-[28px] font-light tracking-tight text-white leading-none">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-white/25">{subtitle}</p>}
        {trend && (
          <div className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px] font-medium",
            trendNeutral ? "text-white/30" : trendUp ? "text-emerald-400" : "text-red-400"
          )}>
            {!trendNeutral && (trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
            {trend}
          </div>
        )}
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${accent}18` }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: accent }} />
      </div>
    </div>
  </div>
));
MetricCard.displayName = "MetricCard";

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const DashboardSkeleton = memo(() => (
  <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-4 w-72 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-lg bg-white/[0.04]" />)}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.04]" />)}
    </div>
    <div className="grid gap-5 lg:grid-cols-3">
      <Skeleton className="h-80 rounded-2xl bg-white/[0.04] lg:col-span-2" />
      <Skeleton className="h-80 rounded-2xl bg-white/[0.04]" />
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
    </div>
    <Skeleton className="h-96 rounded-2xl bg-white/[0.04]" />
    <Skeleton className="h-80 rounded-2xl bg-white/[0.04]" />
  </div>
));
DashboardSkeleton.displayName = "DashboardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [filterDate, setFilterDate] = useState(TODAY);
  const [filterInstructor, setFilterInstructor] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "area" | "line">("bar");
  const [selectedMetric, setSelectedMetric] = useState<keyof KPIMetrics>("finalKPI");
  const [showFilters, setShowFilters] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [kpis, setKpis] = useState<KPIResponse[]>([]);

  // ── Store ──────────────────────────────────────────────────────────────────
  const currentUser = useAppStore((s) => s.currentUser);
  const instructors = useAppStore((s) => s.instructors) as Instructor[];
  const fetchInstructors = useAppStore((s) => s.fetchInstructors);

  // ── API Functions ─────────────────────────────────────────────────────────
  const API_BASE = "http://localhost:8000/api";
  
  const getAuthToken = () => localStorage.getItem("access_token");

  const fetchReports = useCallback(async (date: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/reports/by-date/?date=${date}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setReports(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast.error("Failed to load reports");
    }
  }, []);

  const fetchAttendance = useCallback(async (date: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/attendance/by-date/?date=${date}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch attendance");
      const data = await response.json();
      setAttendanceData(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Fetch attendance error:", error);
      toast.error("Failed to load attendance");
    }
  }, []);

  const fetchKPIs = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/kpi/all/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch KPIs");
      const data = await response.json();
      setKpis(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch KPIs error:", error);
      toast.error("Failed to load KPIs");
    }
  }, []);

  // ── Initialization ─────────────────────────────────────────────────────────
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchInstructors(),
        fetchKPIs(),
        fetchReports(TODAY),
        fetchAttendance(TODAY),
      ]);
    };
    initializeData();
  }, [fetchInstructors, fetchKPIs, fetchReports, fetchAttendance]);

  // ── Refresh on date change ────────────────────────────────────────────────
  useEffect(() => {
    if (filterDate) {
      fetchReports(filterDate);
      fetchAttendance(filterDate);
    }
  }, [filterDate, fetchReports, fetchAttendance]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-[#141720] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <ShieldAlert className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-sm text-white/35">
            This area is limited to administrators.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived data with memoization ─────────────────────────────────────────
  const todayReports = useMemo(() => reports, [reports]);
  const todayAttendance = useMemo(() => attendanceData, [attendanceData]);

  const stats = useMemo(() => {
    const present = todayAttendance.filter((a) => a.leave_type === "present").length;
    const late = todayAttendance.filter((a) => a.is_late).length;
    const absent = todayAttendance.filter((a) => a.leave_type === "absent").length;
    const onLeave = todayAttendance.filter((a) => a.leave_type === "leave").length;
    const halfDay = todayAttendance.filter((a) => a.leave_type === "half_day").length;
    const total = todayAttendance.length;

    const allSlots = todayReports.flatMap((r) => r.time_slots || []);
    const totalSlots = allSlots.length;
    const completed = allSlots.filter((s) => s.status === "completed").length;
    const pending = allSlots.filter((s) => s.status === "pending").length;
    const cancelled = allSlots.filter((s) => s.status === "cancelled").length;
    const compRate = totalSlots > 0 ? Math.round((completed / totalSlots) * 100) : 0;

    const avgKPI = kpis.length ? Math.round(kpis.reduce((s, k) => s + k.finalKPI, 0) / kpis.length) : 0;
    const totalHours = kpis.reduce((s, k) => s + k.totalWorkingHours, 0);
    const missed = kpis.reduce((s, k) => s + k.missedClasses, 0);
    const topKPI = [...kpis].sort((a, b) => b.finalKPI - a.finalKPI)[0];
    const attendRate = total > 0 ? Math.round((present / total) * 100) : 0;
    const totalClasses = kpis.reduce((s, k) => s + k.totalClasses, 0);

    return {
      present, late, absent, onLeave, halfDay, total,
      totalSlots, completed, pending, cancelled, compRate,
      avgKPI, totalHours, missed, topKPI, attendRate,
      totalInstructors: instructors.length,
      totalClasses,
    };
  }, [todayAttendance, todayReports, kpis, instructors.length]);

  const chartData = useMemo(() => {
    const kpiBarData = kpis.map((k) => ({
      name: k.instructorName?.split(" ")[0] || "Unknown",
      fullName: k.instructorName || "Unknown",
      attendanceScore: k.attendanceScore || 0,
      taskCompletionScore: k.taskCompletionScore || 0,
      timeDisciplineScore: k.timeDisciplineScore || 0,
      finalKPI: k.finalKPI || 0,
    }));

    const statusData = todayReports
      .flatMap((r) => r.time_slots || [])
      .reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const performanceData = kpis
      .map((k) => ({
        id: k.instructorId,
        name: k.instructorName?.split(" ")[0] || "Unknown",
        fullName: k.instructorName || "Unknown",
        score: k.finalKPI || 0,
        classes: k.totalClasses || 0,
        hours: k.totalWorkingHours || 0,
        attendance: k.attendanceScore || 0,
        completion: k.taskCompletionScore || 0,
        discipline: k.timeDisciplineScore || 0,
        missed: k.missedClasses || 0,
      }))
      .sort((a, b) => b.score - a.score);

    const topPerf = performanceData[0];
    const radarData = topPerf
      ? [
          { subject: "KPI", value: topPerf.score },
          { subject: "Attendance", value: topPerf.attendance },
          { subject: "Completion", value: topPerf.completion },
          { subject: "Discipline", value: topPerf.discipline },
          { subject: "Activity", value: Math.min(topPerf.classes * 5, 100) },
        ]
      : [];

    const attendancePie = [
      { name: "Present", value: stats.present },
      { name: "Absent", value: stats.absent },
      { name: "Late", value: stats.late },
      { name: "On Leave", value: stats.onLeave },
      { name: "Half Day", value: stats.halfDay },
    ].filter((d) => d.value > 0);

    return { kpiBarData, statusData, performanceData, radarData, attendancePie };
  }, [kpis, todayReports, stats]);

  const pieData = useMemo(
    () => Object.entries(chartData.statusData).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    })),
    [chartData.statusData]
  );

  // Filter reports by instructor
  const filteredReports = useMemo(
    () => filterInstructor === "all"
      ? todayReports
      : todayReports.filter((r) => String(r.instructor) === String(filterInstructor)),
    [todayReports, filterInstructor]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchReports(filterDate),
        fetchAttendance(filterDate),
        fetchKPIs(),
        fetchInstructors(),
      ]);
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsRefreshing(false);
    }
  }, [filterDate, fetchReports, fetchAttendance, fetchKPIs, fetchInstructors]);

  const handleExportReports = useCallback(() => {
    if (!filteredReports.length) {
      toast.error("No reports to export");
      return;
    }
    try {
      const headers = ["Instructor", "Date", "Start", "End", "Description", "Status"];
      const rows = filteredReports.flatMap((r) => {
        const instructor = instructors.find(i => i.id === r.instructor);
        const name = instructor?.name || r.instructor_name || "Unknown";
        return (r.time_slots || []).map((s) => [
          name, r.date, s.start_time, s.end_time,
          `"${s.description?.replace(/"/g, '""') || ""}"`,
          s.status
        ]);
      });
      downloadCSV(toCSV(headers, rows), `reports-${filterDate}.csv`);
      toast.success(`Exported ${filteredReports.length} reports`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export reports");
    }
  }, [filteredReports, instructors, filterDate]);

  const handleExportKPIs = useCallback(() => {
    if (!kpis.length) {
      toast.error("No KPI data to export");
      return;
    }
    try {
      const headers = ["Instructor", "KPI", "Attendance", "Completion", "Discipline", "Hours", "Classes", "Missed"];
      const rows = kpis.map((k) => [
        k.instructorName || "Unknown",
        k.finalKPI || 0,
        k.attendanceScore || 0,
        k.taskCompletionScore || 0,
        k.timeDisciplineScore || 0,
        k.totalWorkingHours || 0,
        k.totalClasses || 0,
        k.missedClasses || 0,
      ]);
      downloadCSV(toCSV(headers, rows), `kpi-${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast.success("KPIs exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export KPIs");
    }
  }, [kpis]);

  // ── Chart renderer ─────────────────────────────────────────────────────────
  const renderMainChart = useCallback(() => {
    const data = chartData.kpiBarData;
    if (!data.length) {
      return <EmptyState message="No KPI data available" />;
    }

    const shared = { data, margin: { top: 5, right: 5, left: -20, bottom: 5 } };
    const tooltipProps = { ...TOOLTIP_STYLE, formatter: (v: number) => [`${v}%`, ""] };

    if (chartType === "area") return (
      <AreaChart {...shared}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" tick={AXIS_STYLE} />
        <YAxis domain={[0, 100]} tick={AXIS_STYLE} />
        <Tooltip {...tooltipProps} />
        <Area type="monotone" dataKey={selectedMetric} stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.12} strokeWidth={2} />
      </AreaChart>
    );
    if (chartType === "line") return (
      <LineChart {...shared}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" tick={AXIS_STYLE} />
        <YAxis domain={[0, 100]} tick={AXIS_STYLE} />
        <Tooltip {...tooltipProps} />
        <Line type="monotone" dataKey={selectedMetric} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS[0] }} activeDot={{ r: 6 }} />
      </LineChart>
    );
    return (
      <BarChart {...shared}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" tick={AXIS_STYLE} />
        <YAxis domain={[0, 100]} tick={AXIS_STYLE} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey={selectedMetric} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    );
  }, [chartType, selectedMetric, chartData.kpiBarData]);

  // ── Loading state ──────────────────────────────────────────────────────────
  const isLoading = !reports.length && !attendanceData.length && !kpis.length && !instructors.length;
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/30">
            {format(new Date(filterDate), "EEEE, MMMM d, yyyy")} · All staff overview
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton onClick={handleExportKPIs} disabled={!kpis.length} label="Export KPIs">
            <Download className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={handleExportReports} disabled={!filteredReports.length} label="Export Reports">
            <Download className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={handleRefresh} disabled={isRefreshing} label="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </IconButton>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Staff" value={stats.totalInstructors} accent="#3b82f6" trend="Registered" trendNeutral />
        <MetricCard icon={UserCheck} label="Present Today" value={stats.present} accent="#10b981"
          subtitle={`${stats.attendRate}% attendance rate`}
          trend={stats.late > 0 ? `${stats.late} late arrival${stats.late > 1 ? "s" : ""}` : "All on time"}
          trendUp={stats.late === 0}
        />
        <MetricCard icon={BookOpen} label="Total Classes" value={stats.totalSlots} accent="#06b6d4"
          subtitle={`${stats.completed} done · ${stats.pending} pending`}
          trend={`${stats.compRate}% completion`}
          trendUp={stats.compRate >= 80}
        />
        <MetricCard icon={TrendingUp} label="Avg KPI Score" value={`${stats.avgKPI}%`} accent={kpiAccent(stats.avgKPI)}
          trend={stats.avgKPI >= 80 ? "Excellent" : stats.avgKPI >= 60 ? "Good" : "Needs Attention"}
          trendUp={stats.avgKPI >= 80}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Clock} label="Total Hours" value={`${stats.totalHours.toFixed(1)}h`} accent="#8b5cf6" subtitle="All staff combined" trendNeutral />
        <MetricCard icon={AlertCircle} label="Missed Classes" value={stats.missed} accent="#ef4444"
          trend={stats.missed === 0 ? "Perfect record" : "Requires review"}
          trendUp={stats.missed === 0}
        />
        <MetricCard icon={Activity} label="Total Classes" value={stats.totalClasses} accent="#f59e0b" subtitle="Across all KPIs" trendNeutral />
        <MetricCard icon={Zap} label="Top Performer" value={stats.topKPI ? `${stats.topKPI.finalKPI}%` : "—"} accent="#ec4899"
          subtitle={stats.topKPI?.instructorName?.split(" ")[0] || "None"}
          trendNeutral
        />
      </div>

      {/* Row 1: KPI Chart + Attendance Donut */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <SectionTitle icon={BarChart3} title="KPI Breakdown by Instructor" />
            <div className="flex items-center gap-2">
              <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as keyof KPIMetrics)}>
                <SelectTrigger className="h-7 w-32 border-white/[0.07] bg-white/[0.04] text-xs text-white focus:ring-1 focus:ring-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#1a1f2e] text-white">
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex overflow-hidden rounded-lg border border-white/[0.06] bg-[#0e1118] p-0.5">
                {(["bar", "area", "line"] as const).map((t) => (
                  <button key={t} onClick={() => setChartType(t)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-all",
                      chartType === t ? "bg-white/[0.09] text-white" : "text-white/25 hover:text-white/60"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </PanelHeader>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={300}>
              {renderMainChart()}
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Attendance Today Donut */}
        <Panel>
          <PanelHeader>
            <SectionTitle icon={UserCheck} title="Attendance Today" />
            <span className="text-xs text-white/25">{stats.total} staff</span>
          </PanelHeader>
          <div className="p-5">
            {chartData.attendancePie.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={chartData.attendancePie} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={78} dataKey="value" strokeWidth={0}>
                      {chartData.attendancePie.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {chartData.attendancePie.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                        <span className="text-xs text-white/40">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white/70">{d.value}</span>
                        <span className="text-[10px] text-white/20">
                          {stats.total > 0 ? `${Math.round((d.value / stats.total) * 100)}%` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState message="No attendance data" />}
          </div>
        </Panel>
      </div>

      {/* Row 2: Task Status Pie + Top Performer Radar */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <SectionTitle icon={PieChartIcon} title="Task Status Distribution" />
            <span className="text-xs text-white/25">{stats.totalSlots} slots total</span>
          </PanelHeader>
          <div className="p-5">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85} dataKey="value" strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 flex justify-center gap-6">
                  {[
                    { label: "Completed", value: stats.completed, color: "#10b981" },
                    { label: "Pending", value: stats.pending, color: "#f59e0b" },
                    { label: "Cancelled", value: stats.cancelled, color: "#ef4444" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-2xl font-light text-white">{s.value}</p>
                      <div className="flex items-center gap-1 justify-center mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-[10px] text-white/25">{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState message="No task data for this date" />}
          </div>
        </Panel>

        {/* Top Performer Radar */}
        <Panel>
          <PanelHeader>
            <SectionTitle icon={Target} title="Top Performer Profile" />
            {stats.topKPI && <span className="text-xs text-white/30">{stats.topKPI.instructorName}</span>}
          </PanelHeader>
          <div className="p-5">
            {chartData.radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={chartData.radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2} />
                  <Tooltip {...TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No performance data available" />}
          </div>
        </Panel>
      </div>

      {/* Staff Leaderboard */}
      <Panel>
        <PanelHeader>
          <SectionTitle icon={Award} title="Staff Leaderboard" count={Math.min(chartData.performanceData.length, 5)} />
        </PanelHeader>
        <div className="divide-y divide-white/[0.03]">
          {chartData.performanceData.length > 0 ? (
            chartData.performanceData.slice(0, 5).map((p, i) => {
              const c = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
              return (
                <div key={p.id || i} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.018]">
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    i === 0 ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.04] text-white/30"
                  )}>
                    {i + 1}
                  </span>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold", c.bg, c.text)}>
                    {getInitials(p.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/85">{p.fullName}</p>
                    <p className="text-xs text-white/25">
                      {p.classes} classes · {p.hours}h worked
                      {p.missed > 0 && <span className="ml-1 text-red-400/60">· {p.missed} missed</span>}
                    </p>
                  </div>
                  <div className="hidden items-center gap-4 text-xs sm:flex">
                    {[
                      { label: "Attend", value: p.attendance },
                      { label: "Complet", value: p.completion },
                      { label: "Discipl", value: p.discipline },
                    ].map((m) => (
                      <div key={m.label} className="text-center">
                        <p className={cn("font-semibold", kpiColor(m.value))}>{m.value}%</p>
                        <p className="text-white/20">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-lg font-light", kpiColor(p.score))}>{p.score}%</p>
                    <p className="text-[10px] text-white/20">KPI</p>
                  </div>
                </div>
              );
            })
          ) : <EmptyState message="No performance data available" />}
        </div>
      </Panel>

      {/* Daily Reports - FIXED SECTION */}
      <Panel>
        <PanelHeader>
          <SectionTitle
            icon={FileText}
            title="Daily Reports"
            count={filteredReports.reduce((s, r) => s + (r.time_slots?.length || 0), 0)}
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all",
              showFilters
                ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                : "border-white/[0.06] text-white/30 hover:border-white/10 hover:text-white/60"
            )}
          >
            <Filter className="h-3 w-3" />
            Filters
          </button>
        </PanelHeader>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-4 border-b border-white/[0.05] bg-white/[0.015] px-5 py-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">Date</label>
              <Input
                type="date" value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)} max={TODAY}
                className="h-8 w-40 border-white/[0.07] bg-white/[0.04] text-sm text-white focus-visible:ring-1 focus-visible:ring-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">Instructor</label>
              <Select value={filterInstructor} onValueChange={setFilterInstructor}>
                <SelectTrigger className="h-8 w-48 border-white/[0.07] bg-white/[0.04] text-sm text-white">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#1a1f2e] text-white">
                  <SelectItem value="all">All Staff ({instructors.length})</SelectItem>
                  {instructors.map((i) => (
                    <SelectItem key={String(i.id)} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filterInstructor !== "all" && (
              <button onClick={() => setFilterInstructor("all")}
                className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-white/30 hover:bg-white/[0.05] hover:text-white">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-white/20">
              {filteredReports.reduce((s, r) => s + (r.time_slots?.length || 0), 0)} report(s)
            </span>
          </div>
        )}

        {filteredReports.length === 0 ? (
          <EmptyState message="No reports found for the selected criteria" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Instructor</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Time</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Description</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredReports.flatMap((report) => {
                  const instructor = instructors.find(i => i.id === report.instructor);
                  const instructorName = instructor?.name || report.instructor_name || "Unknown";
                  return (report.time_slots || []).map((slot, idx) => (
                    <tr key={`${report.id}-${idx}`} className="transition-colors hover:bg-white/[0.018]">
                      <td className="px-5 py-3 font-medium text-white/80 whitespace-nowrap">
                        {idx === 0 ? instructorName : ""}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-white/40 whitespace-nowrap">
                        {slot.start_time} – {slot.end_time}
                      </td>
                      <td className="max-w-sm px-5 py-3">
                        <p className="truncate text-sm text-white/60" title={slot.description}>
                          {slot.description || "No description"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={cn("text-[11px]", STATUS_STYLES[slot.status] || "")}>
                          {slot.status}
                        </Badge>
                       </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AdminDashboard;