import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Plus, Search } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import { useCourses } from "@/hooks/use-courses";
import { useEnrollStudent } from "@/hooks/use-enrollments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formSchema = z.object({
  name: z.string().min(3, "Nome completo obrigatorio"),
  cpf: z.string().min(11, "CPF obrigatorio"),
  phone: z.string().min(8, "Telefone obrigatorio"),
  email: z.string().email("E-mail invalido"),
  courseId: z.coerce.number().int().positive("Curso obrigatorio"),
});

type FormData = z.infer<typeof formSchema>;

export default function Students() {
  const { data: students, isLoading } = useUsers("student");
  const { courses } = useCourses();
  const enrollStudent = useEnrollStudent();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      cpf: "",
      phone: "",
      email: "",
      courseId: 0,
    },
  });

  const filteredStudents = useMemo(() => {
    const normalized = search.toLowerCase();
    return students?.filter((student) => {
      return (
        student.name.toLowerCase().includes(normalized) ||
        student.email.toLowerCase().includes(normalized) ||
        student.ra.toLowerCase().includes(normalized)
      );
    });
  }, [students, search]);

  const onSubmit = (data: FormData) => {
    enrollStudent.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Diretorio de Alunos</h2>
          <p className="text-muted-foreground mt-1">Cadastro, matricula e acompanhamento de alunos ativos.</p>
        </div>

        <div className="flex w-full md:w-auto gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, e-mail ou R.A..."
              className="pl-10 bg-white"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Matricular aluno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Matricular aluno</DialogTitle>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input {...form.register("cpf")} />
                    {form.formState.errors.cpf && (
                      <p className="text-xs text-destructive">{form.formState.errors.cpf.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input {...form.register("phone")} />
                    {form.formState.errors.phone && (
                      <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Curso</Label>
                  <Select
                    onValueChange={(value) => form.setValue("courseId", Number(value), { shouldValidate: true })}
                    value={form.watch("courseId") ? String(form.watch("courseId")) : undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={String(course.id)}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.courseId && (
                    <p className="text-xs text-destructive">{form.formState.errors.courseId.message}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={enrollStudent.isPending}>
                    {enrollStudent.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Matriculando...
                      </>
                    ) : (
                      "Confirmar matricula"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredStudents?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum aluno encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]" />
                  <TableHead>Nome</TableHead>
                  <TableHead>R.A</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents?.map((student) => (
                  <TableRow key={student.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <Avatar className="h-9 w-9 border">
                        <AvatarImage src={student.avatarUrl || undefined} alt={`Foto de ${student.name}`} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                          {student.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.ra}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" /> {student.email}
                      </div>
                    </TableCell>
                    <TableCell>{student.courseName || "Nao definido"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                        Ativo
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {student.createdAt ? new Date(student.createdAt).toLocaleDateString("pt-BR") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
