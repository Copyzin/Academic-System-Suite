import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useLocation } from "wouter";
import { usePasswordRecovery } from "@/hooks/use-password-recovery";
import { getDeviceId } from "@/lib/device-id";

const schema = z.object({
  identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { forgotPassword } = usePasswordRecovery();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
  });

  function onSubmit(data: FormData) {
    forgotPassword.mutate(
      {
        identifier: data.identifier,
        deviceId: getDeviceId(),
      },
      {
        onSuccess: () => {
          setTimeout(() => setLocation("/reset-password"), 200);
        },
      },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Recuperacao de senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe seu R.A, CPF ou e-mail para receber o token numerico de 5 digitos.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Identificacao</Label>
              <Input id="identifier" placeholder="R.A, CPF ou e-mail" {...form.register("identifier")} />
              {form.formState.errors.identifier && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar token
                </>
              )}
            </Button>

            <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation("/login")}> 
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
