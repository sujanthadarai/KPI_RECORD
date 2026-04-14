export type UserRole = "instructor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export type TaskStatus = "completed" | "pending" | "cancelled";

export interface TimeSlot {
  id: string;
  reportId: string;
  startTime: string;
  endTime: string;
  description: string;
  status: TaskStatus;
}

export interface DailyReport {
  id: string;
  instructorId: string;
  instructorName?: string; // Added for convenience when displaying
  date: string; // YYYY-MM-DD
  timeSlots: TimeSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  instructorId: string;
  instructorName?: string; // Added for displaying instructor name
  date: string;
  checkIn: string | null; // Can be null if not tracked
  checkOut: string | null; // Can be null if not tracked
  isLate: boolean;
  isEarlyLeave: boolean;
  leaveType: "present" | "absent" | "half_day" | "leave"; // Updated to match backend choices
}

export interface InstructorKPI {
  instructorId: string;
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

// API Response Types (matching DRF backend)
export interface APITokenResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface APIUserResponse {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface APITimeSlotResponse {
  id: string;
  report: string;
  reportId?: string;
  start_time: string;
  end_time: string;
  description: string;
  status: TaskStatus;
}

export interface APIDailyReportResponse {
  id: string;
  instructor_id: string;
  instructor_name: string;
  date: string;
  time_slots: APITimeSlotResponse[];
  created_at: string;
  updated_at: string;
}

export interface APIAttendanceResponse {
  id: string;
  instructor_id: string;
  instructor_name: string;
  date: string;
  leave_type: "present" | "absent" | "half_day" | "leave";
}

export interface APIKPIScore {
  instructorId: string;
  instructorName: string;
  totalClasses: number;
  totalWorkingHours: number;
  attendanceScore: number;
  taskCompletionScore: number;
  timeDisciplineScore: number;
  finalKPI: number;
}

// Request Types
export interface CreateReportRequest {
  id?: string;
  date: string;
  time_slots: Omit<APITimeSlotResponse, 'report' | 'reportId'>[];
}

export interface UpdateAttendanceRequest {
  date: string;
  leave_type: Attendance['leaveType'];
}

// Helper type for form submissions
export interface TimeSlotFormData {
  startTime: string;
  endTime: string;
  description: string;
  status: TaskStatus;
}

export interface DailyReportFormData {
  date: string;
  timeSlots: TimeSlotFormData[];
}