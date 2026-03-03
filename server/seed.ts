import { hashPassword } from "./auth";
import { storage } from "./storage";

export async function seedDatabase() {
  const existingUsers = await storage.getUsers();
  if (existingUsers.length > 0) return;

  console.log("Iniciando seed do banco...");

  const adminPassword = await hashPassword("Admin@12345");
  const teacherPassword = await hashPassword("Professor@123");
  const studentPassword = await hashPassword("Aluno@12345");

  const admin = await storage.createUser({
    username: "admin",
    password: adminPassword,
    role: "admin",
    name: "Administrador do Sistema",
    cpf: "12345678900",
    phone: "11999990001",
    email: "admin@academic.local",
    avatarUrl: null,
  });

  const teacher = await storage.createUser({
    username: "professor",
    password: teacherPassword,
    role: "teacher",
    name: "Marina Souza",
    cpf: "12345678901",
    phone: "11999990002",
    email: "professor@academic.local",
    avatarUrl: null,
  });

  const student = await storage.createUser({
    username: "aluno",
    password: studentPassword,
    role: "student",
    name: "Lucas Almeida",
    cpf: "12345678902",
    phone: "11999990003",
    email: "aluno@academic.local",
    avatarUrl: null,
  });

  const course = await storage.createCourse({
    name: "Engenharia de Software",
    description: "Fundamentos de arquitetura, qualidade e desenvolvimento web.",
    teacherId: teacher.id,
    schedule: "Seg/Qua 19:00-21:00",
  });

  const subject1 = await storage.createSubject({
    name: "Banco de Dados",
    description: "Modelagem relacional, SQL e normalizacao.",
    workloadHours: 60,
  });

  const subject2 = await storage.createSubject({
    name: "Arquitetura de Software",
    description: "Padroes, modularidade e escalabilidade.",
    workloadHours: 80,
  });

  await storage.setCourseSubjects(course.id, [subject1.id, subject2.id]);

  await storage.createEnrollment({
    studentId: student.id,
    courseId: course.id,
    grade: 87,
    attendance: 92,
    status: "active",
  });

  await storage.createAnnouncement({
    title: "Bem-vindos ao semestre",
    content: "Confiram o plano de ensino e cronograma na aba de cursos.",
    authorId: teacher.id,
    isGlobal: true,
    expiresAt: null,
    courseIds: [],
  });

  await storage.createAnnouncement({
    title: "Atividade da turma de Engenharia de Software",
    content: "Entrega do trabalho 1 ate sexta-feira, 23h59.",
    authorId: teacher.id,
    isGlobal: false,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    courseIds: [course.id],
  });

  console.log(`Seed concluido. Admin RA: ${admin.ra}, Professor RA: ${teacher.ra}, Aluno RA: ${student.ra}`);
}
