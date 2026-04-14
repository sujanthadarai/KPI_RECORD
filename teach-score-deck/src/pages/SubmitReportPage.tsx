import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Plus, Trash2, Send, Save, Clock, AlertCircle,
  CheckCircle2, Calendar, Copy, Loader2, ChevronDown,
  Zap, FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SlotForm {
  startTime:   string;
  endTime:     string;
  description: string;
  status:      TaskStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SLOTS: SlotForm[] = [
  { startTime: "09:00", endTime: "11:00", description: "", status: "pending" },
  { startTime: "11:00", endTime: "13:00", description: "", status: "pending" },
  { startTime: "13:00", endTime: "14:30", description: "", status: "pending" },
  { startTime: "15:00", endTime: "16:30", description: "", status: "pending" },
  { startTime: "16:30", endTime: "18:00", description: "", status: "pending" },
];

const QUICK_TEMPLATES = [
  { start: "09:00", end: "11:00", label: "Morning Session 1" },
  { start: "11:00", end: "13:00", label: "Morning Session 2" },
  { start: "13:00", end: "14:30", label: "Afternoon Session 1" },
  { start: "15:00", end: "16:30", label: "Afternoon Session 2" },
  { start: "16:30", end: "18:00", label: "Evening Session" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string; dim: string }[] = [
  { value: "completed", label: "Completed", color: "#4ade80", dim: "rgba(74,222,128,0.12)" },
  { value: "pending",   label: "Pending",   color: "#fbbf24", dim: "rgba(251,191,36,0.12)"  },
  { value: "cancelled", label: "Cancelled", color: "#f87171", dim: "rgba(248,113,113,0.12)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  bg:         "#0b0d12",
  surface:    "#111318",
  surfaceHov: "#161920",
  raised:     "#1a1d24",
  border:     "rgba(255,255,255,0.06)",
  borderMed:  "rgba(255,255,255,0.1)",
  borderFoc:  "rgba(99,179,237,0.5)",
  text:       "#e8e6e1",
  textMuted:  "rgba(232,230,225,0.45)",
  textDim:    "rgba(232,230,225,0.22)",
  accent:     "#63b3ed",
  accentDim:  "rgba(99,179,237,0.12)",
  green:      "#4ade80",
  greenDim:   "rgba(74,222,128,0.1)",
  amber:      "#fbbf24",
  amberDim:   "rgba(251,191,36,0.1)",
  red:        "#f87171",
  redDim:     "rgba(248,113,113,0.1)",
  mono:       "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  sans:       "'IBM Plex Sans', 'Inter', sans-serif",
  radius:     "8px",
  radiusSm:   "5px",
};

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

function totalHours(slots: SlotForm[]): string {
  return slots.reduce((s, sl) => s + calcHours(sl.startTime, sl.endTime), 0).toFixed(1);
}

function slotDuration(slot: SlotForm): string {
  const h = calcHours(slot.startTime, slot.endTime);
  if (!h) return "";
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

function statusFor(s: TaskStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

const Dot = memo(({ status }: { status: TaskStatus }) => {
  const s = statusFor(status);
  return (
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: s.color, display: "inline-block",
      flexShrink: 0, boxShadow: `0 0 6px ${s.color}60`,
    }} />
  );
});
Dot.displayName = "Dot";

const StatCard = memo(({ icon: Icon, label, value, accent, dim }: {
  icon: React.ElementType; label: string; value: string | number;
  accent?: string; dim?: string;
}) => (
  <div style={{
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: D.radius, padding: "14px 16px",
    display: "flex", alignItems: "center", gap: 12,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: D.radiusSm,
      background: dim || D.raised,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, border: `1px solid ${D.border}`,
    }}>
      <Icon size={15} color={accent || D.textMuted} />
    </div>
    <div>
      <div style={{ fontSize: 11, color: D.textDim, fontFamily: D.mono, letterSpacing: "0.06em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, fontFamily: D.mono, color: accent || D.text, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  </div>
));
StatCard.displayName = "StatCard";

// ─────────────────────────────────────────────────────────────────────────────
// SlotCard
// ─────────────────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot:        SlotForm;
  index:       number;
  total:       number;
  isView:      boolean;
  onChange:    (field: keyof SlotForm, value: string) => void;
  onRemove:    () => void;
  onDuplicate: () => void;
}

const SlotCard = memo(({
  slot, index, total, isView, onChange, onRemove, onDuplicate,
}: SlotCardProps) => {
  const [open, setOpen] = useState(true);
  const [showTpl, setShowTpl] = useState(false);
  const dur = slotDuration(slot);
  const st  = statusFor(slot.status);
  const hasContent = slot.description.trim().length > 0;

  return (
    <div className="slot-card" style={{
      background: D.surface, border: `1px solid ${D.border}`,
      borderRadius: D.radius, overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => !isView && setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 16px",
          background: "transparent", border: "none",
          cursor: isView ? "default" : "pointer",
          textAlign: "left", gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {/* Index badge */}
          <div style={{
            width: 26, height: 26, borderRadius: D.radiusSm,
            background: D.raised, border: `1px solid ${D.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 500, fontFamily: D.mono,
            color: D.textDim, flexShrink: 0,
          }}>
            {String(index + 1).padStart(2, "0")}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Dot status={slot.status} />
              <span style={{ fontSize: 13, fontWeight: 500, fontFamily: D.mono, color: D.text }}>
                {slot.startTime && slot.endTime
                  ? `${slot.startTime} → ${slot.endTime}`
                  : `slot_${String(index + 1).padStart(2, "0")}`}
              </span>
              {dur && (
                <span style={{
                  fontSize: 11, fontFamily: D.mono, color: D.accent,
                  background: D.accentDim, borderRadius: 20,
                  padding: "1px 8px", border: `1px solid ${D.accent}30`,
                }}>
                  {dur}
                </span>
              )}
              {!hasContent && (
                <span style={{
                  fontSize: 10, fontFamily: D.mono, color: D.amber,
                  background: D.amberDim, borderRadius: 20,
                  padding: "1px 8px", border: `1px solid ${D.amber}30`,
                }}>
                  needs description
                </span>
              )}
            </div>
            {hasContent && (
              <div style={{
                fontSize: 11, color: D.textDim, marginTop: 3, fontFamily: D.sans,
                maxWidth: 360, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {slot.description}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontFamily: D.mono, fontWeight: 500,
            padding: "2px 8px", borderRadius: 20,
            background: st.dim, color: st.color,
            border: `1px solid ${st.color}30`,
          }}>
            {st.label}
          </span>
          {!isView && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                title="Duplicate"
                style={btnIcon}
              >
                <Copy size={12} />
              </button>
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  title="Remove"
                  style={{ ...btnIcon, color: D.red }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
          {!isView && (
            <ChevronDown size={13} color={D.textDim} style={{
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              marginLeft: 2,
            }} />
          )}
        </div>
      </button>

      {/* Body */}
      {open && !isView && (
        <div style={{
          padding: "0 16px 18px",
          borderTop: `1px solid ${D.border}`,
        }}>
          <div style={{ height: 16 }} />

          {/* Time row */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={fieldLbl}>start_time</div>
              <input
                type="time"
                value={slot.startTime}
                onChange={(e) => onChange("startTime", e.target.value)}
                className="srp-input"
                style={timeInp}
                required
              />
            </div>
            <div style={{ color: D.textDim, fontSize: 16, paddingBottom: 9, flexShrink: 0, fontFamily: D.mono }}>→</div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={fieldLbl}>end_time</div>
              <input
                type="time"
                value={slot.endTime}
                onChange={(e) => onChange("endTime", e.target.value)}
                className="srp-input"
                style={timeInp}
                required
              />
            </div>
            {dur && (
              <div style={{
                paddingBottom: 9, fontSize: 12, color: D.accent,
                fontFamily: D.mono, flexShrink: 0,
              }}>
                = {dur}
              </div>
            )}
          </div>

          {/* Quick templates */}
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setShowTpl((v) => !v)}
              style={ghostBtn}
            >
              <Zap size={11} />
              {showTpl ? "hide templates" : "quick templates"}
            </button>
            {showTpl && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {QUICK_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange("startTime", t.start);
                      onChange("endTime",   t.end);
                      if (!slot.description) onChange("description", t.label);
                      setShowTpl(false);
                      toast.success(`Applied: ${t.label}`);
                    }}
                    className="srp-tpl-btn"
                    style={{
                      fontSize: 11, fontFamily: D.mono,
                      background: D.raised, border: `1px solid ${D.border}`,
                      borderRadius: D.radiusSm,
                      padding: "4px 10px", cursor: "pointer",
                      color: D.textMuted, display: "flex", gap: 6, alignItems: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ color: D.text }}>{t.label}</span>
                    <span style={{ color: D.textDim }}>{t.start}–{t.end}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <div style={fieldLbl}>description</div>
            <textarea
              value={slot.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="// describe the activity, topic, or task completed…"
              rows={2}
              className="srp-input"
              style={{
                ...timeInp,
                height: "auto", resize: "vertical",
                lineHeight: 1.6, fontFamily: D.sans, fontSize: 13,
                padding: "10px 12px",
              }}
              required
            />
          </div>

          {/* Status selector */}
          <div>
            <div style={fieldLbl}>status</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = slot.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange("status", opt.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      fontSize: 12, fontFamily: D.mono,
                      padding: "7px 14px", borderRadius: D.radiusSm,
                      cursor: "pointer",
                      background: active ? opt.dim : D.raised,
                      color: active ? opt.color : D.textMuted,
                      border: `1px solid ${active ? opt.color + "50" : D.border}`,
                      fontWeight: active ? 500 : 400,
                      transition: "all 0.15s",
                      boxShadow: active ? `0 0 12px ${opt.color}18` : "none",
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: opt.color, flexShrink: 0,
                      boxShadow: active ? `0 0 5px ${opt.color}` : "none",
                    }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
SlotCard.displayName = "SlotCard";

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const PageSkeleton = () => (
  <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
    {[80, 56, 200, 200, 200].map((h, i) => (
      <div key={i} style={{
        height: h, borderRadius: D.radius,
        background: D.surface, border: `1px solid ${D.border}`,
        animation: "skelPulse 1.6s ease-in-out infinite",
      }} />
    ))}
    <style>{`@keyframes skelPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared mini-styles (defined outside component to avoid re-creation)
// ─────────────────────────────────────────────────────────────────────────────

const fieldLbl: React.CSSProperties = {
  fontSize: 10, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  color: "rgba(232,230,225,0.3)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 6,
};

const timeInp: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13, width: "100%",
  background: "#0b0d12",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "5px",
  padding: "8px 12px",
  color: "#e8e6e1",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "5px",
  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
  color: "rgba(232,230,225,0.4)",
  padding: "5px 10px", cursor: "pointer",
  transition: "color 0.15s, border-color 0.15s",
};

const btnIcon: React.CSSProperties = {
  background: "transparent", border: "none",
  width: 26, height: 26, borderRadius: "5px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "rgba(232,230,225,0.35)",
  transition: "background 0.15s, color 0.15s",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const SubmitReportPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaved,   setDraftSaved]   = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);

  const currentUser    = useAppStore((s) => s.currentUser);
  const addReport      = useAppStore((s) => s.addReport);
  const updateReport   = useAppStore((s) => s.updateReport);
  const getTodayReport = useAppStore((s) => s.getTodayReport);
  const loading        = useAppStore((s) => s.loading);

  const today          = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const existingReport = currentUser ? getTodayReport(currentUser.id) : undefined;

  const initialSlots: SlotForm[] = useMemo(() => {
    if (existingReport) {
      return existingReport.timeSlots.map((ts) => ({
        startTime:   ts.startTime,
        endTime:     ts.endTime,
        description: ts.description,
        status:      ts.status,
      }));
    }
    return DEFAULT_SLOTS.map((s) => ({ ...s }));
  }, [existingReport]);

  const [slots, setSlots] = useState<SlotForm[]>(initialSlots);

  // Auto-save draft
  useEffect(() => {
    if (!currentUser || !slots.some((s) => s.description.trim())) return;
    const id = setTimeout(() => {
      localStorage.setItem(`rpt_draft_${currentUser.id}`, JSON.stringify({ date, slots }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1800);
    }, 900);
    return () => clearTimeout(id);
  }, [slots, date, currentUser]);

  // Load draft on mount
  useEffect(() => {
    if (existingReport || !currentUser) return;
    const raw = localStorage.getItem(`rpt_draft_${currentUser.id}`);
    if (!raw) return;
    try {
      const { date: dd, slots: ds } = JSON.parse(raw);
      if (window.confirm("Resume unsaved draft?")) {
        setDate(dd);
        setSlots(ds);
      }
    } catch { /* ignore malformed draft */ }
  }, []); // eslint-disable-line

  // ── Slot mutations ────────────────────────────────────────────────────────

  const updateSlot = useCallback((i: number, field: keyof SlotForm, value: string) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }, []);

  const addSlot = useCallback(() => {
    setSlots((prev) => [...prev, { startTime: "", endTime: "", description: "", status: "pending" }]);
  }, []);

  const removeSlot = useCallback((i: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    toast.info("Slot removed");
  }, []);

  const duplicateSlot = useCallback((i: number) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy.splice(i + 1, 0, { ...prev[i] });
      return copy;
    });
    toast.success("Slot duplicated");
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.startTime)             { toast.error(`slot_${String(i+1).padStart(2,"0")}: missing start_time`); return false; }
      if (!s.endTime)               { toast.error(`slot_${String(i+1).padStart(2,"0")}: missing end_time`);   return false; }
      if (s.startTime >= s.endTime) { toast.error(`slot_${String(i+1).padStart(2,"0")}: start must be < end`); return false; }
      if (!s.description.trim())    { toast.error(`slot_${String(i+1).padStart(2,"0")}: description required`); return false; }
    }
    return true;
  }, [slots]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !validate()) return;
    setIsSubmitting(true);
    const payload = {
      date,
      time_slots: slots.map((s) => ({
        start_time:  s.startTime,
        end_time:    s.endTime,
        description: s.description.trim(),
        status:      s.status,
      })),
    };
    try {
      if (existingReport && isEditing) {
        await updateReport({
          ...(payload as any),
          id:            existingReport.id,
          instructorId:  currentUser.id,
          createdAt:     existingReport.createdAt,
          updatedAt:     new Date().toISOString(),
        });
        toast.success("report updated");
        setIsEditing(false);
      } else {
        await addReport(payload as any);
        toast.success("report submitted");
        localStorage.removeItem(`rpt_draft_${currentUser.id}`);
        setSlots(DEFAULT_SLOTS.map((s) => ({ ...s })));
      }
    } catch (err: any) {
      toast.error(err?.message || "failed to save report");
    } finally {
      setIsSubmitting(false);
    }
  }, [currentUser, slots, date, existingReport, isEditing, addReport, updateReport, validate]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const hours     = totalHours(slots);
  const completed = slots.filter((s) => s.status === "completed").length;
  const pending   = slots.filter((s) => s.status === "pending").length;
  const pct       = slots.length ? Math.round((completed / slots.length) * 100) : 0;
  const isView    = !!(existingReport && !isEditing);

  if (loading && !existingReport) return <PageSkeleton />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        .srp-wrap * { box-sizing: border-box; }
        .srp-input:focus {
          outline: none !important;
          border-color: rgba(99,179,237,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,179,237,0.08) !important;
        }
        .srp-input::placeholder { color: rgba(232,230,225,0.18); }
        .srp-input { color-scheme: dark; }
        .slot-card:hover { border-color: rgba(255,255,255,0.1) !important; }
        .srp-icon-btn:hover { background: rgba(255,255,255,0.07) !important; color: #e8e6e1 !important; }
        .srp-ghost-btn:hover { color: #e8e6e1 !important; border-color: rgba(255,255,255,0.15) !important; }
        .srp-tpl-btn:hover { background: rgba(99,179,237,0.1) !important; color: #63b3ed !important; border-color: rgba(99,179,237,0.3) !important; }
        .srp-outline-btn:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.12) !important; color: #e8e6e1 !important; }
        .srp-submit:hover:not(:disabled) { opacity: 0.88; }
        .srp-add-icon:hover { background: rgba(99,179,237,0.08) !important; border-color: rgba(99,179,237,0.3) !important; color: #63b3ed !important; }
        @media (max-width: 560px) {
          .srp-stats { grid-template-columns: 1fr 1fr !important; }
          .srp-footer-inner { flex-direction: column !important; }
          .srp-submit { width: 100% !important; justify-content: center !important; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .srp-wrap { animation: fadeIn 0.3s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="srp-wrap" style={{
        fontFamily: D.sans,
        background: D.bg,
        color: D.text,
        fontSize: 14, lineHeight: 1.6,
        maxWidth: 760, margin: "0 auto",
        padding: "28px 20px 120px",
        minHeight: "100vh",
      }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <FileText size={16} color={D.accent} />
            <span style={{
              fontSize: 11, fontFamily: D.mono, color: D.accent,
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              {isView ? "view_report" : existingReport ? "edit_report" : "new_report"}
            </span>
          </div>
          <h1 style={{
            fontSize: 24, fontWeight: 500, margin: 0,
            letterSpacing: "-0.5px", color: D.text,
            fontFamily: D.sans,
          }}>
            {isView
              ? "Today's Report"
              : existingReport
              ? "Edit Daily Report"
              : "Submit Daily Report"}
          </h1>
          <p style={{ fontSize: 13, color: D.textMuted, margin: "5px 0 0", fontFamily: D.sans }}>
            Log your sessions, tasks, and progress for the day
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="srp-stats" style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 10, marginBottom: 16,
        }}>
          <StatCard icon={Clock}        label="total_hours" value={`${hours}h`}   accent={D.accent}  dim={D.accentDim} />
          <StatCard icon={Calendar}     label="time_slots"  value={slots.length}                     />
          <StatCard icon={CheckCircle2} label="completed"   value={completed}     accent={D.green}   dim={D.greenDim}  />
          <StatCard icon={AlertCircle}  label="pending"     value={pending}       accent={D.amber}   dim={D.amberDim}  />
        </div>

        {/* ── Progress bar ── */}
        <div style={{
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: D.radius, padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textDim, letterSpacing: "0.06em" }}>
              completion_rate
            </span>
            <span style={{ fontSize: 12, fontFamily: D.mono, color: D.accent, fontWeight: 500 }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: 3, width: `${pct}%`,
              background: `linear-gradient(90deg, ${D.accent}, ${D.green})`,
              borderRadius: 2, transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              boxShadow: pct > 0 ? `0 0 8px ${D.accent}60` : "none",
            }} />
          </div>
        </div>

        {/* ── Draft saved indicator ── */}
        {draftSaved && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 11, fontFamily: D.mono, color: D.green,
            background: D.greenDim, border: `1px solid ${D.green}30`,
            borderRadius: D.radius, padding: "7px 12px", marginBottom: 12,
          }}>
            <Save size={12} color={D.green} />
            draft_saved
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── Date row ── */}
          <div style={{
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: D.radius, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={fieldLbl}>report_date</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
                disabled={isView}
                className="srp-input"
                style={{
                  ...timeInp,
                  width: "auto",
                  opacity: isView ? 0.6 : 1,
                  cursor: isView ? "not-allowed" : "text",
                }}
              />
              {!existingReport && (
                <button
                  type="button"
                  onClick={() => setSlots(DEFAULT_SLOTS.map((s) => ({ ...s })))}
                  className="srp-ghost-btn"
                  style={ghostBtn}
                >
                  reset_defaults
                </button>
              )}
            </div>
          </div>

          {/* ── Slots ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((slot, i) => (
              <SlotCard
                key={i}
                slot={slot}
                index={i}
                total={slots.length}
                isView={isView}
                onChange={(field, value) => updateSlot(i, field, value)}
                onRemove={() => removeSlot(i)}
                onDuplicate={() => duplicateSlot(i)}
              />
            ))}

            {/* Add slot inline button */}
            {!isView && (
              <button
                type="button"
                onClick={addSlot}
                className="srp-add-icon"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 7, width: "100%",
                  padding: "11px",
                  background: "transparent",
                  border: `1px dashed ${D.border}`,
                  borderRadius: D.radius,
                  fontSize: 12, fontFamily: D.mono, color: D.textDim,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <Plus size={13} />
                add_slot
              </button>
            )}
          </div>

        </form>

        {/* ── Sticky footer ── */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(11,13,18,0.92)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${D.border}`,
          padding: "14px 24px",
          zIndex: 50,
        }}>
          <div className="srp-footer-inner" style={{
            display: "flex", gap: 8, alignItems: "center",
            maxWidth: 760, margin: "0 auto",
          }}>

            {/* Left: slot count */}
            <span style={{
              fontSize: 11, fontFamily: D.mono, color: D.textDim,
              background: D.raised, border: `1px solid ${D.border}`,
              borderRadius: D.radiusSm, padding: "4px 10px",
            }}>
              {slots.length} slot{slots.length !== 1 ? "s" : ""} · {hours}h
            </span>

            <div style={{ flex: 1 }} />

            {/* Edit button (view mode) */}
            {existingReport && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="srp-outline-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontFamily: D.mono, fontWeight: 500,
                  border: `1px solid ${D.border}`, borderRadius: D.radius,
                  background: "transparent", color: D.textMuted,
                  padding: "9px 16px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                edit_report
              </button>
            )}

            {/* Submit / Update */}
            <button
              type="submit"
              form="report-form"
              disabled={isSubmitting || isView}
              onClick={(e) => {
                if (!isView) {
                  e.preventDefault();
                  const form = document.querySelector<HTMLFormElement>(".srp-wrap form");
                  if (form) form.requestSubmit();
                  else handleSubmit(e as any);
                }
              }}
              className="srp-submit"
              style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 12, fontFamily: D.mono, fontWeight: 500,
                border: `1px solid ${isView ? D.border : D.accent + "50"}`,
                borderRadius: D.radius,
                background: isView ? D.raised : D.accentDim,
                color: isView ? D.textDim : D.accent,
                padding: "9px 20px", cursor: isView ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                boxShadow: isView ? "none" : `0 0 16px ${D.accent}18`,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  saving…
                </>
              ) : (
                <>
                  <Send size={13} />
                  {existingReport && isEditing ? "update_report" : "submit_report"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubmitReportPage;