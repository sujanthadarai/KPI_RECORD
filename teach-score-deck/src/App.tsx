import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/useAppStore";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import InstructorDashboard from "@/pages/InstructorDashboard";
import SubmitReportPage from "@/pages/SubmitReportPage";
import MyReportsPage from "@/pages/MyReportsPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AttendancePage from "@/pages/AttendancePage";
import KPIPage from "@/pages/KPIPage";
import InstructorsPage from "@/pages/InstructorsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const currentUser = useAppStore((s) => s.currentUser);

  if (!currentUser) return <LoginPage />;

  if (currentUser.role === "instructor") {
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/instructor/dashboard" replace />} />
          <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
          <Route path="/instructor/submit-report" element={<SubmitReportPage />} />
          <Route path="/instructor/my-reports" element={<MyReportsPage />} />
          <Route path="/instructor/kpi" element={<KPIPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    );
  }

  // Admin routes
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/reports" element={<AdminDashboard />} />
        <Route path="/admin/attendance" element={<AttendancePage />} />
        <Route path="/admin/kpi" element={<KPIPage />} />
        <Route path="/admin/instructors" element={<InstructorsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthenticatedApp />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;