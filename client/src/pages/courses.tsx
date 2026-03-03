import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Calendar, Loader2, Plus, Search, User } from "lucide-react";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { useUsers } from "@/hooks/use-users";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const courseSchema = api.courses.create.input;

type CourseForm = z.infer<typeof courseSchema>;

export default function Courses() {
  const { user } = useAuth();
  const { courses, isLoading, createCourse } = useCourses();
  const { data: teachers } = useUsers("teacher");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const form = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: "",
      description: "",
      schedule: "",
      teacherId: undefined,
    },
  });

  const canCreate = user?.role === "admin";

  const filteredCourses = courses?.filter((course) => {
    const normalizedSearch = search.toLowerCase();
    return (
      course.name.toLowerCase().includes(normalizedSearch) ||
      (course.description || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const onSubmit = (data: CourseForm) => {
    createCourse.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Cursos</h2>
          <p className="text-muted-foreground mt-1">Catalogo de cursos e acessos para grade curricular.</p>
        </div>

        {canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Criar curso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo curso</DialogTitle>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label>Nome do curso</Label>
                  <Input {...form.register("name")} placeholder="Ex: Analise e Desenvolvimento de Sistemas" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Horario</Label>
                  <Input {...form.register("schedule")} placeholder="Ex: Seg/Qua 19:00-21:00" />
                </div>

                <div className="space-y-2">
                  <Label>Professor responsavel</Label>
                  <Select
                    onValueChange={(value) => form.setValue("teacherId", Number(value))}
                    value={form.watch("teacherId") ? String(form.watch("teacherId")) : undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers?.map((teacher) => (
                        <SelectItem key={teacher.id} value={String(teacher.id)}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descricao</Label>
                  <Textarea {...form.register("description")} placeholder="Resumo objetivo do curso" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createCourse.isPending}>
                    {createCourse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar curso"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10 bg-white"
          placeholder="Pesquisar cursos..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
        Matricula de alunos centralizada na aba <strong>Alunos</strong>. Nesta tela voce gerencia cursos e grade curricular.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading
          ? [1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-56 w-full rounded-xl" />)
          : filteredCourses?.map((course) => (
              <Card key={course.id} className="group hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-slate-800 to-slate-700 text-white space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-white/20 text-white border-none">
                      {course.code}
                    </Badge>
                    <Badge variant="secondary" className="bg-emerald-500/90 text-white border-none">
                      Ativo
                    </Badge>
                  </div>
                  <CardTitle className="text-xl text-white">{course.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex-1 space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <User className="w-4 h-4" />
                    <span>{course.teacherName || "Professor nao atribuido"}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{course.schedule || "Horario a definir"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {course.description || "Sem descricao cadastrada."}
                  </p>
                </CardContent>
                <CardFooter className="p-6 pt-0 mt-auto">
                  <Link href={`/courses/${course.id}`} className="w-full">
                    <Button className="w-full">Abrir curso</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
      </div>

      {!isLoading && filteredCourses?.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
          <p className="text-muted-foreground">Nenhum curso encontrado.</p>
        </div>
      )}
    </div>
  );
}
