import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";

const Login = lazy(() => import("@/pages/login"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const ResetPasswordCancel = lazy(() => import("@/pages/reset-password-cancel"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Courses = lazy(() => import("@/pages/courses"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const Students = lazy(() => import("@/pages/students"));
const Announcements = lazy(() => import("@/pages/announcements"));
const NotFound = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
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
