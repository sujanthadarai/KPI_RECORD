import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Award, Clock, Calendar, Users, Target,
  AlertCircle, Download, RefreshCw, Filter, ChevronLeft, ChevronRight,
  TrendingDown, Minus, Star, Zap, Activity, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface Report {
  id: number;
  instructor: number;
  instructor_name: string;
  date: string;
  time_slots: TimeSlot[];
}

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  description: string;
  status: "completed" | "pending" | "cancelled";
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

interface Instructor {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface DailyStats {
  date: string;
  totalHours: number;
  completedTasks: number;
  attendance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

const CHART_COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
};

const API_BASE = "http://localhost:8000/api";

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

const getAuthToken = () => localStorage.getItem("access_token");

const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const calculateTotalHoursFromReports = (reports: Report[]): number => {
  let totalMinutes = 0;
  reports.forEach(report => {
    report.time_slots?.forEach(slot => {
      if (slot.start_time && slot.end_time && slot.status === "completed") {
        const [startHour, startMin] = slot.start_time.split(":").map(Number);
        const [endHour, endMin] = slot.end_time.split(":").map(Number);
        const startTotal = startHour * 60 + startMin;
        const endTotal = endHour * 60 + endMin;
        totalMinutes += endTotal - startTotal;
      }
    });
  });
  return totalMinutes / 60;
};

const calculateAttendanceRate = (attendance: AttendanceRecord[]): number => {
  if (attendance.length === 0) return 0;
  const presentDays = attendance.filter(a => a.leave_type === "present" || a.leave_type === "half_day").length;
  return Math.round((presentDays / attendance.length) * 100);
};

const kpiColor = (score: number): string => {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
};

const kpiBgColor = (score: number): string => {
  if (score >= 80) return "bg-emerald-500/20";
  if (score >= 60) return "bg-amber-500/20";
  return "bg-red-500/20";
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Component
// ─────────────────────────────────────────────────────────────────────────────

const KPISkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div>
      <Skeleton className="h-8 w-48 rounded-lg bg-white/[0.04]" />
      <Skeleton className="mt-1 h-4 w-64 rounded-lg bg-white/[0.04]" />
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-48 rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
    <div className="grid lg:grid-cols-2 gap-6">
      <Skeleton className="h-96 rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-96 rounded-2xl bg-white/[0.04]" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const KPIPage = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<KPIResponse[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("all");
  const [customDate, setCustomDate] = useState<string>("");

  // ── Store ──────────────────────────────────────────────────────────────────
  const currentUser = useAppStore((s) => s.currentUser);
  const fetchInstructors = useAppStore((s) => s.fetchInstructors);

  // ── API Functions ─────────────────────────────────────────────────────────
  const fetchAllReports = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/reports/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setReports(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast.error("Failed to load reports data");
    }
  }, []);

  const fetchAllAttendance = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/attendance/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch attendance");
      const data = await response.json();
      setAttendanceData(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Fetch attendance error:", error);
      toast.error("Failed to load attendance data");
    }
  }, []);

  const fetchKPIData = useCallback(async () => {
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
      toast.error("Failed to load KPI data");
    }
  }, []);

  // ── Load All Data ─────────────────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInstructors(),
        fetchAllReports(),
        fetchAllAttendance(),
        fetchKPIData(),
      ]);
    } catch (error) {
      console.error("Load data error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [fetchInstructors, fetchAllReports, fetchAllAttendance, fetchKPIData]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchAllReports(),
        fetchAllAttendance(),
        fetchKPIData(),
        fetchInstructors(),
      ]);
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchAllReports, fetchAllAttendance, fetchKPIData, fetchInstructors]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Get instructors from store ────────────────────────────────────────────
  const storeInstructors = useAppStore((s) => s.instructors) as Instructor[];
  
  useEffect(() => {
    if (storeInstructors.length > 0) {
      setInstructors(storeInstructors);
    }
  }, [storeInstructors]);

  // ── Compute Enhanced KPIs with real data ─────────────────────────────────
  const enhancedKpis = useMemo(() => {
    if (kpis.length === 0) return [];

    return kpis.map(kpi => {
      // Get instructor's reports
      const instructorReports = reports.filter(r => r.instructor === kpi.instructorId);
      
      // Calculate total hours from reports (only completed tasks)
      const totalHours = calculateTotalHoursFromReports(instructorReports);
      
      // Get instructor's attendance records
      const instructorAttendance = attendanceData.filter(a => a.instructor === kpi.instructorId);
      
      // Calculate actual attendance rate
      const attendanceRate = calculateAttendanceRate(instructorAttendance);
      
      // Calculate completed tasks
      const totalTasks = instructorReports.reduce((sum, r) => sum + (r.time_slots?.length || 0), 0);
      const completedTasks = instructorReports.reduce((sum, r) => 
        sum + (r.time_slots?.filter(s => s.status === "completed").length || 0), 0);
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Calculate late arrivals
      const lateCount = instructorAttendance.filter(a => a.is_late).length;
      const earlyLeaveCount = instructorAttendance.filter(a => a.is_early_leave).length;
      const disciplineScore = Math.max(0, 100 - ((lateCount + earlyLeaveCount) / Math.max(instructorAttendance.length, 1)) * 100);
      
      // Calculate final KPI (weighted average)
      const finalKPI = Math.round(
        attendanceRate * 0.3 + 
        taskCompletionRate * 0.4 + 
        disciplineScore * 0.3
      );
      
      return {
        ...kpi,
        totalWorkingHours: totalHours,
        taskCompletionScore: taskCompletionRate,
        attendanceScore: attendanceRate,
        timeDisciplineScore: disciplineScore,
        finalKPI: finalKPI,
        totalClasses: totalTasks,
        completedClasses: completedTasks,
        missedClasses: totalTasks - completedTasks,
        lateCount,
        earlyLeaveCount,
      };
    });
  }, [kpis, reports, attendanceData]);

  // ── Filter by instructor ──────────────────────────────────────────────────
  const filteredKpis = useMemo(() => {
    if (selectedInstructor === "all") return enhancedKpis;
    return enhancedKpis.filter(k => String(k.instructorId) === selectedInstructor);
  }, [enhancedKpis, selectedInstructor]);

  // ── Chart Data ────────────────────────────────────────────────────────────
  const overallBarData = useMemo(() => {
    return filteredKpis.map((k) => ({
      name: k.instructorName?.split(" ")[0] || "Unknown",
      fullName: k.instructorName,
      KPI: k.finalKPI,
      Hours: Math.round(k.totalWorkingHours * 10) / 10,
      Attendance: k.attendanceScore,
      Completion: k.taskCompletionScore,
      Discipline: k.timeDisciplineScore,
    }));
  }, [filteredKpis]);

  const radarData = useMemo(() => {
    if (filteredKpis.length === 0) return [];
    
    const metrics = ["Attendance", "Completion", "Discipline"];
    return metrics.map(metric => {
      const dataPoint: any = { metric };
      filteredKpis.forEach(k => {
        const name = k.instructorName?.split(" ")[0] || "Unknown";
        if (metric === "Attendance") dataPoint[name] = k.attendanceScore;
        else if (metric === "Completion") dataPoint[name] = k.taskCompletionScore;
        else if (metric === "Discipline") dataPoint[name] = k.timeDisciplineScore;
      });
      return dataPoint;
    });
  }, [filteredKpis]);

  // ── Daily trend data ─────────────────────────────────────────────────────
  const dailyTrendData = useMemo(() => {
    if (reports.length === 0) return [];
    
    // Get all dates from reports
    const dates = [...new Set(reports.map(r => r.date))].sort();
    
    // Filter dates based on range
    let filteredDates = dates;
    const today = new Date();
    
    if (dateRange === "week") {
      const weekAgo = subDays(today, 7).toISOString().split("T")[0];
      filteredDates = dates.filter(d => d >= weekAgo);
    } else if (dateRange === "month") {
      const monthAgo = subDays(today, 30).toISOString().split("T")[0];
      filteredDates = dates.filter(d => d >= monthAgo);
    } else if (customDate) {
      filteredDates = dates.filter(d => d === customDate);
    }
    
    return filteredDates.slice(-14).map(date => {
      const dayReports = reports.filter(r => r.date === date);
      let dayHours = 0;
      let completedTasks = 0;
      
      dayReports.forEach(report => {
        dayHours += calculateTotalHoursFromReports([report]);
        completedTasks += report.time_slots?.filter(s => s.status === "completed").length || 0;
      });
      
      const dayAttendance = attendanceData.filter(a => a.date === date);
      const attendanceRate = calculateAttendanceRate(dayAttendance);
      
      return {
        date: format(new Date(date), "MMM dd"),
        fullDate: date,
        hours: Math.round(dayHours * 10) / 10,
        tasks: completedTasks,
        attendance: attendanceRate,
      };
    });
  }, [reports, attendanceData, dateRange, customDate]);

  // ── Statistics Summary ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalInstructors = filteredKpis.length;
    const avgKPI = filteredKpis.length ? Math.round(filteredKpis.reduce((s, k) => s + k.finalKPI, 0) / filteredKpis.length) : 0;
    const totalHours = filteredKpis.reduce((s, k) => s + k.totalWorkingHours, 0);
    const totalClasses = filteredKpis.reduce((s, k) => s + k.totalClasses, 0);
    const completedClasses = filteredKpis.reduce((s, k) => s + k.completedClasses, 0);
    const completionRate = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;
    const avgAttendance = filteredKpis.length ? Math.round(filteredKpis.reduce((s, k) => s + k.attendanceScore, 0) / filteredKpis.length) : 0;
    const topPerformer = [...filteredKpis].sort((a, b) => b.finalKPI - a.finalKPI)[0];
    const lowPerformer = [...filteredKpis].sort((a, b) => a.finalKPI - b.finalKPI)[0];
    
    return {
      totalInstructors,
      avgKPI,
      totalHours,
      totalClasses,
      completedClasses,
      completionRate,
      avgAttendance,
      topPerformer,
      lowPerformer,
    };
  }, [filteredKpis]);

  // ── Export Functions ──────────────────────────────────────────────────────
  const handleExportKPIs = () => {
    if (!filteredKpis.length) {
      toast.error("No KPI data to export");
      return;
    }
    
    const headers = ["Instructor", "KPI Score", "Attendance", "Completion", "Discipline", "Hours", "Classes", "Completed", "Missed", "Late", "Early Leave"];
    const rows = filteredKpis.map(k => [
      k.instructorName,
      k.finalKPI,
      k.attendanceScore,
      k.taskCompletionScore,
      k.timeDisciplineScore,
      k.totalWorkingHours.toFixed(1),
      k.totalClasses,
      k.completedClasses,
      k.missedClasses,
      k.lateCount,
      k.earlyLeaveCount,
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpi-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("KPIs exported successfully");
  };

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading && !kpis.length) {
    return <KPISkeleton />;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">KPI Analytics</h1>
          <p className="mt-0.5 text-sm text-white/30">
            Performance metrics and analysis across all instructors
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportKPIs}
            disabled={!filteredKpis.length}
            className="h-9 gap-1.5 border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
            className="h-9 gap-1.5 border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.05] bg-[#141720] px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/25" />
          <span className="text-xs text-white/30">Filters:</span>
        </div>
        
        <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
          <SelectTrigger className="h-8 w-48 border-white/[0.07] bg-white/[0.04] text-sm text-white">
            <SelectValue placeholder="All Instructors" />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-[#1a1f2e] text-white">
            <SelectItem value="all">All Instructors ({instructors.length})</SelectItem>
            {instructors.map((i) => (
              <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger className="h-8 w-32 border-white/[0.07] bg-white/[0.04] text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-[#1a1f2e] text-white">
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        
        {selectedInstructor !== "all" && (
          <button
            onClick={() => setSelectedInstructor("all")}
            className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1 text-xs text-white/30 hover:bg-white/[0.05] hover:text-white"
          >
            <XCircle className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Instructors</span>
          </div>
          <p className="mt-2 text-2xl font-light text-white">{stats.totalInstructors}</p>
        </div>
        
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Avg KPI</span>
          </div>
          <p className={cn("mt-2 text-2xl font-light", kpiColor(stats.avgKPI))}>{stats.avgKPI}%</p>
        </div>
        
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Total Hours</span>
          </div>
          <p className="mt-2 text-2xl font-light text-white">{stats.totalHours.toFixed(1)}h</p>
        </div>
        
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Completion</span>
          </div>
          <p className={cn("mt-2 text-2xl font-light", kpiColor(stats.completionRate))}>{stats.completionRate}%</p>
        </div>
        
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Attendance</span>
          </div>
          <p className={cn("mt-2 text-2xl font-light", kpiColor(stats.avgAttendance))}>{stats.avgAttendance}%</p>
        </div>
        
        <div className="rounded-2xl border border-white/[0.05] bg-[#141720] p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-white/25" />
            <span className="text-[10px] font-semibold uppercase text-white/25">Top Performer</span>
          </div>
          <p className="mt-2 text-sm font-medium text-white truncate" title={stats.topPerformer?.instructorName}>
            {stats.topPerformer?.instructorName?.split(" ")[0] || "—"}
          </p>
          {stats.topPerformer && (
            <p className="text-[10px] text-white/20">{stats.topPerformer.finalKPI}% KPI</p>
          )}
        </div>
      </div>

      {/* KPI Cards per Instructor */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredKpis.map((k, idx) => (
          <Card key={k.instructorId} className="overflow-hidden border-white/[0.05] bg-[#141720] hover:border-white/[0.08] transition-all">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white">{k.instructorName}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {formatDuration(k.totalWorkingHours)} total · {k.totalClasses} classes
                  </p>
                </div>
                <div className={cn("rounded-xl px-2.5 py-1 text-lg font-bold", kpiBgColor(k.finalKPI), kpiColor(k.finalKPI))}>
                  {k.finalKPI}%
                </div>
              </div>
              
              <div className="space-y-2">
                {[
                  { label: "Attendance", score: k.attendanceScore, icon: Calendar },
                  { label: "Task Completion", score: k.taskCompletionScore, icon: CheckCircle2 },
                  { label: "Time Discipline", score: k.timeDisciplineScore, icon: Activity },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <item.icon className="h-3 w-3 text-white/25" />
                        <span className="text-white/40">{item.label}</span>
                      </div>
                      <span className={cn("font-medium", kpiColor(item.score))}>{item.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", 
                          item.score >= 80 ? "bg-emerald-500" : item.score >= 60 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${item.score}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between pt-2 border-t border-white/[0.05] text-xs">
                <div className="text-center">
                  <p className="text-white/25">Completed</p>
                  <p className="font-semibold text-white">{k.completedClasses}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/25">Missed</p>
                  <p className="font-semibold text-red-400">{k.missedClasses}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/25">Late</p>
                  <p className="font-semibold text-amber-400">{k.lateCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/25">Early Leave</p>
                  <p className="font-semibold text-orange-400">{k.earlyLeaveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* KPI & Hours Bar Chart */}
        <Card className="border-white/[0.05] bg-[#141720]">
          <CardContent className="p-5">
            <h3 className="font-semibold text-white mb-4">Final KPI & Working Hours</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={overallBarData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgba(255,255,255,0.3)" }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 50]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "white" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="KPI" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="KPI Score (%)" />
                <Bar yAxisId="right" dataKey="Hours" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} name="Hours Worked" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Radar Chart */}
        <Card className="border-white/[0.05] bg-[#141720]">
          <CardContent className="p-5">
            <h3 className="font-semibold text-white mb-4">Performance Radar</h3>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                {filteredKpis.map((k, i) => (
                  <Radar 
                    key={k.instructorId} 
                    name={k.instructorName.split(" ")[0]} 
                    dataKey={k.instructorName.split(" ")[0]} 
                    stroke={COLORS[i % COLORS.length]} 
                    fill={COLORS[i % COLORS.length]} 
                    fillOpacity={0.15} 
                  />
                ))}
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "white" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card className="border-white/[0.05] bg-[#141720]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Daily Performance Trend</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                Hours Worked
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                Attendance Rate
              </Badge>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
              <YAxis yAxisId="left" domain={[0, 12]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "white" }}
              />
              <Area yAxisId="left" type="monotone" dataKey="hours" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.1} name="Hours Worked" />
              <Line yAxisId="right" type="monotone" dataKey="attendance" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 4 }} name="Attendance Rate (%)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <Star className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Top Performer</p>
              <p className="text-2xl font-light text-emerald-400">{stats.topPerformer?.instructorName || "—"}</p>
            </div>
          </div>
          {stats.topPerformer && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-white/25">KPI Score</p>
                <p className="font-semibold text-white">{stats.topPerformer.finalKPI}%</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Completion</p>
                <p className="font-semibold text-white">{stats.topPerformer.taskCompletionScore}%</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Attendance</p>
                <p className="font-semibold text-white">{stats.topPerformer.attendanceScore}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Needs Improvement</p>
              <p className="text-2xl font-light text-amber-400">{stats.lowPerformer?.instructorName || "—"}</p>
            </div>
          </div>
          {stats.lowPerformer && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-white/25">KPI Score</p>
                <p className="font-semibold text-white">{stats.lowPerformer.finalKPI}%</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Completion</p>
                <p className="font-semibold text-white">{stats.lowPerformer.taskCompletionScore}%</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Attendance</p>
                <p className="font-semibold text-white">{stats.lowPerformer.attendanceScore}%</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPIPage;