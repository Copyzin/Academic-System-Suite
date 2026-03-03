import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "./use-toast";

export function useEnrollments(params?: { courseId?: number; studentId?: number }) {
  return useQuery({
    queryKey: [api.enrollments.list.path, params],
    queryFn: async () => {
      const url = new URL(api.enrollments.list.path, window.location.origin);
      if (params?.courseId) url.searchParams.append("courseId", String(params.courseId));
      if (params?.studentId) url.searchParams.append("studentId", String(params.studentId));

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao buscar matriculas" }));
        throw new Error(payload.message || "Falha ao buscar matriculas");
      }

      return api.enrollments.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; grade?: number; attendance?: number }) => {
      const url = buildUrl(api.enrollments.update.path, { id });
      const res = await fetch(url, {
        method: api.enrollments.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao atualizar matricula");
      return api.enrollments.update.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
      toast({ title: "Matricula atualizada", description: "Nota/presenca salvas com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Falha ao atualizar matricula",
        variant: "destructive",
      });
    },
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { studentId: number; courseId: number; grade?: number; attendance?: number }) => {
      const res = await fetch(api.enrollments.create.path, {
        method: api.enrollments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao criar matricula");
      return api.enrollments.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
      toast({ title: "Matricula criada", description: "Aluno matriculado com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro na matricula",
        description: error instanceof Error ? error.message : "Falha ao matricular aluno",
        variant: "destructive",
      });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      cpf: string;
      phone: string;
      email: string;
      courseId: number;
    }) => {
      const res = await fetch(api.students.enroll.path, {
        method: api.students.enroll.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao matricular aluno");
      return api.students.enroll.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path, "student"] });
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
      toast({ title: "Aluno matriculado", description: "Cadastro realizado com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro na matricula",
        description: error instanceof Error ? error.message : "Falha ao matricular aluno",
        variant: "destructive",
      });
    },
  });
}
