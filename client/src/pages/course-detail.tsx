import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Calendar, Clock, Save, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useCourse,
  useCourseSubjects,
  useCreateSubject,
  useSubjects,
  useUpdateCourseSubjects,
} from "@/hooks/use-courses";
import { useEnrollments, useUpdateEnrollment } from "@/hooks/use-enrollments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const subjectSchema = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  description: z.string().optional(),
  workloadHours: z.coerce.number().int().min(0),
});

type SubjectForm = z.infer<typeof subjectSchema>;

export default function CourseDetail() {
  const [, params] = useRoute("/courses/:id");
  const courseId = params ? parseInt(params.id, 10) : 0;

  const { user } = useAuth();
  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments({ courseId });
  const { data: allSubjects } = useSubjects();
  const { data: selectedSubjects } = useCourseSubjects(courseId);
  const updateCourseSubjects = useUpdateCourseSubjects(courseId);
  const updateEnrollment = useUpdateEnrollment();
  const createSubject = useCreateSubject();

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);

  const subjectForm = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: "",
      description: "",
      workloadHours: 60,
    },
  });

  useEffect(() => {
    if (!selectedSubjects) return;
    setSelectedSubjectIds(selectedSubjects.map((subject) => subject.id));
  }, [selectedSubjects]);

  const canEditGrades = user?.role === "teacher" || user?.role === "admin";
  const canEditCurriculum = user?.role === "admin";

  const enrollmentRows = useMemo(() => enrollments ?? [], [enrollments]);

  if (courseLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!course) {
    return <div className="p-8 text-center">Curso nao encontrado.</div>;
  }

  function toggleSubject(subjectId: number, checked: boolean) {
    setSelectedSubjectIds((current) => {
      if (checked) {
        if (current.includes(subjectId)) return current;
        return [...current, subjectId];
      }
      return current.filter((id) => id !== subjectId);
    });
  }

  function saveCurriculum() {
    updateCourseSubjects.mutate(selectedSubjectIds);
  }

  function handleGradeUpdate(id: number, grade?: number, attendance?: number) {
    updateEnrollment.mutate({
      id,
      grade,
      attendance,
    });
  }

  function onCreateSubject(data: SubjectForm) {
    createSubject.mutate(data, {
      onSuccess: () => {
        setIsSubjectDialogOpen(false);
        subjectForm.reset({ name: "", description: "", workloadHours: 60 });
      },
    });
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                {course.code}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {course.schedule || "Horario a definir"}
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{course.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="font-medium">{course.teacherName || "Professor nao atribuido"}</span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Matriculas realizadas na aba Alunos
          </Badge>
        </div>
        <p className="mt-6 text-muted-foreground max-w-3xl leading-relaxed">
          {course.description || "Sem descricao cadastrada para este curso."}
        </p>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="bg-white p-1 border border-border rounded-xl">
          <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="w-4 h-4 mr-2" />
            Alunos matriculados
          </TabsTrigger>
          <TabsTrigger value="curriculum" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Calendar className="w-4 h-4 mr-2" />
            Grade curricular
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Alunos e desempenho</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollmentsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : enrollmentRows.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum aluno matriculado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>R.A</TableHead>
                      <TableHead>Data de matricula</TableHead>
                      <TableHead>Presenca</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollmentRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.studentName}</TableCell>
                        <TableCell>{item.studentRa}</TableCell>
                        <TableCell>
                          {item.enrolledAt ? new Date(item.enrolledAt).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>
                          {canEditGrades ? (
                            <Input
                              type="number"
                              className="w-24 h-8"
                              defaultValue={item.attendance ?? 0}
                              onBlur={(event) => {
                                const attendance = Number(event.target.value);
                                if (Number.isNaN(attendance)) return;
                                handleGradeUpdate(item.id, item.grade ?? undefined, attendance);
                              }}
                            />
                          ) : (
                            <Badge variant="outline">{item.attendance ?? 0}%</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEditGrades ? (
                            <Input
                              type="number"
                              className="w-24 h-8"
                              defaultValue={item.grade ?? ""}
                              onBlur={(event) => {
                                const grade = Number(event.target.value);
                                if (Number.isNaN(grade)) return;
                                handleGradeUpdate(item.id, grade, item.attendance ?? undefined);
                              }}
                            />
                          ) : (
                            <span className="font-semibold">{item.grade ?? "-"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curriculum">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Materias do curso</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {canEditCurriculum
                    ? "Selecione materias da lista existente e salve a grade curricular."
                    : "Visualizacao da grade curricular cadastrada."}
                </p>
              </div>

              {canEditCurriculum && (
                <div className="flex gap-2">
                  <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Nova materia</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cadastrar materia</DialogTitle>
                      </DialogHeader>

                      <form onSubmit={subjectForm.handleSubmit(onCreateSubject)} className="space-y-4 mt-3">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input {...subjectForm.register("name")} />
                          {subjectForm.formState.errors.name && (
                            <p className="text-xs text-destructive">{subjectForm.formState.errors.name.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Carga horaria</Label>
                          <Input type="number" {...subjectForm.register("workloadHours")} />
                        </div>
                        <div className="space-y-2">
                          <Label>Descricao</Label>
                          <Textarea {...subjectForm.register("description")} />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={createSubject.isPending}>
                            {createSubject.isPending ? "Salvando..." : "Salvar materia"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Button onClick={saveCurriculum} disabled={updateCourseSubjects.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar grade
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {allSubjects?.map((subject) => {
                const checked = selectedSubjectIds.includes(subject.id);
                return (
                  <div key={subject.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleSubject(subject.id, Boolean(value))}
                      disabled={!canEditCurriculum}
                      aria-label={`Selecionar materia ${subject.name}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {subject.code} • {subject.workloadHours}h
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{subject.description || "Sem descricao."}</p>
                    </div>
                  </div>
                );
              })}

              {!allSubjects?.length && (
                <p className="text-sm text-muted-foreground">Nenhuma materia cadastrada ainda.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
