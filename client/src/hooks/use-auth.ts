import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type z } from "zod";
import { useToast } from "./use-toast";

type LoginInput = z.infer<typeof api.auth.login.input>;
type ChangePasswordInput = z.infer<typeof api.auth.changePassword.input>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const userQuery = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Falha ao carregar sessao");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Falha no login" }));
        throw new Error(payload.message || "Falha no login");
      }

      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({
        title: "Acesso liberado",
        description: `Bem-vindo, ${user.name}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro de autenticacao",
        description: getErrorMessage(error, "Credenciais invalidas"),
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      const res = await fetch(api.auth.changePassword.path, {
        method: api.auth.changePassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || "Falha ao alterar senha");
      }

      return payload;
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Nao foi possivel alterar",
        description: getErrorMessage(error, "Falha ao alterar senha"),
        variant: "destructive",
      });
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    login: loginMutation,
    logout: logoutMutation,
    changePassword: changePasswordMutation,
  };
}
