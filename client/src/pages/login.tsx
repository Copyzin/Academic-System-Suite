import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [openingTransition, setOpeningTransition] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (!user && !login.isSuccess) return;
    setOpeningTransition(true);
    const timer = window.setTimeout(() => setLocation("/"), 320);
    return () => window.clearTimeout(timer);
  }, [user, login.isSuccess, setLocation]);

  function onSubmit(data: LoginForm) {
    login.mutate(data);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4">
      <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.7))] pointer-events-none" />

      <Card
        className={`w-full max-w-md shadow-2xl border-white/70 backdrop-blur-sm relative z-10 transition-all duration-300 ${
          openingTransition ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        <CardHeader className="space-y-4 flex flex-col items-center pt-8 pb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2 rotate-3 hover:rotate-0 transition-transform duration-300">
            <GraduationCap className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">Acesso ao Sistema Academico</h1>
            <p className="text-sm text-muted-foreground">Entre com R.A, CPF ou e-mail.</p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-label="Formulario de login">
            <div className="space-y-2">
              <Label htmlFor="identifier">R.A, CPF ou e-mail</Label>
              <Input
                id="identifier"
                placeholder="Ex: 24123456, 00000000000 ou voce@email.com"
                autoComplete="username"
                aria-label="Campo de identificacao"
                {...form.register("identifier")}
                className="h-11 bg-white/70"
              />
              {form.formState.errors.identifier && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                autoComplete="current-password"
                aria-label="Campo de senha"
                {...form.register("password")}
                className="h-11 bg-white/70"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={login.isPending}>
              {login.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-primary hover:text-primary"
              onClick={() => setLocation("/forgot-password")}
            >
              Esqueceu a senha?
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t border-border/50 bg-slate-50/70 p-6 rounded-b-xl">
          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>Contas de teste:</p>
            <p>admin@academic.local | professor@academic.local | aluno@academic.local</p>
            <p>Senhas iniciais no seed (ambiente local).</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
