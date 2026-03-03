import { Link } from "wouter";
import { BarChart3, Bell, BookOpen, Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-dashboard";
import { useCourses } from "@/hooks/use-courses";
import { useEnrollments } from "@/hooks/use-enrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function pickIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("financeiro") || lower.includes("r$")) return DollarSign;
  if (lower.includes("presenca")) return TrendingUp;
  if (lower.includes("curso")) return BookOpen;
  if (lower.includes("aluno")) return Users;
  if (lower.includes("nota")) return BarChart3;
  if (lower.includes("horario")) return Calendar;
  return Bell;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { courses } = useCourses();
  const { data: enrollments } = useEnrollments(user?.role === "student" ? { studentId: user.id } : undefined);

  if (!user) return null;

  const teacherCourses = courses?.filter((course) => course.teacherId === user.id) ?? [];
  const studentEnrollments = enrollments ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-3xl font-bold tracking-tight">Painel de Controle</h2>
        <p className="text-muted-foreground">Visao personalizada para {user.role === "admin" ? "Administracao" : user.role === "teacher" ? "Professor" : "Aluno"}.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Indicadores principais">
        {dashboardLoading
          ? [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full rounded-xl" />)
          : dashboard?.cards.map((card) => {
              const Icon = pickIcon(card.label);
              return (
                <Card key={card.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                      <h3 className="text-2xl font-bold mt-0.5">{card.value}</h3>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(user.role === "admin" || user.role === "teacher") && (
          <Card>
            <CardHeader>
              <CardTitle>Agenda de Aulas</CardTitle>
              <CardDescription>Horario de aulas e turmas vinculadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(user.role === "admin" ? courses : teacherCourses)?.slice(0, 6).map((course) => (
                <div key={course.id} className="p-3 rounded-lg border bg-white flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{course.name}</p>
                    <p className="text-xs text-muted-foreground">{course.schedule || "Horario a definir"}</p>
                  </div>
                  <Badge variant="outline">Ativo</Badge>
                </div>
              ))}
              {((user.role === "admin" ? courses : teacherCourses)?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum horario cadastrado.</p>
              )}
            </CardContent>
          </Card>
        )}

        {user.role === "student" && (
          <Card>
            <CardHeader>
              <CardTitle>Meu Horario</CardTitle>
              <CardDescription>Resumo de aulas e presenca individual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentEnrollments.slice(0, 6).map((item) => (
                <div key={item.id} className="p-3 rounded-lg border bg-white">
                  <p className="font-medium text-sm">{item.courseName}</p>
                  <p className="text-xs text-muted-foreground">Presenca: {item.attendance ?? 0}% | Nota: {item.grade ?? "-"}</p>
                </div>
              ))}
              {studentEnrollments.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem dados academicos no momento.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Atalhos rapidos</CardTitle>
            <CardDescription>Acoes mais utilizadas por perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/announcements" className="block">
              <Button variant="outline" className="w-full justify-start">Ver comunicados</Button>
            </Link>
            <Link href="/courses" className="block">
              <Button variant="outline" className="w-full justify-start">Explorar cursos</Button>
            </Link>
            {(user.role === "admin" || user.role === "teacher") && (
              <Link href="/students" className="block">
                <Button variant="outline" className="w-full justify-start">Gerenciar alunos</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
