import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { LoginTransition } from "@/components/login-transition";
import NebulaBackground from "@/components/nebula-background";

const loginSchema = z.object({
  identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [showTransition, setShowTransition] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (user || login.isSuccess) {
      setShowTransition(true);
      const timer = window.setTimeout(() => setLocation("/"), 1500); // Wait for transition to finish
      return () => window.clearTimeout(timer);
    }
  }, [user, login.isSuccess, setLocation]);

  function onSubmit(data: LoginForm) {
    login.mutate(data);
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-transparent p-4 relative overflow-hidden">
      <NebulaBackground />
      <AnimatePresence>
        {showTransition && <LoginTransition />}
      </AnimatePresence>
      <motion.div
        className="w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <motion.div variants={itemVariants}>
          <Card className="shadow-2xl border-border/50 backdrop-blur-sm bg-background/80">
            <CardHeader className="space-y-4 flex flex-col items-center pt-8 pb-4">
              <motion.div
                variants={itemVariants}
                whileHover={{ scale: 1.05, rotate: -3 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Logo className="w-16 h-16 text-primary" />
              </motion.div>
              <motion.div variants={itemVariants} className="text-center space-y-1.5">
                <h1 className="font-display text-2xl font-bold tracking-tight">Acesso ao Sistema Academico</h1>
                <p className="text-sm text-muted-foreground">Entre com R.A, CPF ou e-mail.</p>
              </motion.div>
            </CardHeader>

            <CardContent>
              <motion.form
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                aria-label="Formulario de login"
              >
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="identifier">Identificacao</Label>
                  <Input
                    id="identifier"
                    placeholder="Ex: voce@email.com, 24123456 ou 555.222.333-44 "
                    autoComplete="username"
                    aria-label="Campo de identificacao"
                    {...form.register("identifier")}
                    className="h-11 bg-background/70"
                  />
                  {form.formState.errors.identifier && (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.identifier.message}
                    </p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    aria-label="Campo de senha"
                    {...form.register("password")}
                    className="h-11 bg-background/70"
                  />
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive" role="alert">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants}>
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
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-sm text-primary hover:text-primary"
                    onClick={() => setLocation("/forgot-password")}
                  >
                    Esqueceu a senha?
                  </Button>
                </motion.div>
              </motion.form>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 border-t border-border/50 bg-muted/20 p-6 rounded-b-xl">
              <div className="text-xs text-center text-muted-foreground space-y-1">
                <p>Contas de teste:</p>
                <p>admin@academic.local | professor@academic.local | aluno@academic.local</p>
                <p>Senhas iniciais no seed (ambiente local).</p>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

