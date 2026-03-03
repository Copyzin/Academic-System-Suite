import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type z } from "zod";
import { useToast } from "./use-toast";

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function usePasswordRecovery() {
  const { toast } = useToast();

  const forgotPassword = useMutation({
    mutationFn: async (data: z.infer<typeof api.auth.forgotPassword.input>) => {
      const res = await fetch(api.auth.forgotPassword.path, {
        method: api.auth.forgotPassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(parseErrorMessage(payload, "Falha ao solicitar recuperacao"));
      }

      return payload;
    },
    onSuccess: (payload) => {
      toast({
        title: "Solicitacao recebida",
        description: payload.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na solicitacao",
        description: error instanceof Error ? error.message : "Falha ao solicitar recuperacao",
        variant: "destructive",
      });
    },
  });

  const validateToken = useMutation({
    mutationFn: async (data: z.infer<typeof api.auth.validateResetToken.input>) => {
      const res = await fetch(api.auth.validateResetToken.path, {
        method: api.auth.validateResetToken.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(parseErrorMessage(payload, "Falha ao validar token"));
      }

      return api.auth.validateResetToken.responses[200].parse(payload);
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (data: z.infer<typeof api.auth.resetPassword.input>) => {
      const res = await fetch(api.auth.resetPassword.path, {
        method: api.auth.resetPassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(parseErrorMessage(payload, "Falha ao redefinir senha"));
      }

      return payload;
    },
    onSuccess: (payload) => {
      toast({
        title: "Senha redefinida",
        description: payload.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao redefinir",
        description: error instanceof Error ? error.message : "Falha ao redefinir senha",
        variant: "destructive",
      });
    },
  });

  const cancelPasswordReset = useMutation({
    mutationFn: async (data: z.infer<typeof api.auth.cancelPasswordReset.input>) => {
      const res = await fetch(api.auth.cancelPasswordReset.path, {
        method: api.auth.cancelPasswordReset.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(parseErrorMessage(payload, "Falha ao cancelar solicitacao"));
      }

      return payload;
    },
  });

  return {
    forgotPassword,
    validateToken,
    resetPassword,
    cancelPasswordReset,
  };
}
