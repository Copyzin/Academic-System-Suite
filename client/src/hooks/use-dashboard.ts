import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useDashboard() {
  return useQuery({
    queryKey: [api.dashboard.get.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.get.path, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha ao carregar painel" }));
        throw new Error(payload.message || "Falha ao carregar painel");
      }
      return api.dashboard.get.responses[200].parse(await res.json());
    },
  });
}
