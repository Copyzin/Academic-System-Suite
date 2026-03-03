import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { z } from "zod";
import { api } from "@shared/routes";
import { User } from "@shared/schema";
import { setupAuth, comparePasswords, hashPassword } from "./auth";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import {
  generateCancelToken,
  generateFiveDigitToken,
  hashValue,
  isPasswordStrongEnough,
  normalizeCpf,
} from "./password-reset";
import { sendPasswordResetEmail } from "./notify";

function sanitizeUser(user: User) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function getAuthUser(req: Request) {
  return req.user as User;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  return next();
}

function requireRoles(...roles: Array<User["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = getAuthUser(req);
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    return next();
  };
}

function parseOptionalPositiveInt(value: unknown) {
  if (!value) return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return undefined;
  return numberValue;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);
  await seedDatabase();

  app.post(api.auth.changePassword.path, requireAuth, async (req, res) => {
    try {
      const input = api.auth.changePassword.input.parse(req.body);
      const user = getAuthUser(req);

      const fullUser = await storage.getUser(user.id);
      if (!fullUser) return res.sendStatus(401);

      const currentMatches = await comparePasswords(input.currentPassword, fullUser.password);
      if (!currentMatches) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      if (!isPasswordStrongEnough(input.newPassword)) {
        return res.status(400).json({ message: "Senha fraca. Use pelo menos 8 caracteres e variedade." });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await storage.updateUser(fullUser.id, { password: passwordHash });

      return res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post(api.auth.forgotPassword.path, async (req, res) => {
    try {
      const input = api.auth.forgotPassword.input.parse(req.body);
      const deviceHash = hashValue(input.deviceId);

      const blocked = await storage.isDeviceBlocked(deviceHash);
      if (blocked) {
        return res.json({ message: "Se o usuario existir, enviaremos instrucoes por e-mail." });
      }

      const user = await storage.getUserByLoginIdentifier(input.identifier);
      if (!user) {
        return res.json({ message: "Se o usuario existir, enviaremos instrucoes por e-mail." });
      }

      const token = generateFiveDigitToken();
      const cancelToken = generateCancelToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const request = await storage.createPasswordResetRequest({
        userId: user.id,
        tokenHash: hashValue(token),
        cancelTokenHash: hashValue(cancelToken),
        requestIp: req.ip,
        deviceHash,
        expiresAt,
      });

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const cancelUrl = `${appUrl}/reset-password/cancel?requestId=${request.id}&cancelToken=${cancelToken}&deviceId=${encodeURIComponent(
        input.deviceId,
      )}`;

      await sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        token,
        expiresInMinutes: 10,
        cancelUrl,
      });

      return res.json({ message: "Se o usuario existir, enviaremos instrucoes por e-mail." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post(api.auth.validateResetToken.path, async (req, res) => {
    try {
      const input = api.auth.validateResetToken.input.parse(req.body);
      const deviceHash = hashValue(input.deviceId);

      if (await storage.isDeviceBlocked(deviceHash)) {
        return res.json({ valid: false });
      }

      const user = await storage.getUserByLoginIdentifier(input.identifier);
      if (!user) return res.json({ valid: false });

      const request = await storage.getLatestActivePasswordResetRequest(user.id, deviceHash);
      if (!request) return res.json({ valid: false });

      const incomingHash = hashValue(input.token);
      if (incomingHash !== request.tokenHash) {
        await storage.incrementPasswordResetAttempts(request.id);

        if ((request.attempts ?? 0) + 1 >= 5) {
          await storage.cancelPasswordReset(request.id);
          await storage.blockDevice(deviceHash, new Date(Date.now() + 24 * 60 * 60 * 1000), "Muitas tentativas de token");
        }

        return res.json({ valid: false });
      }

      return res.json({ valid: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post(api.auth.resetPassword.path, async (req, res) => {
    try {
      const input = api.auth.resetPassword.input.parse(req.body);
      const deviceHash = hashValue(input.deviceId);

      if (await storage.isDeviceBlocked(deviceHash)) {
        return res.status(403).json({ message: "Dispositivo bloqueado para redefinicao" });
      }

      const user = await storage.getUserByLoginIdentifier(input.identifier);
      if (!user) {
        return res.status(400).json({ message: "Token invalido ou expirado" });
      }

      const request = await storage.getLatestActivePasswordResetRequest(user.id, deviceHash);
      if (!request) {
        return res.status(400).json({ message: "Token invalido ou expirado" });
      }

      const tokenMatches = hashValue(input.token) === request.tokenHash;
      if (!tokenMatches) {
        await storage.incrementPasswordResetAttempts(request.id);

        if ((request.attempts ?? 0) + 1 >= 5) {
          await storage.cancelPasswordReset(request.id);
          await storage.blockDevice(deviceHash, new Date(Date.now() + 24 * 60 * 60 * 1000), "Muitas tentativas de token");
        }

        return res.status(400).json({ message: "Token invalido" });
      }

      if (!isPasswordStrongEnough(input.newPassword)) {
        return res.status(400).json({ message: "Senha fraca. Reforce a senha." });
      }

      const hashedPassword = await hashPassword(input.newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      await storage.markPasswordResetUsed(request.id);

      return res.json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post(api.auth.cancelPasswordReset.path, async (req, res) => {
    try {
      const input = api.auth.cancelPasswordReset.input.parse(req.body);
      const request = await storage.getPasswordResetById(input.requestId);

      if (!request) {
        return res.json({ message: "Solicitacao cancelada com seguranca" });
      }

      if (request.canceledAt || request.usedAt) {
        return res.json({ message: "Solicitacao cancelada com seguranca" });
      }

      if (hashValue(input.cancelToken) !== request.cancelTokenHash) {
        return res.status(400).json({ message: "Token de cancelamento invalido" });
      }

      await storage.cancelPasswordReset(request.id);
      await storage.blockDevice(
        request.deviceHash,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Usuario cancelou redefinicao de senha",
      );

      return res.json({ message: "Solicitacao cancelada e dispositivo bloqueado" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get(api.users.list.path, requireAuth, async (req, res) => {
    const user = getAuthUser(req);

    if (user.role === "student") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const role = req.query.role as "admin" | "teacher" | "student" | undefined;
    if (user.role === "teacher" && role && role !== "student") {
      return res.status(403).json({ message: "Professor pode listar apenas alunos" });
    }

    const users = await storage.getUsers(role);
    return res.json(users.map((entry) => sanitizeUser(entry)));
  });

  app.post(api.users.updateAvatar.path, requireAuth, async (req, res) => {
    try {
      const input = api.users.updateAvatar.input.parse(req.body);
      const user = getAuthUser(req);

      if (input.avatarUrl.length > 2_000_000) {
        return res.status(400).json({ message: "Imagem excede tamanho maximo permitido" });
      }

      const updatedUser = await storage.updateUser(user.id, { avatarUrl: input.avatarUrl });
      return res.json(sanitizeUser(updatedUser));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post(api.students.enroll.path, requireRoles("admin"), async (req, res) => {
    try {
      const input = api.students.enroll.input.parse(req.body);

      const temporaryPassword = generateCancelToken().slice(0, 12);
      const passwordHash = await hashPassword(temporaryPassword);

      const student = await storage.createUser({
        username: normalizeCpf(input.cpf),
        password: passwordHash,
        role: "student",
        name: input.name,
        cpf: normalizeCpf(input.cpf),
        phone: input.phone,
        email: input.email,
        avatarUrl: null,
      });

      const enrollment = await storage.createEnrollment({
        studentId: student.id,
        courseId: input.courseId,
        grade: null,
        attendance: 0,
        status: "active",
      });

      return res.status(201).json({
        user: sanitizeUser(student),
        enrollment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }

      return res.status(500).json({ message: "Nao foi possivel matricular o aluno" });
    }
  });

  app.get(api.courses.list.path, requireAuth, async (_req, res) => {
    const courses = await storage.getCourses();
    return res.json(courses);
  });

  app.get(api.courses.get.path, requireAuth, async (req, res) => {
    const courseId = Number(req.params.id);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ message: "Curso invalido" });
    }

    const course = await storage.getCourse(courseId);
    if (!course) return res.status(404).json({ message: "Curso nao encontrado" });

    return res.json(course);
  });

  app.post(api.courses.create.path, requireRoles("admin"), async (req, res) => {
    try {
      const input = api.courses.create.input.parse(req.body);
      const course = await storage.createCourse({
        name: input.name,
        description: input.description,
        schedule: input.schedule,
        teacherId: input.teacherId,
      });

      return res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao criar curso" });
    }
  });

  app.patch(api.courses.update.path, requireRoles("admin"), async (req, res) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isFinite(courseId)) {
        return res.status(400).json({ message: "Curso invalido" });
      }

      const input = api.courses.update.input.parse(req.body);
      const course = await storage.updateCourse(courseId, input);
      return res.json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao atualizar curso" });
    }
  });

  app.get(api.subjects.list.path, requireAuth, async (_req, res) => {
    const subjects = await storage.getSubjects();
    return res.json(subjects);
  });

  app.post(api.subjects.create.path, requireRoles("admin"), async (req, res) => {
    try {
      const input = api.subjects.create.input.parse(req.body);
      const subject = await storage.createSubject(input);
      return res.status(201).json(subject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao criar materia" });
    }
  });

  app.get(api.courses.subjects.list.path, requireAuth, async (req, res) => {
    const courseId = Number(req.params.id);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ message: "Curso invalido" });
    }

    const subjects = await storage.getCourseSubjects(courseId);
    return res.json(subjects);
  });

  app.put(api.courses.subjects.update.path, requireRoles("admin"), async (req, res) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isFinite(courseId)) {
        return res.status(400).json({ message: "Curso invalido" });
      }

      const input = api.courses.subjects.update.input.parse(req.body);
      await storage.setCourseSubjects(courseId, input.subjectIds);
      return res.json({ message: "Grade curricular atualizada" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao atualizar grade" });
    }
  });

  app.get(api.enrollments.list.path, requireAuth, async (req, res) => {
    const user = getAuthUser(req);

    const requestedCourseId = parseOptionalPositiveInt(req.query.courseId);
    const requestedStudentId = parseOptionalPositiveInt(req.query.studentId);

    let studentId = requestedStudentId;
    if (user.role === "student") {
      studentId = user.id;
    }

    const enrollments = await storage.getEnrollments(requestedCourseId, studentId);
    return res.json(enrollments);
  });

  app.post(api.enrollments.create.path, requireRoles("admin"), async (req, res) => {
    try {
      const input = api.enrollments.create.input.parse(req.body);
      const enrollment = await storage.createEnrollment({
        studentId: input.studentId,
        courseId: input.courseId,
        grade: input.grade ?? null,
        attendance: input.attendance ?? 0,
        status: "active",
      });

      return res.status(201).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao criar matricula" });
    }
  });

  app.patch(api.enrollments.update.path, requireRoles("admin", "teacher"), async (req, res) => {
    try {
      const enrollmentId = Number(req.params.id);
      if (!Number.isFinite(enrollmentId)) {
        return res.status(400).json({ message: "Matricula invalida" });
      }

      const input = api.enrollments.update.input.parse(req.body);
      const enrollment = await storage.updateEnrollment(enrollmentId, input);
      return res.json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao atualizar matricula" });
    }
  });

  app.get(api.announcements.list.path, requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    const courseId = parseOptionalPositiveInt(req.query.courseId);

    const announcements = await storage.getAnnouncementsForUser(user, courseId);
    return res.json(announcements);
  });

  app.post(api.announcements.create.path, requireRoles("admin", "teacher"), async (req, res) => {
    try {
      const user = getAuthUser(req);
      const input = api.announcements.create.input.parse(req.body);

      if (!input.isGlobal && (!input.courseIds || input.courseIds.length === 0)) {
        return res.status(400).json({ message: "Selecione ao menos um curso para anuncio direcionado" });
      }

      const announcement = await storage.createAnnouncement({
        title: input.title,
        content: input.content,
        authorId: user.id,
        isGlobal: input.isGlobal,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        courseIds: input.isGlobal ? [] : input.courseIds,
      });

      return res.status(201).json(announcement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Dados invalidos" });
      }
      return res.status(500).json({ message: "Erro ao criar comunicado" });
    }
  });

  app.get(api.dashboard.get.path, requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    const allCourses = await storage.getCourses();
    const allEnrollments = await storage.getEnrollments();
    const announcements = await storage.getAnnouncementsForUser(user);

    if (user.role === "admin") {
      const activeStudents = (await storage.getUsers("student")).length;
      const estimatedRevenue = activeStudents * 850;
      const avgAttendance =
        allEnrollments.length > 0
          ? Math.round(
              allEnrollments.reduce((sum, item) => sum + (item.attendance ?? 0), 0) / allEnrollments.length,
            )
          : 0;

      return res.json({
        role: user.role,
        cards: [
          { label: "Feedback financeiro", value: `R$ ${estimatedRevenue.toLocaleString("pt-BR")}` },
          { label: "Presenca media", value: `${avgAttendance}%` },
          { label: "Cursos ativos", value: String(allCourses.length) },
          { label: "Comunicados ativos", value: String(announcements.length) },
        ],
      });
    }

    if (user.role === "teacher") {
      const teacherCourses = allCourses.filter((course) => course.teacherId === user.id);
      const teacherEnrollments = allEnrollments.filter((item) =>
        teacherCourses.some((course) => course.id === item.courseId),
      );

      const avgGrade =
        teacherEnrollments.filter((item) => typeof item.grade === "number").length > 0
          ? Math.round(
              teacherEnrollments.reduce((sum, item) => sum + (item.grade ?? 0), 0) /
                teacherEnrollments.filter((item) => typeof item.grade === "number").length,
            )
          : 0;

      return res.json({
        role: user.role,
        cards: [
          { label: "Aulas no horario", value: String(teacherCourses.length) },
          { label: "Alunos acompanhados", value: String(teacherEnrollments.length) },
          { label: "Media de notas", value: `${avgGrade}%` },
          { label: "Comunicados", value: String(announcements.length) },
        ],
      });
    }

    const studentEnrollments = allEnrollments.filter((item) => item.studentId === user.id);
    const topGrade = Math.max(...studentEnrollments.map((item) => item.grade ?? 0), 0);
    const avgAttendance =
      studentEnrollments.length > 0
        ? Math.round(
            studentEnrollments.reduce((sum, item) => sum + (item.attendance ?? 0), 0) / studentEnrollments.length,
          )
        : 0;

    return res.json({
      role: user.role,
      cards: [
        { label: "Horarios cadastrados", value: String(studentEnrollments.length) },
        { label: "Presenca individual", value: `${avgAttendance}%` },
        { label: "Destaque de nota", value: `${topGrade}%` },
        { label: "Comunicados", value: String(announcements.length) },
      ],
    });
  });

  return httpServer;
}
