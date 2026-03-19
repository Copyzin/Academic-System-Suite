import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ComponentType, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@shared/routes";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";
import { LoginTransition } from "@/components/login-transition";
import { consumeLoginNavigation, consumePanelEntryTransition, markPanelEntryTransition } from "@/lib/auth-navigation";

const Login = lazy(() => import("@/pages/login"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const ResetPasswordCancel = lazy(() => import("@/pages/reset-password-cancel"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Courses = lazy(() => import("@/pages/courses"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const Students = lazy(() => import("@/pages/students"));
const Announcements = lazy(() => import("@/pages/announcements"));
const Finances = lazy(() => import("@/pages/finances"));
const Downloads = lazy(() => import("@/pages/downloads"));
const TeachingAssignment = lazy(() => import("@/pages/teaching-assignment"));
const NotFound = lazy(() => import("@/pages/not-found"));

const AUTH_FLOW_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

async function fetchRouteData<T>(path: string, parser: { parse(value: unknown): T }) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: "Falha ao preparar rota" }));
    throw new Error(payload.message || "Falha ao preparar rota");
  }

  return parser.parse(await res.json());
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function preloadDashboardModule() {
  // Garante que o chunk lazy do painel ja esteja resolvido antes de liberar o shell.
  return import("@/pages/dashboard");
}

function RouteFallback() {
  // Fallback visual unico usado durante carregamentos lazy/redirect.
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();

  // Redirecionamento seguro para raiz quando usuario cai em rota sem permissao.
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return <RouteFallback />;
}

function DashboardWithEntryTransition() {
  const { user } = useAuth();
  // O estado inicial ja consulta o marcador para evitar frame incorreto antes da transicao.
  const [showTransition, setShowTransition] = useState(() => {
    if (!user) return false;
    return consumePanelEntryTransition(user.id);
  });

  useEffect(() => {
    if (!showTransition || !user) return;

    let cancelled = false;
    const authUser = user;

    async function prepareDashboardView() {
      const preloadTasks: Promise<unknown>[] = [
        preloadDashboardModule(),
        queryClient.fetchQuery({
          queryKey: [api.dashboard.get.path],
          queryFn: () => fetchRouteData(api.dashboard.get.path, api.dashboard.get.responses[200]),
        }),
        queryClient.fetchQuery({
          queryKey: [api.notifications.list.path, true],
          queryFn: async () => {
            const url = new URL(api.notifications.list.path, window.location.origin);
            url.searchParams.set("unreadOnly", "true");
            return fetchRouteData(url.toString(), api.notifications.list.responses[200]);
          },
        }),
      ];

      if (authUser.role === "student") {
        const enrollmentsUrl = new URL(api.enrollments.list.path, window.location.origin);
        enrollmentsUrl.searchParams.set("studentId", String(authUser.id));

        preloadTasks.push(
          queryClient.fetchQuery({
            queryKey: [api.enrollments.list.path, { studentId: authUser.id }],
            queryFn: () =>
              fetchRouteData(enrollmentsUrl.toString(), api.enrollments.list.responses[200]),
          }),
        );
      } else {
        preloadTasks.push(
          queryClient.fetchQuery({
            queryKey: [api.courses.list.path],
            queryFn: () => fetchRouteData(api.courses.list.path, api.courses.list.responses[200]),
          }),
        );
      }

      await Promise.allSettled(preloadTasks);
      await waitForPaint();
      await waitForPaint();

      if (!cancelled) {
        setShowTransition(false);
      }
    }

    // Mantemos o overlay apenas enquanto os dados minimos do painel chegam
    // e o navegador tem pelo menos um paint estavel para montar o layout final.
    void prepareDashboardView();

    return () => {
      cancelled = true;
    };
  }, [showTransition, user]);

  if (showTransition) {
    return (
      <>
        <Suspense fallback={null}>
          <div className="pointer-events-none opacity-0" aria-hidden="true">
            <LayoutShell>
              <Dashboard />
            </LayoutShell>
          </div>
        </Suspense>
        <LoginTransition />
      </>
    );
  }

  return (
    <LayoutShell>
      <Dashboard />
    </LayoutShell>
  );
}

function AuthSessionNavigator() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Se o login acabou de ocorrer nesta sessao, sempre leva para "/" e marca
  // que o dashboard deve mostrar a transicao especial de entrada.
  useEffect(() => {
    if (!user) return;

    const shouldRedirectToDashboard = consumeLoginNavigation(user.id);
    if (!shouldRedirectToDashboard) return;

    markPanelEntryTransition(user.id);
    setLocation("/");
  }, [user, setLocation]);

  return null;
}

function NotFoundOrDashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Usuario autenticado nunca deve ficar preso no 404; volta para painel.
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (isLoading) return <RouteFallback />;
  if (user) return <RouteFallback />;
  return <NotFound />;
}

function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: ComponentType;
  allowedRoles?: Array<"admin" | "teacher" | "student">;
}) {
  const { user, isLoading } = useAuth();

  // Enquanto valida sessao, evita flicker de tela protegida.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Sem autenticacao, volta para login.
    return <Login />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Regra de RBAC no frontend: papel sem permissao e redirecionado.
    return <RedirectToDashboard />;
  }

  return (
    <LayoutShell>
      <Component />
    </LayoutShell>
  );
}

function DashboardRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!user) {
    return <Login />;
  }

  return <DashboardWithEntryTransition />;
}

function AuthFlowRoutes({ location }: { location: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        className="min-h-screen w-full overflow-x-hidden"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -18 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <Switch location={location}>
          <Route path="/login" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  const [location] = useLocation();
  const isAuthFlowRoute = AUTH_FLOW_PATHS.has(location);

  return (
    <Suspense fallback={<RouteFallback />}>
      {/* Observador global de sessao para decidir redirecionamento pos-login. */}
      <AuthSessionNavigator />
      {isAuthFlowRoute ? (
        <AuthFlowRoutes location={location} />
      ) : (
        <Switch>
          {/* Rotas publicas */}
          <Route path="/login" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/reset-password/cancel" component={ResetPasswordCancel} />

          {/* Rotas autenticadas */}
          <Route path="/" component={DashboardRoute} />
          <Route path="/courses" component={() => <ProtectedRoute component={Courses} />} />
          <Route path="/courses/:id" component={() => <ProtectedRoute component={CourseDetail} />} />
          <Route
            path="/students"
            component={() => <ProtectedRoute component={Students} allowedRoles={["admin", "teacher"]} />}
          />
          <Route path="/announcements" component={() => <ProtectedRoute component={Announcements} />} />
          <Route
            path="/finances"
            component={() => <ProtectedRoute component={Finances} allowedRoles={["admin", "student"]} />}
          />
          <Route
            path="/downloads"
            component={() => <ProtectedRoute component={Downloads} allowedRoles={["teacher", "student"]} />}
          />
          <Route
            path="/teaching-assignment"
            component={() => <ProtectedRoute component={TeachingAssignment} allowedRoles={["admin", "teacher"]} />}
          />

          {/* Fallback final com tratamento especial para usuario autenticado. */}
          <Route component={NotFoundOrDashboard} />
        </Switch>
      )}
    </Suspense>
  );
}

function App() {
  // Providers globais: cache de dados, tooltip e toaster.
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
