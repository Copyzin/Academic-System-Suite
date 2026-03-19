import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "./use-toast";

export function useMaterials() {
  return useQuery({
    queryKey: [api.materials.list.path],
    queryFn: async () => {
      const res = await fetch(api.materials.list.path, { credentials: "include" });
      const payload = await res.json().catch(() => ({ message: "Falha ao carregar materiais" }));

      if (!res.ok) {
        throw new Error(payload.message || "Falha ao carregar materiais");
      }

      return api.materials.list.responses[200].parse(payload);
    },
  });
}

export function useUploadMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { file: File; subjectId: number; classSectionIds: number[]; issuedAt?: string }) => {
      const formData = new FormData();
      formData.append("file", input.file);
      formData.append("subjectId", String(input.subjectId));
      for (const classSectionId of input.classSectionIds) {
        formData.append("classSectionIds", String(classSectionId));
      }
      if (input.issuedAt) {
        formData.append("issuedAt", new Date(input.issuedAt).toISOString());
      }

      const res = await fetch(api.materials.upload.path, {
        method: api.materials.upload.method,
        body: formData,
        credentials: "include",
      });

      const payload = await res.json().catch(() => ({ message: "Falha ao enviar material" }));
      if (!res.ok) {
        throw new Error(payload.message || "Falha ao enviar material");
      }

      return api.materials.upload.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      toast({ title: "Material enviado", description: "Upload concluido com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha ao enviar material",
        variant: "destructive",
      });
    },
  });
}

export function usePinMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (materialId: number) => {
      const url = buildUrl(api.materials.pin.path, { id: materialId });
      const res = await fetch(url, {
        method: api.materials.pin.method,
        credentials: "include",
      });

      const payload = await res.json().catch(() => ({ message: "Falha ao fixar material" }));
      if (!res.ok) throw new Error(payload.message || "Falha ao fixar material");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao fixar",
        description: error instanceof Error ? error.message : "Falha ao fixar material",
        variant: "destructive",
      });
    },
  });
}

export function useUnpinMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (materialId: number) => {
      const url = buildUrl(api.materials.unpin.path, { id: materialId });
      const res = await fetch(url, {
        method: api.materials.unpin.method,
        credentials: "include",
      });

      const payload = await res.json().catch(() => ({ message: "Falha ao desfixar material" }));
      if (!res.ok) throw new Error(payload.message || "Falha ao desfixar material");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao desfixar",
        description: error instanceof Error ? error.message : "Falha ao desfixar material",
        variant: "destructive",
      });
    },
  });
}
