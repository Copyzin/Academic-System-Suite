import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { usePasswordRecovery } from "@/hooks/use-password-recovery";
import { getDeviceId } from "@/lib/device-id";

const schema = z
  .object({
    identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
    token: z.string().regex(/^\d{5}$/, "Token deve conter 5 digitos"),
    newPassword: z.string().min(8, "Senha deve conter no minimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "A confirmacao da senha deve ser identica",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

type PasswordStrength = "FRACA" | "MEDIA" | "SEGURA";

function getPasswordStrength(password: string): PasswordStrength {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const kinds = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length < 8 || kinds <= 1) return "FRACA";
  if (password.length > 8 && kinds >= 3) return "SEGURA";
  return "MEDIA";
}

function getStrengthClass(strength: PasswordStrength) {
  if (strength === "FRACA") return "text-red-600";
  if (strength === "MEDIA") return "text-sky-500";
  return "text-green-600";
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { validateToken, resetPassword } = usePasswordRecovery();
  const [tokenValidated, setTokenValidated] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const passwordValue = form.watch("newPassword");
  const strength = useMemo(() => getPasswordStrength(passwordValue || ""), [passwordValue]);

  async function validateAccess() {
    const identifier = form.getValues("identifier");
    const token = form.getValues("token");

    if (!identifier || !/^\d{5}$/.test(token)) {
      form.setError("token", { message: "Informe token valido de 5 digitos" });
      return;
    }

    validateToken.mutate(
      {
        identifier,
        token,
        deviceId: getDeviceId(),
      },
      {
        onSuccess: (payload) => {
          setTokenValidated(payload.valid);
          if (!payload.valid) {
            form.setError("token", { message: "Token invalido ou expirado" });
          }
        },
      },
    );
  }

  function onSubmit(data: FormData) {
    if (!tokenValidated) {
      form.setError("token", { message: "Valide o token antes de alterar a senha" });
      return;
    }

    resetPassword.mutate(
      {
        identifier: data.identifier,
        token: data.token,
        deviceId: getDeviceId(),
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      },
      {
        onSuccess: () => {
          setTimeout(() => setLocation("/login"), 600);
        },
      },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Mudanca de senha</CardTitle>
          <p className="text-sm text-muted-foreground">Acesso liberado apenas com token valido.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">R.A, CPF ou e-mail</Label>
              <Input id="identifier" {...form.register("identifier")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Token numerico (5 digitos)</Label>
              <Input id="token" maxLength={5} inputMode="numeric" {...form.register("token")} />
              {form.formState.errors.token && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.token.message}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={validateAccess}
              disabled={validateToken.isPending}
            >
              {validateToken.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando token...
                </>
              ) : (
                "Validar token"
              )}
            </Button>

            {tokenValidated && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <Input id="newPassword" type="password" {...form.register("newPassword")} />
                  <p className={`text-xs font-semibold ${getStrengthClass(strength)}`}>Senha + {strength}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando senha...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Salvar nova senha
                    </>
                  )}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
