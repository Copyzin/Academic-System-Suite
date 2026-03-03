import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";

import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ResetPasswordCancel from "@/pages/reset-password-cancel";
import Dashboard from "@/pages/dashboard";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import Students from "@/pages/students";
import Announcements from "@/pages/announcements";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <LayoutShell>
      <Component />
    </LayoutShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/reset-password/cancel" component={ResetPasswordCancel} />

      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/courses" component={() => <ProtectedRoute component={Courses} />} />
      <Route path="/courses/:id" component={() => <ProtectedRoute component={CourseDetail} />} />
      <Route path="/students" component={() => <ProtectedRoute component={Students} />} />
      <Route path="/announcements" component={() => <ProtectedRoute component={Announcements} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
