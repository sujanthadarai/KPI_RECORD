import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Area, AreaChart,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SlotStatus = "completed" | "pending" | "cancelled";

interface TimeSlot   { status: SlotStatus }
interface DailyReport {
  id: string | number;
  date: string;
  updatedAt: string;
  timeSlots: TimeSlot[];
}
interface KPIData {
  finalKPI: number;
  attendanceScore: number;
  taskCompletionScore: number;
  timeDisciplineScore: number;
  totalClasses: number;
  missedClasses: number;
  totalWorkingHours: number;
  presentDays: number;
  totalDays: number;
}
interface CurrentUser { name: string }
interface InstructorDashboardProps {
  currentUser?: CurrentUser;
  kpi?: KPIData;
  reports?: DailyReport[];
  onRefresh?: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_KPI: KPIData = {
  finalKPI: 85, attendanceScore: 88, taskCompletionScore: 91,
  timeDisciplineScore: 74, totalClasses: 64, missedClasses: 6,
  totalWorkingHours: 128, presentDays: 26, totalDays: 30,
};

const MOCK_REPORTS: DailyReport[] = [
  { id: 1, date: "2025-04-14", updatedAt: "2025-04-14", timeSlots: Array(8).fill({ status: "completed" }) },
  { id: 2, date: "2025-04-11", updatedAt: "2025-04-11", timeSlots: Array(7).fill({ status: "completed" }) },
  { id: 3, date: "2025-04-10", updatedAt: "2025-04-10", timeSlots: [...Array(5).fill({ status: "completed" }), ...Array(2).fill({ status: "pending" })] },
  { id: 4, date: "2025-04-09", updatedAt: "2025-04-09", timeSlots: Array(9).fill({ status: "completed" }) },
  { id: 5, date: "2025-04-08", updatedAt: "2025-04-08", timeSlots: [...Array(3).fill({ status: "completed" }), ...Array(2).fill({ status: "pending" })] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — terminal/IDE dark
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  bg:          "#0b0d12",
  surface:     "#111318",
  raised:      "#1a1d24",
  border:      "rgba(255,255,255,0.06)",
  borderMed:   "rgba(255,255,255,0.10)",
  text:        "#e8e6e1",
  textMuted:   "rgba(232,230,225,0.45)",
  textDim:     "rgba(232,230,225,0.22)",
  accent:      "#63b3ed",   // blue
  accentDim:   "rgba(99,179,237,0.10)",
  green:       "#4ade80",
  greenDim:    "rgba(74,222,128,0.10)",
  amber:       "#fbbf24",
  amberDim:    "rgba(251,191,36,0.10)",
  red:         "#f87171",
  redDim:      "rgba(248,113,113,0.10)",
  teal:        "#2dd4bf",
  tealDim:     "rgba(45,212,191,0.10)",
  purple:      "#a78bfa",
  purpleDim:   "rgba(167,139,250,0.10)",
  grid:        "rgba(255,255,255,0.04)",
  tick:        "rgba(255,255,255,0.22)",
  mono:        "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
  sans:        "'IBM Plex Sans','Inter',sans-serif",
  r:           "8px",
  rs:          "5px",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getGrade(score: number) {
  if (score >= 90) return { grade: "A+", label: "Excellent",         color: D.green,  dim: D.greenDim  };
  if (score >= 80) return { grade: "A",  label: "Very Good",         color: D.accent, dim: D.accentDim };
  if (score >= 70) return { grade: "B",  label: "Good",              color: D.accent, dim: D.accentDim };
  if (score >= 60) return { grade: "C",  label: "Satisfactory",      color: D.amber,  dim: D.amberDim  };
  if (score >= 50) return { grade: "D",  label: "Needs Improvement", color: D.amber,  dim: D.amberDim  };
  return               { grade: "F",  label: "Poor",              color: D.red,    dim: D.redDim    };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function reportStatus(r: DailyReport) {
  const all = r.timeSlots;
  if (all.every((s) => s.status === "completed")) return { label: "completed",   color: D.green,  dim: D.greenDim  };
  if (all.some((s)  => s.status === "pending"))   return { label: "in_progress", color: D.amber,  dim: D.amberDim  };
  return                                                  { label: "pending",     color: D.accent, dim: D.accentDim };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  accent?: string;
  dim?: string;
}

const MetricCard = memo(({ label, value, sub, subColor, accent, dim }: MetricCardProps) => (
  <div style={{
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: D.r, padding: "16px 18px",
    transition: "border-color 0.15s",
  }}>
    <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, fontFamily: D.mono, color: accent || D.text }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 12, marginTop: 7, color: subColor || D.textMuted, fontFamily: D.sans }}>{sub}</div>}
  </div>
));
MetricCard.displayName = "MetricCard";

interface BreakBarProps { label: string; weight: string; score: number; note?: string; color: string; glow: string }
const BreakBar = memo(({ label, weight, score, note, color, glow }: BreakBarProps) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: D.textMuted, fontFamily: D.sans }}>
        {label} <span style={{ fontSize: 11, color: D.textDim, fontFamily: D.mono }}>// {weight}</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: D.mono, color }}>{score}%</span>
    </div>
    <div style={{ height: 3, background: D.border, borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        width: `${score}%`, height: 3, background: color, borderRadius: 2,
        transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 8px ${glow}`,
      }} />
    </div>
    {note && <div style={{ fontSize: 11, color: D.textDim, marginTop: 4, fontFamily: D.sans }}>{note}</div>}
  </div>
));
BreakBar.displayName = "BreakBar";

interface ScoreRingProps { score: number }
const ScoreRing = memo(({ score }: ScoreRingProps) => {
  const r = 30, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke={D.border} strokeWidth="4" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={D.accent} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${D.accent}80)` }}
        />
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        fontSize: 16, fontWeight: 500, fontFamily: D.mono, color: D.text,
      }}>{score}</div>
    </div>
  );
});
ScoreRing.displayName = "ScoreRing";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}
const ChartTooltip = memo(({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a1d24", border: `1px solid ${D.borderMed}`,
      borderRadius: D.r, padding: "8px 14px", fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <div style={{ fontFamily: D.mono, color: D.textMuted, marginBottom: 5, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: D.mono, color: p.color }}>
          {p.name}: <span style={{ color: D.text }}>{p.value}{p.name?.includes("Rate") ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
});
ChartTooltip.displayName = "ChartTooltip";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const InstructorDashboard = ({
  currentUser = { name: "Instructor" },
  kpi = MOCK_KPI,
  reports = MOCK_REPORTS,
  onRefresh,
}: InstructorDashboardProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    }));
  }, []);

  const grade = getGrade(kpi.finalKPI);

  // ── Derived ───────────────────────────────────────────────────────────────

  const statusDist = useMemo(() => {
    const all = reports.flatMap((r) => r.timeSlots);
    return [
      { name: "completed", value: all.filter((s) => s.status === "completed").length, color: D.green  },
      { name: "pending",   value: all.filter((s) => s.status === "pending").length,   color: D.amber  },
      { name: "cancelled", value: all.filter((s) => s.status === "cancelled").length, color: D.red    },
    ];
  }, [reports]);

  const weeklyPerf = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    return days.map((date) => {
      const dr    = reports.filter((r) => r.date === date);
      const total = dr.reduce((s, r) => s + r.timeSlots.length, 0);
      const done  = dr.reduce((s, r) => s + r.timeSlots.filter((t) => t.status === "completed").length, 0);
      return {
        date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        total,
      };
    });
  }, [reports]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      else await new Promise((r) => setTimeout(r, 1200));
    } finally { setIsRefreshing(false); }
  }, [onRefresh]);

  // ── Shared styles ─────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: D.r, padding: 20,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 11, fontFamily: D.mono, color: D.textDim,
    letterSpacing: "0.08em", textTransform: "uppercase",
    marginBottom: 18, display: "flex", alignItems: "center", gap: 8,
  };

  const titleDot: React.CSSProperties = {
    width: 5, height: 5, borderRadius: "50%",
    background: D.accent, display: "inline-block",
    boxShadow: `0 0 6px ${D.accent}`,
  };

  const inlineMonoPill = (color: string, dim: string, label: string) => (
    <span style={{
      fontSize: 10, fontFamily: D.mono, fontWeight: 500,
      padding: "2px 8px", borderRadius: 20,
      background: dim, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        .idash * { box-sizing: border-box; }
        .idash-btn:hover     { background: rgba(255,255,255,0.06) !important; color: #e8e6e1 !important; }
        .idash-btn-pri:hover { opacity: 0.8 !important; }
        .idash-report-row:hover { background: rgba(255,255,255,0.04) !important; }
        .idash-card-hover:hover { border-color: rgba(255,255,255,0.10) !important; }
        .idash-kpi-row   { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; }
        .idash-two-col   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .idash-three-col { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
        @media (max-width:680px) {
          .idash-kpi-row    { grid-template-columns: 1fr 1fr !important; }
          .idash-two-col    { grid-template-columns: 1fr !important; }
          .idash-three-col  { grid-template-columns: 1fr 1fr !important; }
          .idash-score-band { flex-direction: column !important; }
          .idash-s-metrics  { gap: 16px !important; }
          .idash-s-divider  { display: none !important; }
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .idash { animation: fadeIn 0.35s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="idash" style={{
        fontFamily: D.sans, background: D.bg, color: D.text,
        fontSize: 14, lineHeight: 1.6,
        maxWidth: 1100, margin: "0 auto", padding: "28px 20px",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: D.mono, color: D.accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              instructor_dashboard
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.4px", color: D.text, fontFamily: D.sans }}>
              Good morning, {currentUser.name.split(" ")[0]}
            </h1>
            <p style={{ fontSize: 13, color: D.textMuted, margin: "4px 0 0", fontFamily: D.sans }}>
              performance_overview — last 30 days
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontFamily: D.mono, color: D.textMuted,
              background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 20, padding: "5px 12px",
            }}>
              {today}
            </span>
            <button
              className="idash-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                fontFamily: D.mono, fontSize: 11, fontWeight: 500,
                border: `1px solid ${D.border}`, borderRadius: D.rs,
                background: "transparent", color: D.textMuted,
                padding: "7px 14px", cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {isRefreshing
                ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>↻</span> refreshing…</>
                : "↻ refresh"
              }
            </button>
            <button
              className="idash-btn-pri"
              style={{
                fontFamily: D.mono, fontSize: 11, fontWeight: 500,
                border: `1px solid ${D.accent}40`, borderRadius: D.rs,
                background: D.accentDim, color: D.accent,
                padding: "7px 14px", cursor: "pointer", transition: "opacity 0.15s",
                boxShadow: `0 0 12px ${D.accent}18`,
              }}
            >
              ↓ export_pdf
            </button>
          </div>
        </div>

        {/* ── Metric cards ── */}
        <div className="idash-kpi-row" style={{ marginBottom: 14 }}>
          <MetricCard label="total_reports"     value={reports.length}                       sub="↑ 12% from last month"            subColor={D.green}  accent={D.text} />
          <MetricCard label="classes_conducted" value={kpi.totalClasses}                     sub={`${kpi.totalWorkingHours}h logged`} />
          <MetricCard label="completed"         value={kpi.totalClasses - kpi.missedClasses} sub={`${kpi.taskCompletionScore}% rate`} subColor={D.green}  accent={D.green} />
          <MetricCard label="missed"            value={kpi.missedClasses}                    sub="3 pending review"                 subColor={D.amber}  accent={D.amber} />
        </div>

        {/* ── Score band ── */}
        <div className="idash-score-band" style={{
          ...card,
          display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
          marginBottom: 16,
        }}>
          <ScoreRing score={kpi.finalKPI} />

          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              kpi_score
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, fontFamily: D.mono, color: D.text }}>
              {kpi.finalKPI} <span style={{ fontSize: 13, color: D.textDim }}>/ 100</span>
            </div>
            <div style={{ fontSize: 12, color: D.textMuted, marginTop: 3, fontFamily: D.sans }}>
              attendance · task_completion · time_discipline
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontFamily: D.mono, fontWeight: 500,
              padding: "4px 12px", borderRadius: 20, marginTop: 10,
              background: grade.dim, color: grade.color,
              border: `1px solid ${grade.color}30`,
              boxShadow: `0 0 10px ${grade.color}20`,
            }}>
              {grade.grade} — {grade.label}
            </div>
          </div>

          <div className="idash-s-divider" style={{ width: "1px", height: 56, background: D.border, flexShrink: 0 }} />

          <div className="idash-s-metrics" style={{ display: "flex", gap: 30, flexWrap: "wrap", flexShrink: 0 }}>
            {[
              { val: `${kpi.attendanceScore}%`,     label: "attendance",   color: D.green  },
              { val: `${kpi.taskCompletionScore}%`, label: "task_rate",    color: D.accent },
              { val: `${kpi.timeDisciplineScore}%`, label: "discipline",   color: D.amber  },
              { val: kpi.presentDays,                label: "days_present", color: D.text   },
            ].map((m) => (
              <div key={m.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 500, fontFamily: D.mono, color: m.color }}>
                  {m.val}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, marginTop: 3, fontFamily: D.mono, letterSpacing: "0.05em" }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-col: breakdown + status chart ── */}
        <div className="idash-two-col" style={{ marginBottom: 16 }}>
          <div style={card}>
            <div style={cardTitle}><span style={titleDot} />kpi_breakdown</div>
            <BreakBar label="Attendance score" weight="30% weight" score={kpi.attendanceScore}      color={D.green}  glow={`${D.green}60`}  note={`${kpi.presentDays} / ${kpi.totalDays} days present`} />
            <BreakBar label="Task completion"  weight="40% weight" score={kpi.taskCompletionScore}  color={D.accent} glow={`${D.accent}60`} note={`${kpi.totalClasses - kpi.missedClasses} / ${kpi.totalClasses} classes done`} />
            <BreakBar label="Time discipline"  weight="30% weight" score={kpi.timeDisciplineScore}  color={D.amber}  glow={`${D.amber}60`}  note="avg 8 min late — needs improvement" />
          </div>

          <div style={card}>
            <div style={cardTitle}><span style={titleDot} />task_status_distribution</div>
            <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
              {statusDist.map((d) => (
                <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" }} />
                  {d.name} <span style={{ color: d.color }}>{d.value}</span>
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={196}>
              <BarChart data={statusDist} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={D.grid} strokeWidth={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: D.tick, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: D.tick, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {statusDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Weekly trend ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={cardTitle}><span style={titleDot} />weekly_performance_trend</div>
          <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
              <span style={{ width: 18, height: 2, background: D.accent, display: "inline-block", borderRadius: 1 }} />
              completion_rate
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
              <span style={{ width: 18, height: 0, borderTop: `2px dashed ${D.teal}`, display: "inline-block" }} />
              classes_total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={196}>
            <AreaChart data={weeklyPerf} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={D.accent} stopOpacity={0.20} />
                  <stop offset="100%" stopColor={D.accent} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={D.grid} strokeWidth={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: D.tick, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: D.tick, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} domain={[0, 110]} />
              <YAxis yAxisId="right" tick={{ fontSize: 10, fill: D.tick, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} orientation="right" domain={[0, 12]} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: D.borderMed, strokeWidth: 1 }} />
              <Area yAxisId="left" type="monotone" dataKey="completionRate" name="Completion Rate"
                stroke={D.accent} fill="url(#grad-accent)" strokeWidth={1.5}
                dot={{ r: 3, fill: D.accent, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: D.accent, strokeWidth: 0 }}
              />
              <Area yAxisId="right" type="monotone" dataKey="total" name="Classes"
                stroke={D.teal} fill="none" strokeWidth={1.5} strokeDasharray="4 3"
                dot={{ r: 3, fill: D.teal, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: D.teal, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Recent reports ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={cardTitle} ><span style={titleDot} />recent_reports</div>
            <button className="idash-btn" style={{
              fontFamily: D.mono, fontSize: 10, color: D.textDim,
              background: "transparent", border: `1px solid ${D.border}`,
              borderRadius: D.rs, padding: "4px 10px", cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}>
              view_all →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reports.slice(0, 5).map((report) => {
              const st = reportStatus(report);
              return (
                <div key={report.id} className="idash-report-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 14px",
                  background: D.raised, borderRadius: D.rs,
                  border: `1px solid ${D.border}`,
                  transition: "background 0.15s", cursor: "default",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: D.text, fontFamily: D.sans }}>
                      {fmtDate(report.date)}
                    </div>
                    <div style={{ fontSize: 11, color: D.textDim, marginTop: 2, fontFamily: D.mono }}>
                      {report.timeSlots.length} tasks · updated {fmtShort(report.updatedAt)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontFamily: D.mono, fontWeight: 500,
                    padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                    background: st.dim, color: st.color,
                    border: `1px solid ${st.color}30`,
                  }}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Milestones ── */}
        <div style={card}>
          <div style={cardTitle}><span style={titleDot} />milestones</div>
          <div className="idash-three-col">
            {[
              { val: kpi.totalClasses,                  label: "classes_completed", pct: Math.min(kpi.totalClasses, 100),           color: D.accent, glow: D.accent },
              { val: Math.round(kpi.totalWorkingHours), label: "hours_taught",      pct: Math.min((kpi.totalWorkingHours / 200) * 100, 100), color: D.teal,   glow: D.teal   },
              { val: kpi.presentDays,                    label: "days_present",     pct: Math.round((kpi.presentDays / kpi.totalDays) * 100), color: D.green,  glow: D.green  },
            ].map((m) => (
              <div key={m.label} style={{
                background: D.raised, borderRadius: D.rs, padding: 18,
                textAlign: "center", border: `1px solid ${D.border}`,
              }}>
                <div style={{ fontSize: 30, fontWeight: 500, fontFamily: D.mono, color: D.text }}>
                  {m.val}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, marginTop: 5, fontFamily: D.mono, letterSpacing: "0.06em" }}>
                  {m.label}
                </div>
                <div style={{ height: 2, background: D.border, borderRadius: 2, marginTop: 14, overflow: "hidden" }}>
                  <div style={{
                    width: `${m.pct}%`, height: 2, background: m.color, borderRadius: 2,
                    boxShadow: `0 0 6px ${m.glow}`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
};

export default InstructorDashboard;