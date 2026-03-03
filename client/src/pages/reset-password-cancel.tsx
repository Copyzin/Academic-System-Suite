import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { usePasswordRecovery } from "@/hooks/use-password-recovery";

type Status = "loading" | "success" | "error";

export default function ResetPasswordCancel() {
  const [, setLocation] = useLocation();
  const { cancelPasswordReset } = usePasswordRecovery();
  const [status, setStatus] = useState<Status>("loading");

  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const requestId = Number(params.get("requestId") || "0");
    const cancelToken = params.get("cancelToken") || "";
    const deviceId = params.get("deviceId") || "";

    if (!requestId || !cancelToken || !deviceId) {
      setStatus("error");
      return;
    }

    cancelPasswordReset.mutate(
      {
        requestId,
        cancelToken,
        deviceId,
      },
      {
        onSuccess: () => setStatus("success"),
        onError: () => setStatus("error"),
      },
    );
  }, [cancelPasswordReset, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Cancelamento da redefinicao
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando cancelamento...
            </div>
          )}

          {status === "success" && (
            <p className="text-sm text-foreground">
              Solicitacao cancelada. O dispositivo usado na tentativa foi bloqueado por seguranca.
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">Nao foi possivel concluir o cancelamento automaticamente.</p>
          )}

          <Button className="w-full" onClick={() => setLocation("/login")}>Voltar para o login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
