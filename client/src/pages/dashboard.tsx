import { Link } from "wouter";
import { motion } from "framer-motion";
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

const staggered = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeInUp = {
  initial: {
    y: 10,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.6, -0.05, 0.01, 0.99],
    },
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { courses } = useCourses();
  const { data: enrollments } = useEnrollments(user?.role === "student" ? { studentId: user.id } : undefined);

  if (!user) return null;

  const teacherCourses = courses?.filter((course) => course.teacherId === user.id) ?? [];
  const studentEnrollments = enrollments ?? [];

  return (
    <motion.div variants={staggered} className="space-y-8">
      <motion.header variants={fadeInUp} className="space-y-2">
        <h2 className="font-display text-4xl font-bold tracking-tight">Painel de Controle</h2>
        <p className="text-muted-foreground text-lg">Visao personalizada para {user.role === "admin" ? "Administracao" : user.role === "teacher" ? "Professor" : "Aluno"}.</p>
      </motion.header>

      <motion.section
        variants={staggered}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        aria-label="Indicadores principais"
      >
        {dashboardLoading
          ? [1, 2, 3].map((item) => <Skeleton key={item} className="h-32 w-full rounded-xl" />)
          : dashboard?.cards.map((card) => {
              const Icon = pickIcon(card.label);
              return (
                <motion.div variants={fadeInUp} whileHover={{ scale: 1.05 }} key={card.label}>
                  <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-8 flex items-center gap-6">
                      <div className="p-4 rounded-xl bg-primary/10">
                        <Icon className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-muted-foreground">{card.label}</p>
                        <h3 className="text-3xl font-bold mt-1">{card.value}</h3>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
      </motion.section>

      <motion.section variants={staggered} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {(user.role === "admin" || user.role === "teacher") && (
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <CardTitle>Agenda de Aulas</CardTitle>
                <CardDescription>Horario de aulas e turmas vinculadas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(user.role === "admin" ? courses : teacherCourses)?.slice(0, 6).map((course) => (
                  <motion.div
                    whileHover={{ scale: 1.02, x: 4 }}
                    key={course.id}
                    className="p-4 rounded-lg border bg-white flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-muted-foreground">{course.schedule || "Horario a definir"}</p>
                    </div>
                    <Badge variant="outline">Ativo</Badge>
                  </motion.div>
                ))}
                {((user.role === "admin" ? courses : teacherCourses)?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum horario cadastrado.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {user.role === "student" && (
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <CardTitle>Meu Horario</CardTitle>
                <CardDescription>Resumo de aulas e presenca individual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {studentEnrollments.slice(0, 6).map((item) => (
                  <motion.div
                    whileHover={{ scale: 1.02, x: 4 }}
                    key={item.id}
                    className="p-4 rounded-lg border bg-white"
                  >
                    <p className="font-medium">{item.courseName}</p>
                    <p className="text-sm text-muted-foreground">Presenca: {item.attendance ?? 0}% | Nota: {item.grade ?? "-"}</p>
                  </motion.div>
                ))}
                {studentEnrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados academicos no momento.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Atalhos rapidos</CardTitle>
              <CardDescription>Acoes mais utilizadas por perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/announcements" className="block">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" className="w-full justify-start text-base py-6">Ver comunicados</Button>
                </motion.div>
              </Link>
              <Link href="/courses" className="block">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" className="w-full justify-start text-base py-6">Explorar cursos</Button>
                </motion.div>
              </Link>
              {(user.role === "admin" || user.role === "teacher") && (
                <Link href="/students" className="block">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" className="w-full justify-start text-base py-6">Gerenciar alunos</Button>
                  </motion.div>
                </Link>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
