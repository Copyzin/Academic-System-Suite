import { ChangeEvent, ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEnrollments } from "@/hooks/use-enrollments";
import { useUpdateAvatar } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LayoutShellProps {
  children: ReactNode;
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatoria"),
    newPassword: z.string().min(8, "A nova senha deve ter no minimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "A confirmacao deve ser identica",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;
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

function strengthClass(value: PasswordStrength) {
  if (value === "FRACA") return "text-red-600";
  if (value === "MEDIA") return "text-sky-500";
  return "text-green-600";
}

function getRoleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "teacher") return "Professor";
  return "Aluno";
}

export function LayoutShell({ children }: LayoutShellProps) {
  const { user, logout, changePassword } = useAuth();
  const updateAvatar = useUpdateAvatar();
  const [location] = useLocation();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const { data: studentEnrollments } = useEnrollments(
    user?.role === "student" ? { studentId: user.id } : undefined,
  );

  const currentCourse = useMemo(() => {
    if (!user || user.role !== "student") return undefined;
    return studentEnrollments?.[0]?.courseName;
  }, [user, studentEnrollments]);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPasswordValue = passwordForm.watch("newPassword") || "";
  const passwordStrength = getPasswordStrength(newPasswordValue);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">{children}</div>;
  }

  const navItems = [
    { label: "Painel", href: "/", icon: LayoutDashboard, roles: ["admin", "teacher", "student"] },
    { label: "Cursos", href: "/courses", icon: BookOpen, roles: ["admin", "teacher", "student"] },
    { label: "Alunos", href: "/students", icon: Users, roles: ["admin", "teacher"] },
    { label: "Comunicados", href: "/announcements", icon: Bell, roles: ["admin", "teacher", "student"] },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        updateAvatar.mutate(result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row font-body text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white p-2 rounded shadow">
        Pular para o conteudo
      </a>

      <aside className="w-full md:w-72 bg-white border-r border-border flex flex-col sticky top-0 md:h-screen z-20">
        <div className="p-6 border-b border-border/50">
          <Link href="/">
            <button
              type="button"
              className="flex items-center gap-3 text-left w-full rounded-lg p-1 transition-colors hover:bg-primary/5 cursor-pointer"
              aria-label="Ir para a pagina inicial"
            >
              <div className="bg-primary/10 p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl tracking-tight leading-none text-primary">Academic Suite</h1>
                <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">Sistema academico</p>
              </div>
            </button>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Menu principal">
          {filteredNav.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer font-medium text-sm",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 space-y-2">
          <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Abrir perfil do usuario"
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={user.avatarUrl || undefined} alt={`Foto de ${user.name}`} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Perfil do usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border">
                    <AvatarImage src={user.avatarUrl || undefined} alt={`Foto de ${user.name}`} />
                    <AvatarFallback className="bg-primary/5 text-primary text-lg font-bold">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{getRoleLabel(user.role)}</p>
                    <p className="text-xs text-muted-foreground">R.A: {user.ra}</p>
                    {user.role === "student" && currentCourse && (
                      <p className="text-xs text-muted-foreground">Curso: {currentCourse}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar-upload">Atualizar foto de perfil</Label>
                  <Input id="avatar-upload" type="file" accept="image/*" onChange={onAvatarSelected} />
                  <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP.</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-primary transition-colors">
                <Lock className="w-4 h-4 mr-2" />
                Mudar senha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar senha</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={passwordForm.handleSubmit((data) => {
                  changePassword.mutate(data, {
                    onSuccess: () => {
                      setIsPasswordOpen(false);
                      passwordForm.reset();
                    },
                  });
                })}
                className="space-y-4 mt-2"
              >
                <div className="space-y-2">
                  <Label>Senha atual</Label>
                  <Input type="password" {...passwordForm.register("currentPassword")} />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" {...passwordForm.register("newPassword")} />
                  <p className={`text-xs font-semibold ${strengthClass(passwordStrength)}`}>Senha + {passwordStrength}</p>
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input type="password" {...passwordForm.register("confirmPassword")} />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={changePassword.isPending}>
                    {changePassword.isPending ? "Salvando..." : "Salvar nova senha"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20 transition-colors"
            onClick={() => logout.mutate()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">{children}</div>
      </main>
    </div>
  );
}
