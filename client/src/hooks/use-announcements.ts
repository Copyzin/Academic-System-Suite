import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "./use-toast";

export function useAnnouncements(courseId?: number) {
  return useQuery({
    queryKey: [api.announcements.list.path, courseId],
    queryFn: async () => {
      const url = new URL(api.announcements.list.path, window.location.origin);
      if (courseId) url.searchParams.append("courseId", String(courseId));

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao carregar comunicados" }));
        throw new Error(payload.message || "Falha ao carregar comunicados");
      }

      return api.announcements.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      isGlobal: boolean;
      courseIds?: number[];
      expiresAt?: string;
    }) => {
      const res = await fetch(api.announcements.create.path, {
        method: api.announcements.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Falha ao publicar comunicado");
      return api.announcements.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] });
      toast({ title: "Comunicado publicado", description: "Publicacao realizada com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao publicar",
        description: error instanceof Error ? error.message : "Falha ao publicar comunicado",
        variant: "destructive",
      });
    },
  });
}
