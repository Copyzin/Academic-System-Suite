import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type z } from "zod";
import { useToast } from "./use-toast";

type CreateCourseInput = z.infer<typeof api.courses.create.input>;
type CreateSubjectInput = z.infer<typeof api.subjects.create.input>;

export function useCourses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: courses, isLoading, error } = useQuery({
    queryKey: [api.courses.list.path],
    queryFn: async () => {
      const res = await fetch(api.courses.list.path, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao buscar cursos" }));
        throw new Error(payload.message || "Falha ao buscar cursos");
      }
      return api.courses.list.responses[200].parse(await res.json());
    },
  });

  const createCourse = useMutation({
    mutationFn: async (data: CreateCourseInput) => {
      const res = await fetch(api.courses.create.path, {
        method: api.courses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao criar curso");
      return api.courses.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.courses.list.path] });
      toast({ title: "Curso criado", description: "O curso foi cadastrado com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar curso",
        description: error instanceof Error ? error.message : "Falha ao criar curso",
        variant: "destructive",
      });
    },
  });

  return { courses, isLoading, error, createCourse };
}

export function useCourse(id: number) {
  return useQuery({
    queryKey: [api.courses.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.courses.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao buscar curso" }));
        throw new Error(payload.message || "Falha ao buscar curso");
      }
      return api.courses.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useSubjects() {
  return useQuery({
    queryKey: [api.subjects.list.path],
    queryFn: async () => {
      const res = await fetch(api.subjects.list.path, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao buscar materias" }));
        throw new Error(payload.message || "Falha ao buscar materias");
      }
      return api.subjects.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSubjectInput) => {
      const res = await fetch(api.subjects.create.path, {
        method: api.subjects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao criar materia");
      return api.subjects.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      toast({ title: "Materia criada", description: "A materia foi adicionada com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar materia",
        description: error instanceof Error ? error.message : "Falha ao criar materia",
        variant: "destructive",
      });
    },
  });
}

export function useCourseSubjects(courseId: number) {
  return useQuery({
    queryKey: [api.courses.subjects.list.path, courseId],
    queryFn: async () => {
      const url = buildUrl(api.courses.subjects.list.path, { id: courseId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao buscar grade" }));
        throw new Error(payload.message || "Falha ao buscar grade");
      }
      return api.courses.subjects.list.responses[200].parse(await res.json());
    },
    enabled: !!courseId,
  });
}

export function useUpdateCourseSubjects(courseId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (subjectIds: number[]) => {
      const url = buildUrl(api.courses.subjects.update.path, { id: courseId });
      const res = await fetch(url, {
        method: api.courses.subjects.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds }),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao atualizar grade");
      return api.courses.subjects.update.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.courses.subjects.list.path, courseId] });
      queryClient.invalidateQueries({ queryKey: [api.courses.get.path, courseId] });
      toast({ title: "Grade atualizada", description: "A grade curricular foi salva." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar grade",
        description: error instanceof Error ? error.message : "Falha ao salvar grade",
        variant: "destructive",
      });
    },
  });
}
