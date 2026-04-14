import { create } from "zustand";
import type { User, DailyReport, Attendance, TimeSlot, TaskStatus, InstructorKPI } from "@/types";
import { toast } from "sonner";

// API Base URL - change this to your Django server URL
const API_BASE_URL = "https://kpi-record.onrender.com/api";

interface AppState {
  currentUser: User | null;
  instructors: User[];
  reports: DailyReport[];
  attendance: Attendance[];
  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  
  fetchInstructors: () => Promise<void>;
  fetchReports: (date?: string) => Promise<void>;
  fetchAttendance: (date?: string) => Promise<any>; // Return data
  fetchKPIs: () => Promise<InstructorKPI[]>;

  addReport: (report: Omit<DailyReport, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateReport: (report: DailyReport) => Promise<void>;
  getReportsByInstructor: (instructorId: string) => DailyReport[];
  getReportsByDate: (date: string) => DailyReport[];
  getTodayReport: (instructorId: string) => DailyReport | undefined;

  updateAttendance: (attendance: any) => Promise<any>; // Return response
  getAttendanceByDate: (date: string) => Attendance[];

  calculateKPI: (instructorId: string) => InstructorKPI;
  getAllKPIs: () => InstructorKPI[];
}

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem("access_token");
};

// Helper function for API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'include',
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.detail || error.error || error.message || JSON.stringify(error);
      } catch (e) {
        errorMessage = await response.text() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
    
  } catch (error: any) {
    console.error(`API Request failed for ${endpoint}:`, error);
    throw error;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  instructors: [],
  reports: [],
  attendance: [],
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      console.log("Attempting login with username:", username);
      
      const response = await fetch(`${API_BASE_URL}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username: username.trim(),
          password: password 
        }),
      });

      console.log("Response status:", response.status);
      
      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok && data.access) {
        localStorage.setItem("access_token", data.access);
        if (data.refresh) {
          localStorage.setItem("refresh_token", data.refresh);
        }
        
        let userData = null;
        
        if (data.user) {
          userData = data.user;
          console.log("User data found in response:", userData);
        } else {
          console.log("No user data in token response, fetching from /users/me/");
          try {
            const userResponse = await fetch(`${API_BASE_URL}/users/me/`, {
              headers: {
                "Authorization": `Bearer ${data.access}`
              }
            });
            if (userResponse.ok) {
              userData = await userResponse.json();
              console.log("Fetched user data:", userData);
            }
          } catch (err) {
            console.error("Failed to fetch user data:", err);
          }
        }
        
        if (userData) {
          const formattedUser: User = {
            id: String(userData.id || userData.user_id),
            username: userData.username || username,
            email: userData.email || `${username}@academy.com`,
            name: userData.name || userData.full_name || username,
            role: userData.role || (username === "admin" ? "admin" : "instructor"),
          };
          
          localStorage.setItem("user", JSON.stringify(formattedUser));
          set({ currentUser: formattedUser, loading: false });
          
          const { fetchInstructors, fetchReports, fetchAttendance, fetchKPIs } = get();
          await Promise.allSettled([
            fetchInstructors(),
            fetchReports(),
            fetchAttendance(),
            fetchKPIs(),
          ]);
          
          console.log("Login successful!");
          return true;
        } else {
          console.error("No user data available");
          set({ loading: false, error: "Unable to get user information" });
          return false;
        }
      } else {
        const errorMsg = data.error || data.detail || data.message || "Invalid credentials";
        console.error("Login failed:", errorMsg);
        set({ loading: false, error: errorMsg });
        return false;
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Invalid credentials. Please check your username and password.";
      
      if (error.message.includes("Failed to fetch") || error.message.includes("network")) {
        errorMessage = "Cannot connect to server. Please check if backend is running on https://kpi-record.onrender.com";
      } else if (error.message.includes("401")) {
        errorMessage = "Invalid username or password";
      }
      
      set({ loading: false, error: errorMessage, currentUser: null });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    set({ 
      currentUser: null, 
      instructors: [], 
      reports: [], 
      attendance: [],
      error: null,
      loading: false
    });
  },

  fetchInstructors: async () => {
    set({ loading: true });
    try {
      const users = await apiRequest("/users/");
      const instructors = Array.isArray(users) ? users.filter((u: User) => u.role === "instructor") : [];
      set({ instructors, loading: false });
    } catch (error: any) {
      console.error("Fetch instructors error:", error);
      set({ error: error.message, loading: false });
    }
  },

  fetchReports: async (date?: string) => {
    set({ loading: true, error: null });
    try {
      const currentUser = get().currentUser;
      if (!currentUser) {
        console.log("No current user, skipping fetch");
        set({ loading: false });
        return;
      }
      
      const token = getAuthToken();
      if (!token) {
        console.log("No auth token");
        set({ loading: false });
        return;
      }
      
      let url = `${API_BASE_URL}/reports/`;
      if (date) {
        url = `${API_BASE_URL}/reports/by-date/?date=${date}`;
      }
      
      console.log("Fetching reports from:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch reports: ${response.status}`);
      }
      
      const reportsData = await response.json();
      console.log("Raw API response:", reportsData);
      
      const reportsArray = Array.isArray(reportsData) ? reportsData : [];
      console.log(`Found ${reportsArray.length} total reports`);
      
      const transformedReports: DailyReport[] = reportsArray.map((report: any) => {
        return {
          id: report.id,
          instructorId: String(report.instructor_id),
          instructorName: report.instructor_name || currentUser.name,
          date: report.date,
          timeSlots: (report.time_slots || []).map((slot: any) => ({
            id: slot.id,
            reportId: slot.reportId || report.id,
            startTime: slot.start_time,
            endTime: slot.end_time,
            description: slot.description,
            status: slot.status as TaskStatus,
          })),
          createdAt: report.created_at || new Date().toISOString(),
          updatedAt: report.updated_at || new Date().toISOString(),
        };
      });
      
      console.log("Transformed reports:", transformedReports);
      
      set({ reports: transformedReports, loading: false });
    } catch (error: any) {
      console.error("Fetch reports error:", error);
      set({ error: error.message, loading: false });
      if (typeof toast !== 'undefined') {
        toast.error("Failed to load reports");
      }
    }
  },

  getReportsByInstructor: (instructorId) => {
    const state = get();
    const instructorIdStr = String(instructorId);
    const filtered = state.reports.filter((r) => String(r.instructorId) === instructorIdStr);
    return filtered;
  },

  fetchAttendance: async (date?: string) => {
    set({ loading: true });
    try {
      let url = "/attendance/";
      if (date) {
        url = `/attendance/?date=${date}`;
      }
      
      console.log("Fetching attendance from:", `${API_BASE_URL}${url}`);
      const attendanceData = await apiRequest(url);
      console.log("Raw attendance data:", attendanceData);
      
      // Handle different response formats
      let attendanceArray: any[] = [];
      if (Array.isArray(attendanceData)) {
        attendanceArray = attendanceData;
      } else if (attendanceData.results && Array.isArray(attendanceData.results)) {
        attendanceArray = attendanceData.results;
      } else if (attendanceData.data && Array.isArray(attendanceData.data)) {
        attendanceArray = attendanceData.data;
      }
      
      const transformedAttendance: Attendance[] = attendanceArray.map((att: any) => ({
        id: att.id,
        instructorId: String(att.instructor || att.instructor_id || att.instructorId),
        instructorName: att.instructor_name || att.instructor?.name || "",
        date: att.date,
        leaveType: att.leave_type || att.leaveType || "present",
        checkIn: att.check_in || att.checkIn || null,
        checkOut: att.check_out || att.checkOut || null,
        isLate: att.is_late || att.isLate || false,
        isEarlyLeave: att.is_early_leave || att.isEarlyLeave || false,
        notes: att.notes || "",
      }));
      
      console.log("Transformed attendance:", transformedAttendance);
      set({ attendance: transformedAttendance, loading: false });
      
      return attendanceData; // Return the raw data for the component
    } catch (error: any) {
      console.error("Fetch attendance error:", error);
      set({ error: error.message, loading: false });
      return [];
    }
  },

  fetchKPIs: async () => {
    try {
      const kpis = await apiRequest("/kpi/all/");
      return Array.isArray(kpis) ? kpis : [];
    } catch (error: any) {
      console.error("Fetch KPIs error:", error);
      set({ error: error.message });
      return [];
    }
  },

  addReport: async (reportData) => {
    set({ loading: true, error: null });
    try {
      const transformedData = {
        date: reportData.date,
        time_slots: reportData.timeSlots.map((slot: any) => ({
          start_time: slot.startTime,
          end_time: slot.endTime,
          description: slot.description,
          status: slot.status,
        })),
      };
      
      console.log("Sending to API:", JSON.stringify(transformedData, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/reports/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(transformedData),
      });
      
      const responseData = await response.json();
      console.log("API Response status:", response.status);
      console.log("API Response data:", responseData);
      
      if (!response.ok) {
        let errorMessage = "Failed to create report";
        if (responseData.error) {
          errorMessage = responseData.error;
        }
        if (responseData.details) {
          errorMessage = JSON.stringify(responseData.details);
        }
        throw new Error(errorMessage);
      }
      
      console.log("Report created successfully:", responseData);
      
      const newReport: DailyReport = {
        id: responseData.id,
        instructorId: String(responseData.instructor_id || get().currentUser?.id || ''),
        instructorName: responseData.instructor_name || get().currentUser?.name || '',
        date: responseData.date,
        timeSlots: (responseData.time_slots || []).map((slot: any) => ({
          id: slot.id,
          reportId: slot.reportId || responseData.id,
          startTime: slot.start_time,
          endTime: slot.end_time,
          description: slot.description,
          status: slot.status as TaskStatus,
        })),
        createdAt: responseData.created_at || new Date().toISOString(),
        updatedAt: responseData.updated_at || new Date().toISOString(),
      };
      
      set((state) => ({
        reports: [...state.reports, newReport],
        loading: false,
      }));
      
      toast.success("Report submitted successfully");
      return responseData;
    } catch (error: any) {
      console.error("Add report error:", error);
      set({ error: error.message, loading: false });
      toast.error(error.message || "Failed to create report");
      throw error;
    }
  },

  updateReport: async (report) => {
    set({ loading: true, error: null });
    try {
      const transformedData = {
        date: report.date,
        time_slots: report.timeSlots.map((slot) => ({
          start_time: slot.startTime,
          end_time: slot.endTime,
          description: slot.description,
          status: slot.status,
        })),
      };
      
      console.log("Updating report:", JSON.stringify(transformedData, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/reports/${report.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(transformedData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update report");
      }
      
      const responseData = await response.json();
      
      const updatedReport: DailyReport = {
        id: report.id,
        instructorId: report.instructorId,
        instructorName: report.instructorName || get().currentUser?.name || '',
        date: report.date,
        timeSlots: (responseData.time_slots || transformedData.time_slots).map((slot: any, index: number) => ({
          id: slot.id || `temp_${index}`,
          reportId: report.id,
          startTime: slot.start_time || slot.startTime,
          endTime: slot.end_time || slot.endTime,
          description: slot.description,
          status: slot.status as TaskStatus,
        })),
        createdAt: report.createdAt,
        updatedAt: new Date().toISOString(),
      };
      
      set((state) => ({
        reports: state.reports.map((r) => 
          r.id === report.id ? updatedReport : r
        ),
        loading: false,
      }));
      
      toast.success("Report updated successfully");
    } catch (error: any) {
      console.error("Update report error:", error);
      set({ error: error.message, loading: false });
      toast.error(error.message || "Failed to update report");
      throw error;
    }
  },

  getReportsByDate: (date) => {
    return get().reports.filter((r) => r.date === date);
  },

  getTodayReport: (instructorId) => {
    const todayStr = new Date().toISOString().split("T")[0];
    return get().reports.find(
      (r) => String(r.instructorId) === String(instructorId) && r.date === todayStr
    );
  },

  updateAttendance: async (attendance: any) => {
    set({ loading: true, error: null });
    try {
      let url = "/attendance/";
      let method = "POST";
      
      // Prepare data according to your Django backend expected format
      const requestData = {
        instructor: attendance.instructorId, // Send as 'instructor' not 'instructorId'
        date: attendance.date,
        leave_type: attendance.leave_type || attendance.leaveType,
        check_in: attendance.check_in || attendance.checkIn || null,
        check_out: attendance.check_out || attendance.checkOut || null,
        is_late: attendance.is_late !== undefined ? attendance.is_late : (attendance.isLate || false),
        is_early_leave: attendance.is_early_leave !== undefined ? attendance.is_early_leave : (attendance.isEarlyLeave || false),
        notes: attendance.notes || "",
      };
      
      // If updating existing record
      if (attendance.id) {
        url = `/attendance/${attendance.id}/`;
        method = "PUT";
      }
      
      console.log(`Sending ${method} request to:`, `${API_BASE_URL}${url}`);
      console.log("Request data:", requestData);
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(requestData),
      });
      
      const responseData = await response.json();
      console.log("API Response status:", response.status);
      console.log("API Response data:", responseData);
      
      if (!response.ok) {
        let errorMessage = "Failed to save attendance";
        if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (typeof responseData === 'string') {
          errorMessage = responseData;
        }
        throw new Error(errorMessage);
      }
      
      // Refresh attendance data for the date
      const currentDate = attendance.date || new Date().toISOString().split("T")[0];
      await get().fetchAttendance(currentDate);
      
      set({ loading: false });
      toast.success(attendance.id ? "Attendance updated successfully" : "Attendance marked successfully");
      
      return responseData;
    } catch (error: any) {
      console.error("Update attendance error:", error);
      set({ error: error.message, loading: false });
      toast.error(error.message || "Failed to save attendance");
      throw error;
    }
  },

  getAttendanceByDate: (date) => {
    const state = get();
    const filtered = state.attendance.filter((a) => a.date === date);
    console.log(`getAttendanceByDate for ${date}: found ${filtered.length} records`);
    return filtered;
  },

  calculateKPI: (instructorId) => {
    const state = get();
    const instructor = state.instructors.find((i) => String(i.id) === String(instructorId));
    const reports = state.reports.filter((r) => String(r.instructorId) === String(instructorId));
    const attendanceRecords = state.attendance.filter((a) => String(a.instructorId) === String(instructorId));

    const totalDays = attendanceRecords.length || 1;
    const presentDays = attendanceRecords.filter((a) => a.leaveType === "present").length;
    const attendanceScore = (presentDays / totalDays) * 100;

    const allSlots = reports.flatMap((r) => r.timeSlots);
    const completedTasks = allSlots.filter((s) => s.status === "completed").length;
    const totalTasks = allSlots.length || 1;
    const taskCompletionScore = (completedTasks / totalTasks) * 100;

    const lateCount = attendanceRecords.filter((a) => a.isLate).length;
    const earlyLeaveCount = attendanceRecords.filter((a) => a.isEarlyLeave).length;
    const disciplineDeductions = ((lateCount + earlyLeaveCount) / totalDays) * 100;
    const timeDisciplineScore = Math.max(0, 100 - disciplineDeductions);

    const finalKPI = attendanceScore * 0.3 + taskCompletionScore * 0.4 + timeDisciplineScore * 0.3;

    let totalWorkingHours = 0;
    allSlots.forEach((slot) => {
      if (slot.startTime && slot.endTime) {
        const [sh, sm] = slot.startTime.split(":").map(Number);
        const [eh, em] = slot.endTime.split(":").map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          totalWorkingHours += (eh * 60 + em - sh * 60 - sm) / 60;
        }
      }
    });
    
    const missedClasses = allSlots.filter((s) => s.status === "cancelled").length;

    return {
      instructorId: String(instructorId),
      instructorName: instructor?.name ?? "Unknown",
      attendanceScore: Math.round(attendanceScore),
      taskCompletionScore: Math.round(taskCompletionScore),
      timeDisciplineScore: Math.round(timeDisciplineScore),
      finalKPI: Math.round(finalKPI),
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
      totalClasses: allSlots.length,
      missedClasses,
      presentDays,
      totalDays,
    };
  },

  getAllKPIs: () => {
    const state = get();
    return state.instructors.map((i) => state.calculateKPI(String(i.id)));
  },
}));

// Initialize store with saved user session
const initializeStore = async () => {
  const savedUser = localStorage.getItem("user");
  const token = localStorage.getItem("access_token");
  
  if (savedUser && token) {
    try {
      const user = JSON.parse(savedUser);
      const store = useAppStore.getState();
      store.currentUser = user;
      
      console.log("Initializing store with user:", user);
      
      await Promise.allSettled([
        store.fetchInstructors(),
        store.fetchReports(),
        store.fetchAttendance(),
        store.fetchKPIs(),
      ]);
      
      console.log("Store initialized with saved session");
    } catch (error) {
      console.error("Failed to initialize store:", error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    }
  }
};

// Initialize on app load
if (typeof window !== "undefined") {
  initializeStore();
}