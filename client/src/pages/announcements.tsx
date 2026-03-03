import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Megaphone, Plus, User } from "lucide-react";
import { useAnnouncements, useCreateAnnouncement } from "@/hooks/use-announcements";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeLocalInput } from "@/components/date-time-local-input";

const schema = z.object({
  title: z.string().min(3, "Titulo obrigatorio"),
  content: z.string().min(3, "Conteudo obrigatorio"),
  isGlobal: z.boolean(),
  expiresAt: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Announcements() {
  const { user } = useAuth();
  const { data: announcements, isLoading } = useAnnouncements();
  const { courses } = useCourses();
  const createMutation = useCreateAnnouncement();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      content: "",
      isGlobal: true,
      expiresAt: "",
    },
  });

  const isGlobal = form.watch("isGlobal");
  const canPost = user?.role === "admin" || user?.role === "teacher";

  function toggleCourse(courseId: number, checked: boolean) {
    setSelectedCourseIds((current) => {
      if (checked) {
        if (current.includes(courseId)) return current;
        return [...current, courseId];
      }

      return current.filter((id) => id !== courseId);
    });
  }

  const sortedAnnouncements = useMemo(
    () =>
      (announcements ?? []).slice().sort((a, b) => {
        const dateA = new Date(a.createdAt ?? 0).getTime();
        const dateB = new Date(b.createdAt ?? 0).getTime();
        return dateB - dateA;
      }),
    [announcements],
  );

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        title: data.title,
        content: data.content,
        isGlobal: data.isGlobal,
        courseIds: data.isGlobal ? [] : selectedCourseIds,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          setSelectedCourseIds([]);
          form.reset({ title: "", content: "", isGlobal: true, expiresAt: "" });
        },
      },
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Comunicados</h2>
          <p className="text-muted-foreground mt-1">Anuncios gerais e direcionados por curso.</p>
        </div>

        {canPost && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo comunicado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar comunicado</DialogTitle>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Titulo</Label>
                  <Input {...form.register("title")} placeholder="Ex: Alteracao no calendario de provas" />
                  {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Conteudo</Label>
                  <Textarea {...form.register("content")} className="min-h-[120px]" />
                  {form.formState.errors.content && (
                    <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Comunicado geral</p>
                    <p className="text-xs text-muted-foreground">Quando ativo, o aviso aparece para todos os usuarios.</p>
                  </div>
                  <Switch
                    checked={isGlobal}
                    onCheckedChange={(checked) => {
                      form.setValue("isGlobal", checked);
                      if (checked) setSelectedCourseIds([]);
                    }}
                    aria-label="Definir comunicado geral"
                  />
                </div>

                {!isGlobal && (
                  <div className="space-y-2">
                    <Label>Cursos de destino</Label>
                    <div className="space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                      {courses?.map((course) => (
                        <div key={course.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedCourseIds.includes(course.id)}
                            onCheckedChange={(checked) => toggleCourse(course.id, Boolean(checked))}
                          />
                          <span className="text-sm">{course.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tempo limite (opcional)</Label>
                  <DateTimeLocalInput {...form.register("expiresAt")} />
                  <p className="text-xs text-muted-foreground">Ao atingir o tempo limite o comunicado desaparece automaticamente.</p>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Publicando..." : "Publicar comunicado"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3].map((item) => <Skeleton key={item} className="h-32 w-full rounded-xl" />)
        ) : sortedAnnouncements.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Nenhum comunicado publicado no momento.</p>
          </div>
        ) : (
          sortedAnnouncements.map((post) => (
            <Card key={post.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <h3 className="text-xl font-bold text-foreground">{post.title}</h3>
                  <div className="flex gap-2 items-center">
                    <Badge variant={post.isGlobal ? "secondary" : "outline"}>
                      {post.isGlobal ? "Geral" : "Direcionado"}
                    </Badge>
                    <div className="flex items-center text-xs text-muted-foreground gap-1 bg-slate-100 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString("pt-BR") : "-"}
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>

                <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>
                      Postado por <span className="font-medium text-foreground">{post.authorName || "Equipe"}</span>
                    </span>
                  </div>
                  {post.expiresAt && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                      Expira em {new Date(post.expiresAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
