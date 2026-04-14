import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  type ReactNode,
} from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, isToday, parseISO, addDays, subDays } from "date-fns";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  Save,
  UserCheck,
  UserX,
  Clock3,
  Download,
  X,
  Minus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id?: number;
  instructor: number;
  instructor_name?: string;
  date: string;
  leave_type: string;
  check_in?: string;
  check_out?: string;
  is_late?: boolean;
  is_early_leave?: boolean;
  notes?: string;
}

interface AttendanceFormData {
  instructorId: string;
  date: string;
  leaveType: string;
  checkIn: string;
  checkOut: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  notes: string;
}

type LeaveType = "present" | "absent" | "half_day" | "leave";

interface Instructor {
  id: number;
  name: string;
  email?: string;
  role?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_OPTIONS = [
  {
    value: "present" as LeaveType,
    label: "Present",
    icon: CheckCircle2,
    accent: "#34d399",
    badge: "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20",
  },
  {
    value: "absent" as LeaveType,
    label: "Absent",
    icon: XCircle,
    accent: "#f16161",
    badge: "bg-red-500/[0.08] text-red-400 border-red-500/20",
  },
  {
    value: "half_day" as LeaveType,
    label: "Half Day",
    icon: Clock3,
    accent: "#fb923c",
    badge: "bg-orange-500/[0.08] text-orange-400 border-orange-500/20",
  },
  {
    value: "leave" as LeaveType,
    label: "On Leave",
    icon: UserX,
    accent: "#a78bfa",
    badge: "bg-violet-500/[0.08] text-violet-400 border-violet-500/20",
  },
] as const;

const AVATAR_PALETTE = [
  { bg: "bg-sky-500/15", text: "text-sky-300" },
  { bg: "bg-teal-500/15", text: "text-teal-300" },
  { bg: "bg-amber-500/15", text: "text-amber-300" },
  { bg: "bg-violet-500/15", text: "text-violet-300" },
  { bg: "bg-rose-500/15", text: "text-rose-300" },
  { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  { bg: "bg-lime-500/15", text: "text-lime-300" },
];

const TODAY_ISO = new Date().toISOString().split("T")[0];
const API_BASE_URL = "https://kpi-record.onrender.com/api";

const DEFAULT_FORM: AttendanceFormData = {
  instructorId: "",
  date: TODAY_ISO,
  leaveType: "present",
  checkIn: "09:00",
  checkOut: "17:00",
  isLate: false,
  isEarlyLeave: false,
  notes: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getInitials = (name: string): string =>
  name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);

const getLeaveOption = (type: string) =>
  LEAVE_OPTIONS.find((o) => o.value === type) ?? LEAVE_OPTIONS[0];

const calcDuration = (checkIn: string, checkOut: string): string => {
  if (!checkIn || !checkOut) return "—";
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const diff = toMins(checkOut) - toMins(checkIn);
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────

const Avatar = memo(({ name, index }: { name: string; index: number }) => {
  const c = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tracking-wide", c.bg, c.text)}>
      {getInitials(name)}
    </span>
  );
});
Avatar.displayName = "Avatar";

const StatusBadge = memo(({ leaveType }: { leaveType: string }) => {
  const opt = getLeaveOption(leaveType);
  const Icon = opt.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", opt.badge)}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

const Chip = memo(({ label, className }: { label: string; className: string }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", className)}>
    {label}
  </span>
));
Chip.displayName = "Chip";

const AttendanceTableRow = memo(({ 
  record, 
  instructor, 
  instructorIdx, 
  rowIdx, 
  isAdmin, 
  onEdit 
}: { 
  record: AttendanceRecord;
  instructor: Instructor | undefined;
  instructorIdx: number;
  rowIdx: number;
  isAdmin: boolean;
  onEdit: (record: AttendanceRecord) => void;
}) => {
  const name = instructor?.name ?? record.instructor_name ?? "Unknown";
  const dur = calcDuration(record.check_in ?? "", record.check_out ?? "");

  return (
    <tr className="group transition-colors hover:bg-white/[0.018]">
      <td className="px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Avatar name={name} index={instructorIdx >= 0 ? instructorIdx : rowIdx} />
          <span className="text-sm font-medium text-white/85 truncate max-w-[120px] sm:max-w-none">{name}</span>
        </div>
      </td>
      <td className="hidden sm:table-cell px-3 py-3 sm:px-5">
        {record.check_in ? (
          <span className="flex items-center gap-1.5 font-mono text-xs text-white/50">
            <Clock className="h-3 w-3 text-white/15" />
            {record.check_in}
          </span>
        ) : (
          <Minus className="h-3 w-3 text-white/15" />
        )}
      </td>
      <td className="hidden sm:table-cell px-3 py-3 sm:px-5">
        {record.check_out ? (
          <span className="flex items-center gap-1.5 font-mono text-xs text-white/50">
            <Clock className="h-3 w-3 text-white/15" />
            {record.check_out}
          </span>
        ) : (
          <Minus className="h-3 w-3 text-white/15" />
        )}
      </td>
      <td className="hidden md:table-cell px-3 py-3 sm:px-5">
        <span className="text-xs text-white/35">{dur}</span>
      </td>
      <td className="px-3 py-3 sm:px-5">
        <StatusBadge leaveType={record.leave_type} />
      </td>
      <td className="px-3 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1">
          {record.is_late && <Chip label="Late" className="border-amber-500/20 bg-amber-500/[0.07] text-amber-400" />}
          {record.is_early_leave && <Chip label="Early Leave" className="border-orange-500/20 bg-orange-500/[0.07] text-orange-400" />}
          {!record.is_late && !record.is_early_leave && record.leave_type === "present" && (
            <Chip label="On Time" className="border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400" />
          )}
          {record.leave_type !== "present" && <Minus className="h-3 w-3 text-white/15" />}
        </div>
      </td>
      <td className="hidden lg:table-cell max-w-[150px] px-3 py-3 sm:px-5">
        {record.notes ? (
          <p className="truncate text-xs text-white/25" title={record.notes}>{record.notes}</p>
        ) : (
          <Minus className="h-3 w-3 text-white/15" />
        )}
      </td>
      {isAdmin && (
        <td className="px-3 py-3 sm:px-5">
          <button
            onClick={() => onEdit(record)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.05] text-white/20 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white group-hover:opacity-100"
            title="Edit record"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
});
AttendanceTableRow.displayName = "AttendanceTableRow";

const MetricCard = memo(({ title, value, icon: Icon, accent, total }: { title: string; value: number; icon: React.ElementType; accent: string; total: number }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141720] p-4 sm:p-5 transition-all duration-300 hover:border-white/10 hover:bg-[#161b26]">
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-60" style={{ background: accent, opacity: 0.07 }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">{title}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-light tracking-tight text-white">{value}</p>
          {total > 0 && <p className="mt-0.5 text-[11px] text-white/20">{pct}% of staff</p>}
        </div>
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}1a` }}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
});
MetricCard.displayName = "MetricCard";

const PageSkeleton = memo(() => (
  <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-4 w-72 rounded-lg bg-white/[0.04]" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg bg-white/[0.04]" />
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
    <Skeleton className="h-14 rounded-xl bg-white/[0.04]" />
    <Skeleton className="h-[420px] rounded-2xl bg-white/[0.04]" />
  </div>
));
PageSkeleton.displayName = "PageSkeleton";

const AttendanceDialog = memo(({
  open,
  onClose,
  form,
  onChange,
  onSave,
  isEdit,
  instructors,
  isSaving,
  isAdmin,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  form: AttendanceFormData;
  onChange: (f: AttendanceFormData) => void;
  onSave: () => Promise<void>;
  isEdit: boolean;
  instructors: Instructor[];
  isSaving: boolean;
  isAdmin: boolean;
  currentUserId: string;
}) => {
  const patch = (p: Partial<AttendanceFormData>) => onChange({ ...form, ...p });
  const showTimes = form.leaveType === "present";

  const maxDate = isAdmin ? undefined : TODAY_ISO;
  const minDate = isAdmin ? "2024-01-01" : TODAY_ISO;

  // For non-admin users, automatically set their own ID
  useEffect(() => {
    if (!isAdmin && !isEdit && !form.instructorId) {
      patch({ instructorId: currentUserId });
    }
  }, [isAdmin, isEdit, currentUserId, form.instructorId, patch]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[460px] border-white/[0.07] bg-[#12151f] p-0 text-white shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 sm:px-6 py-4">
          <DialogTitle className="text-sm font-semibold text-white">
            {isEdit ? "Edit Attendance Record" : "Mark Attendance"}
          </DialogTitle>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 sm:px-6 py-5">
          {/* Instructor selector - only show for admin */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Instructor</Label>
              <Select 
                value={form.instructorId} 
                onValueChange={(v) => patch({ instructorId: v })} 
              >
                <SelectTrigger className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-white focus:ring-1 focus:ring-white/20">
                  <SelectValue placeholder="Select instructor…" />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#1a1f2e] text-white">
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => patch({ date: e.target.value })}
              min={minDate}
              max={maxDate}
              className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-white focus-visible:ring-1 focus-visible:ring-white/20"
            />
            {!isAdmin && <p className="text-[10px] text-white/20">Only today's date is allowed</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Status</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {LEAVE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.leaveType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patch({ leaveType: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 sm:gap-1.5 rounded-xl border p-2 sm:p-3 text-[10px] font-medium transition-all duration-150",
                      active ? "text-white" : "border-white/[0.05] text-white/25 hover:border-white/10 hover:text-white/40"
                    )}
                    style={active ? { background: `${opt.accent}12`, borderColor: `${opt.accent}35`, color: opt.accent } : {}}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-[10px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showTimes && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Check In</Label>
                <Input type="time" value={form.checkIn} onChange={(e) => patch({ checkIn: e.target.value })} className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-white focus-visible:ring-1 focus-visible:ring-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Check Out</Label>
                <Input type="time" value={form.checkOut} onChange={(e) => patch({ checkOut: e.target.value })} className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-white focus-visible:ring-1 focus-visible:ring-white/20" />
              </div>
            </div>
          )}

          {form.leaveType === "present" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Flags</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "isLate" as const, label: "Late Arrival" },
                  { key: "isEarlyLeave" as const, label: "Early Leave" },
                ].map(({ key, label }) => (
                  <label key={key} className={cn(
                    "flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2 sm:px-3 py-2 text-xs transition-all",
                    form[key] ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-white/[0.06] text-white/35 hover:border-white/10 hover:text-white/55"
                  )}>
                    <input type="checkbox" checked={form[key]} onChange={(e) => patch({ [key]: e.target.checked })} className="h-3.5 w-3.5 rounded accent-blue-500" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Notes <span className="ml-1 normal-case tracking-normal text-white/15">(optional)</span></Label>
            <Textarea
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Any additional context…"
              rows={2}
              className="resize-none border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-white/15 focus-visible:ring-1 focus-visible:ring-white/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 sm:px-6 py-4">
          <Button variant="ghost" onClick={onClose} className="h-9 text-white/35 hover:bg-white/[0.05] hover:text-white">Cancel</Button>
          <Button 
            onClick={onSave} 
            disabled={isSaving || (isAdmin && !form.instructorId)} 
            className="h-9 gap-2 bg-blue-600 px-4 sm:px-5 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
AttendanceDialog.displayName = "AttendanceDialog";

const NavButton = memo(({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
    {children}
  </button>
));
NavButton.displayName = "NavButton";

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

const AttendancePage = () => {
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AttendanceFormData>(DEFAULT_FORM);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

  const currentUser = useAppStore((s) => s.currentUser);
  const instructors = useAppStore((s) => s.instructors) as Instructor[];
  const fetchInstrs = useAppStore((s) => s.fetchInstructors);
  const loading = useAppStore((s) => s.loading);

  const isAdmin = currentUser?.role === "admin";
  const currentUserId = Number(currentUser?.id || 0);

  // Filter attendance by selected date and status
  const filteredAttendance = useMemo(() => {
    let filtered = attendanceData.filter(record => record.date === selectedDate);
    
    // For non-admin users, filter by their own ID
    if (!isAdmin) {
      filtered = filtered.filter(record => record.instructor === currentUserId);
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((a) => a.leave_type === statusFilter);
    }
    
    return filtered;
  }, [attendanceData, selectedDate, statusFilter, isAdmin, currentUserId]);

  const summary = useMemo(() => {
    const total = filteredAttendance.length;
    const present = filteredAttendance.filter((a) => a.leave_type === "present").length;
    const absent = filteredAttendance.filter((a) => a.leave_type === "absent").length;
    const halfDay = filteredAttendance.filter((a) => a.leave_type === "half_day").length;
    const onLeave = filteredAttendance.filter((a) => a.leave_type === "leave").length;
    const attendanceRate = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 0;
    return { total, present, absent, halfDay, onLeave, attendanceRate };
  }, [filteredAttendance]);

  // Load attendance data
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem("access_token");
      let url: string;
      
      if (isAdmin) {
        url = `${API_BASE_URL}/attendance/by-date/?date=${selectedDate}`;
      } else {
        url = `${API_BASE_URL}/attendance/`;
      }
      
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      const records = Array.isArray(data) ? data : data.results || [];
      setAttendanceData(records);
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
      toast.error("Failed to load attendance records");
    } finally {
      setIsRefreshing(false);
    }
  }, [isAdmin, selectedDate]);

  // Save attendance - FIXED: Send proper integer ID for instructor
  const saveAttendance = useCallback(async (payload: any) => {
    const token = localStorage.getItem("access_token");
    
    // Prepare data for backend - ensure instructor is a number
    const requestData: any = {
      date: payload.date,
      leave_type: payload.leave_type,
    };
    
    // Add optional fields if they have values
    if (payload.check_in && payload.check_in.trim()) {
      requestData.check_in = payload.check_in;
    }
    if (payload.check_out && payload.check_out.trim()) {
      requestData.check_out = payload.check_out;
    }
    if (payload.is_late !== undefined && payload.is_late !== null) {
      requestData.is_late = payload.is_late;
    }
    if (payload.is_early_leave !== undefined && payload.is_early_leave !== null) {
      requestData.is_early_leave = payload.is_early_leave;
    }
    if (payload.notes && payload.notes.trim()) {
      requestData.notes = payload.notes;
    }
    
    // Only admin can specify instructor - send as INTEGER
    if (isAdmin && payload.instructorId) {
      requestData.instructor = parseInt(payload.instructorId, 10);
    }
    
    const url = payload.id 
      ? `${API_BASE_URL}/attendance/${payload.id}/`
      : `${API_BASE_URL}/attendance/`;
    
    const method = payload.id ? "PUT" : "POST";
    
    console.log("Saving attendance:", { url, method, requestData });
    
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      let errorMessage = "Failed to save";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.error || JSON.stringify(error);
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const responseData = await response.json();
    console.log("Save successful:", responseData);
    return responseData;
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && instructors.length === 0) {
      fetchInstrs();
    }
  }, [isAdmin, instructors.length, fetchInstrs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = useCallback(() => {
    setSelectedRecord(null);
    setForm({ 
      ...DEFAULT_FORM, 
      date: selectedDate, 
      instructorId: isAdmin ? "" : String(currentUserId) 
    });
    setDialogOpen(true);
  }, [selectedDate, isAdmin, currentUserId]);

  const openEdit = useCallback((record: AttendanceRecord) => {
    setSelectedRecord(record);
    setForm({
      instructorId: String(record.instructor),
      date: record.date,
      leaveType: record.leave_type,
      checkIn: record.check_in || "09:00",
      checkOut: record.check_out || "17:00",
      isLate: record.is_late || false,
      isEarlyLeave: record.is_early_leave || false,
      notes: record.notes || "",
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedRecord(null);
  }, []);

  const handleSave = useCallback(async () => {
    // Validation
    if (isAdmin && !form.instructorId) {
      toast.error("Please select an instructor");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        id: selectedRecord?.id,
        instructorId: form.instructorId,
        date: form.date,
        leave_type: form.leaveType,
        check_in: form.checkIn,
        check_out: form.checkOut,
        is_late: form.isLate,
        is_early_leave: form.isEarlyLeave,
        notes: form.notes,
      };

      await saveAttendance(payload);
      toast.success(selectedRecord ? "Record updated" : "Attendance marked");
      closeDialog();
      await loadData();
    } catch (error: any) {
      console.error("Save error:", error);
      if (error?.message?.toLowerCase().includes("unique") || error?.message?.toLowerCase().includes("duplicate")) {
        toast.error("Attendance already marked for this instructor on this date");
      } else {
        toast.error(error?.message || "Failed to save attendance");
      }
    } finally {
      setIsSaving(false);
    }
  }, [form, selectedRecord, saveAttendance, loadData, closeDialog, isAdmin]);

  const handleExport = useCallback(() => {
    if (!filteredAttendance.length) {
      toast.error("No records to export");
      return;
    }
    const headers = ["Instructor", "Date", "Status", "Check In", "Check Out", "Duration", "Late", "Early Leave", "Notes"];
    const rows = filteredAttendance.map((a) => {
      const name = instructors.find((i) => i.id === a.instructor)?.name ?? a.instructor_name ?? "Unknown";
      return [
        name, a.date, a.leave_type,
        a.check_in ?? "", a.check_out ?? "",
        calcDuration(a.check_in ?? "", a.check_out ?? ""),
        a.is_late ? "Yes" : "No",
        a.is_early_leave ? "Yes" : "No",
        `"${(a.notes ?? "").replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    downloadCSV(csv, `attendance-${selectedDate}.csv`);
    toast.success(`Exported ${filteredAttendance.length} records`);
  }, [filteredAttendance, instructors, selectedDate]);

  const prevDay = useCallback(() => {
    setSelectedDate(d => format(subDays(parseISO(d), 1), "yyyy-MM-dd"));
  }, []);
  
  const nextDay = useCallback(() => {
    const next = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    if (!isAdmin && next > TODAY_ISO) return;
    setSelectedDate(next);
  }, [selectedDate, isAdmin]);

  if (loading && !attendanceData.length && !instructors.length) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-[22px] font-semibold tracking-tight text-white">Attendance</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-white/30">
            {isAdmin ? "Manage staff attendance records" : "Your attendance records"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredAttendance.length} className="h-9 gap-1.5 border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button size="sm" onClick={openCreate} className="h-9 gap-1.5 bg-blue-600 text-white hover:bg-blue-500">
            <UserCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark Attendance</span>
            <span className="inline sm:hidden">Mark</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard title="Total Staff" value={summary.total} icon={Calendar} accent="#4f8ef7" total={summary.total} />
        <MetricCard title="Present" value={summary.present} icon={CheckCircle2} accent="#34d399" total={summary.total} />
        <MetricCard title="Absent" value={summary.absent} icon={XCircle} accent="#f16161" total={summary.total} />
        <MetricCard title="On Leave" value={summary.onLeave} icon={UserX} accent="#a78bfa" total={summary.total} />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-[#141720] px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2">
          <NavButton onClick={prevDay}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </NavButton>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/25" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={!isAdmin ? TODAY_ISO : undefined}
              className="h-8 w-[140px] sm:w-[160px] border-white/[0.07] bg-white/[0.04] text-center text-sm text-white focus-visible:ring-1 focus-visible:ring-blue-500/40"
            />
          </div>
          <NavButton onClick={nextDay} disabled={!isAdmin && selectedDate >= TODAY_ISO}>
            <ChevronRight className="h-3.5 w-3.5" />
          </NavButton>
          {selectedDate === TODAY_ISO && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Today</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/[0.05] bg-[#0e1118] p-0.5">
            {[
              { value: "all", label: "All" },
              ...LEAVE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-md px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                  statusFilter === f.value ? "bg-white/[0.09] text-white" : "text-white/25 hover:text-white/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <NavButton onClick={loadData} disabled={isRefreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </NavButton>
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141720]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Records</span>
            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-white/30">{filteredAttendance.length}</span>
          </div>
          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white">
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {filteredAttendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
              <div className="mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white/15" />
              </div>
              <p className="text-sm font-medium text-white/30">No attendance records for {format(parseISO(selectedDate), "MMMM d, yyyy")}</p>
              <p className="mt-1 text-xs text-white/15">Attendance hasn't been marked yet for this date</p>
              <button onClick={openCreate} className="mt-5 rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white">
                Mark attendance now
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Instructor</th>
                  <th className="hidden sm:table-cell px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Check In</th>
                  <th className="hidden sm:table-cell px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Check Out</th>
                  <th className="hidden md:table-cell px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Duration</th>
                  <th className="px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Status</th>
                  <th className="px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Flags</th>
                  <th className="hidden lg:table-cell px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Notes</th>
                  {isAdmin && <th className="px-3 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white/20">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredAttendance.map((a, rowIdx) => {
                  const instr = instructors.find((i) => i.id === a.instructor);
                  const instrIdx = instructors.findIndex((i) => i.id === a.instructor);
                  return (
                    <AttendanceTableRow
                      key={a.id ?? rowIdx}
                      record={a}
                      instructor={instr}
                      instructorIdx={instrIdx}
                      rowIdx={rowIdx}
                      isAdmin={isAdmin}
                      onEdit={openEdit}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Legend & Footer */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        {LEAVE_OPTIONS.map((opt) => (
          <span key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-white/25 transition-colors hover:text-white/50" onClick={() => setStatusFilter((s) => s === opt.value ? "all" : opt.value)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: opt.accent }} />
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="inline sm:hidden">{opt.label.slice(0, 3)}</span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-white/15">
          {filteredAttendance.length} record{filteredAttendance.length !== 1 ? "s" : ""} for {format(parseISO(selectedDate), "MMM d, yyyy")}
        </span>
      </div>

      {/* Dialog */}
      <AttendanceDialog
        open={dialogOpen}
        onClose={closeDialog}
        form={form}
        onChange={setForm}
        onSave={handleSave}
        isEdit={!!selectedRecord}
        instructors={instructors}
        isSaving={isSaving}
        isAdmin={isAdmin}
        currentUserId={String(currentUserId)}
      />
    </div>
  );
};

export default AttendancePage;