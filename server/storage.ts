import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  academicTerms,
  announcementCourses,
  announcementTargets,
  announcements,
  approvedSubjectRecords,
  blockedDevices,
  classSectionTeachers,
  classSections,
  courseMaterials,
  courseSubjects,
  courses,
  enrollmentStatusHistory,
  enrollments,
  notifications,
  passwordResetRequests,
  subjects,
  userPinnedMaterials,
  users,
  type AnnouncementResponse,
  type CourseMaterial,
  type CourseMaterialResponse,
  type Course,
  type CourseResponse,
  type Enrollment,
  type EnrollmentResponse,
  type InsertAnnouncement,
  type InsertCourseMaterial,
  type InsertCourse,
  type InsertEnrollment,
  type InsertNotification,
  type InsertPasswordResetRequest,
  type InsertSubject,
  type InsertUser,
  type Notification,
  type PasswordResetRequest,
  type StudentListResponse,
  type StudentScopeResponse,
  type Subject,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { teachingAssignmentService } from "./teaching-assignment";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function makeCourseCode(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0])
    .join("")
    .padEnd(3, "C");
  return `CUR-${base}-${Math.floor(100 + Math.random() * 900)}`;
}

function makeSubjectCode(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0])
    .join("")
    .padEnd(3, "M");
  return `MAT-${base}-${Math.floor(100 + Math.random() * 900)}`;
}

function truncate(value: string, max = 140) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number => Number.isInteger(value))));
}

const activeAcademicStatuses: Array<Enrollment["status"]> = ["active", "locked"];

export interface CreateAnnouncementInput extends InsertAnnouncement {
  courseIds?: number[];
  classSectionIds?: number[];
}

export interface LockEnrollmentInput {
  enrollmentId: number;
  changedByUserId: number;
  reason: string;
  approvedSubjectIds?: number[];
}

export interface StudentsFilterInput {
  courseId?: number;
  classSectionId?: number;
  status?: Enrollment["status"];
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByLoginIdentifier(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(role?: "admin" | "teacher" | "student"): Promise<Array<User & { courseName?: string }>>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;

  getCourses(): Promise<CourseResponse[]>;
  getCoursesForUser(user: User): Promise<CourseResponse[]>;
  getCourse(id: number): Promise<CourseResponse | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, updates: Partial<InsertCourse>): Promise<Course>;
  getTeacherCourseIds(teacherId: number): Promise<number[]>;
  getTeacherClassSectionIds(teacherId: number): Promise<number[]>;
  getClassSectionsForUser(user: User, courseId?: number): Promise<StudentScopeResponse["classSections"]>;

  getSubjects(): Promise<Subject[]>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  getCourseSubjects(courseId: number): Promise<Subject[]>;
  setCourseSubjects(courseId: number, subjectIds: number[]): Promise<void>;

  getEnrollments(courseId?: number, studentId?: number, classSectionId?: number): Promise<EnrollmentResponse[]>;
  getEnrollmentById(id: number): Promise<Enrollment | undefined>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(
    id: number,
    updates: Partial<InsertEnrollment>,
    changedByUserId?: number,
    reason?: string,
  ): Promise<Enrollment>;
  lockEnrollment(input: LockEnrollmentInput): Promise<{ enrollment: Enrollment; preservedApprovedSubjects: number }>;

  getStudentScope(user: User): Promise<StudentScopeResponse>;
  getStudentsByScope(user: User, filters?: StudentsFilterInput): Promise<StudentListResponse[]>;

  getAnnouncementsForUser(user: User, courseId?: number, classSectionId?: number): Promise<AnnouncementResponse[]>;
  getAnnouncementById(id: number): Promise<AnnouncementResponse | undefined>;
  createAnnouncement(announcement: CreateAnnouncementInput): Promise<AnnouncementResponse>;
  deleteAnnouncement(id: number): Promise<void>;

  getMaterialsForUser(user: User): Promise<CourseMaterialResponse[]>;
  getMaterialById(id: number): Promise<CourseMaterial | undefined>;
  canUserAccessMaterial(user: User, material: CourseMaterial): Promise<boolean>;
  createMaterial(material: InsertCourseMaterial): Promise<CourseMaterial>;
  pinMaterial(userId: number, materialId: number): Promise<void>;
  unpinMaterial(userId: number, materialId: number): Promise<void>;

  getNotificationsForUser(userId: number, unreadOnly?: boolean): Promise<Array<Notification & { senderName?: string }>>;
  markNotificationRead(notificationId: number, userId: number): Promise<void>;

  createPasswordResetRequest(payload: InsertPasswordResetRequest): Promise<PasswordResetRequest>;
  getLatestActivePasswordResetRequest(userId: number, deviceHash: string): Promise<PasswordResetRequest | undefined>;
  getPasswordResetById(id: number): Promise<PasswordResetRequest | undefined>;
  incrementPasswordResetAttempts(id: number): Promise<void>;
  markPasswordResetUsed(id: number): Promise<void>;
  cancelPasswordReset(id: number): Promise<void>;

  blockDevice(deviceHash: string, blockedUntil: Date, reason: string): Promise<void>;
  isDeviceBlocked(deviceHash: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private async appendEnrollmentStatusHistory(
    enrollmentId: number,
    previousStatus: Enrollment["status"] | null,
    nextStatus: Enrollment["status"],
    changedByUserId?: number,
    reason?: string,
  ) {
    await db.insert(enrollmentStatusHistory).values({
      enrollmentId,
      previousStatus,
      nextStatus,
      changedByUserId,
      reason,
    });
  }

  private async getOrCreateActiveAcademicTerm() {
    const [activeTerm] = await db
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.isActive, true))
      .orderBy(desc(academicTerms.startsAt));

    if (activeTerm) return activeTerm;

    const now = new Date();
    const year = now.getFullYear();
    const isFirstSemester = now.getMonth() < 6;
    const code = `${year}.${isFirstSemester ? "1" : "2"}`;

    const [existingWithCode] = await db.select().from(academicTerms).where(eq(academicTerms.code, code));
    if (existingWithCode) return existingWithCode;

    const [created] = await db
      .insert(academicTerms)
      .values({
        code,
        name: `Periodo letivo ${code}`,
        startsAt: isFirstSemester ? new Date(year, 0, 1) : new Date(year, 6, 1),
        endsAt: isFirstSemester ? new Date(year, 5, 30, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59),
        isActive: true,
      })
      .returning();

    return created;
  }

  private buildDefaultSectionCode(courseCode: string, termCode: string) {
    const normalizedTerm = termCode.replace(/[^0-9]/g, "");
    return `${courseCode}-${normalizedTerm}-T1`;
  }

  private async ensureCourseTeacherOnSections(courseId: number, teacherId?: number | null) {
    if (!teacherId) return;

    const sectionRows = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(eq(classSections.courseId, courseId));

    if (sectionRows.length === 0) return;

    await db
      .insert(classSectionTeachers)
      .values(sectionRows.map((row) => ({ classSectionId: row.id, teacherId })))
      .onConflictDoNothing();
  }

  private async ensureDefaultClassSection(course: Course) {
    const activeTerm = await this.getOrCreateActiveAcademicTerm();
    const [existing] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.courseId, course.id), eq(classSections.academicTermId, activeTerm.id)));

    if (existing) {
      await this.ensureCourseTeacherOnSections(course.id, course.teacherId);
      return;
    }

    const [section] = await db
      .insert(classSections)
      .values({
        courseId: course.id,
        academicTermId: activeTerm.id,
        code: this.buildDefaultSectionCode(course.code, activeTerm.code),
        name: "Turma 1",
        room: null,
        scheduleSummary: course.schedule,
      })
      .returning();

    if (course.teacherId) {
      await db
        .insert(classSectionTeachers)
        .values({ classSectionId: section.id, teacherId: course.teacherId })
        .onConflictDoNothing();
    }
  }

  async getTeacherCourseIds(teacherId: number): Promise<number[]> {
    const directCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.teacherId, teacherId));

    const coursesBySection = await db
      .select({ courseId: classSections.courseId })
      .from(classSectionTeachers)
      .innerJoin(classSections, eq(classSections.id, classSectionTeachers.classSectionId))
      .where(eq(classSectionTeachers.teacherId, teacherId));

    return uniqueNumbers([
      ...directCourses.map((row) => row.id),
      ...coursesBySection.map((row) => row.courseId),
    ]);
  }

  async getTeacherClassSectionIds(teacherId: number): Promise<number[]> {
    const directCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.teacherId, teacherId));

    const directCourseIds = directCourses.map((row) => row.id);

    const sectionsByDirectCourses =
      directCourseIds.length > 0
        ? await db
            .select({ id: classSections.id })
            .from(classSections)
            .where(inArray(classSections.courseId, directCourseIds))
        : [];

    const assignedSections = await db
      .select({ id: classSectionTeachers.classSectionId })
      .from(classSectionTeachers)
      .where(eq(classSectionTeachers.teacherId, teacherId));

    return uniqueNumbers([
      ...sectionsByDirectCourses.map((row) => row.id),
      ...assignedSections.map((row) => row.id),
    ]);
  }

  private async getStudentCourseIds(studentId: number): Promise<number[]> {
    const rows = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          inArray(enrollments.status, ["active", "locked", "completed"]),
        ),
      );

    return uniqueNumbers(rows.map((row) => row.courseId));
  }

  private async getStudentClassSectionIds(studentId: number): Promise<number[]> {
    const rows = await db
      .select({ classSectionId: enrollments.classSectionId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          inArray(enrollments.status, ["active", "locked", "completed"]),
          sql`${enrollments.classSectionId} IS NOT NULL`,
        ),
      );

    return uniqueNumbers(rows.map((row) => row.classSectionId));
  }

  private async getAllowedCourseIdsForUser(user: User): Promise<number[]> {
    if (user.role === "admin") {
      const rows = await db.select({ id: courses.id }).from(courses);
      return rows.map((row) => row.id);
    }

    if (user.role === "teacher") {
      return this.getTeacherCourseIds(user.id);
    }

    return this.getStudentCourseIds(user.id);
  }

  private async getAllowedClassSectionIdsForUser(user: User): Promise<number[]> {
    if (user.role === "admin") {
      const rows = await db.select({ id: classSections.id }).from(classSections);
      return rows.map((row) => row.id);
    }

    if (user.role === "teacher") {
      return this.getTeacherClassSectionIds(user.id);
    }

    return this.getStudentClassSectionIds(user.id);
  }

  private canAccessClassSectionForRole(
    user: User,
    classSectionId: number | null,
    allowedSectionIds: Set<number>,
  ): boolean {
    if (!classSectionId) return true;
    if (user.role === "admin") return true;
    if (user.role === "teacher" && allowedSectionIds.size === 0) return true;
    return allowedSectionIds.has(classSectionId);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByLoginIdentifier(identifier: string): Promise<User | undefined> {
    const raw = identifier.trim();
    const cpf = onlyDigits(raw);
    const email = normalizeEmail(raw);

    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.ra, raw),
          eq(users.cpf, cpf),
          eq(users.email, email),
          eq(users.username, raw),
        ),
      );

    return user;
  }

  private async generateUniqueRa(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${year}${Math.floor(100000 + Math.random() * 900000)}`;
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.ra, candidate));
      if (!existing) return candidate;
    }

    return `${year}${Date.now().toString().slice(-6)}`;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const payload = {
      ...insertUser,
      ra: await this.generateUniqueRa(),
      cpf: onlyDigits(insertUser.cpf),
      email: normalizeEmail(insertUser.email),
      username:
        insertUser.username ||
        normalizeEmail(insertUser.email)
          .split("@")[0]
          .slice(0, 20),
      updatedAt: new Date(),
    };

    const [user] = await db.insert(users).values(payload).returning();
    return user;
  }

  async getUsers(role?: "admin" | "teacher" | "student"): Promise<Array<User & { courseName?: string }>> {
    const userRows = role
      ? await db.select().from(users).where(eq(users.role, role))
      : await db.select().from(users);

    const studentIds = userRows.filter((user) => user.role === "student").map((user) => user.id);

    const courseByStudentId = new Map<number, string>();

    if (studentIds.length > 0) {
      const studentCourses = await db
        .select({
          studentId: enrollments.studentId,
          courseName: courses.name,
        })
        .from(enrollments)
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .where(and(inArray(enrollments.studentId, studentIds), eq(enrollments.status, "active")));

      for (const row of studentCourses) {
        if (!courseByStudentId.has(row.studentId)) {
          courseByStudentId.set(row.studentId, row.courseName);
        }
      }
    }

    return userRows.map((user) => ({
      ...user,
      courseName: courseByStudentId.get(user.id),
    }));
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  async getCourses(): Promise<CourseResponse[]> {
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        description: courses.description,
        teacherId: courses.teacherId,
        schedule: courses.schedule,
        createdAt: courses.createdAt,
        teacherName: users.name,
      })
      .from(courses)
      .leftJoin(users, eq(users.id, courses.teacherId));

    return rows.map((row) => ({
      ...row,
      teacherName: row.teacherName ?? undefined,
    }));
  }

  async getCoursesForUser(user: User): Promise<CourseResponse[]> {
    const allCourses = await this.getCourses();

    if (user.role === "admin") {
      return allCourses;
    }

    const allowedCourseIds = new Set(await this.getAllowedCourseIdsForUser(user));
    return allCourses.filter((course) => allowedCourseIds.has(course.id));
  }

  async getCourse(id: number): Promise<CourseResponse | undefined> {
    const [course] = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        description: courses.description,
        teacherId: courses.teacherId,
        schedule: courses.schedule,
        createdAt: courses.createdAt,
        teacherName: users.name,
      })
      .from(courses)
      .leftJoin(users, eq(users.id, courses.teacherId))
      .where(eq(courses.id, id));

    if (!course) return undefined;

    const subjectsByCourse = await this.getCourseSubjects(id);
    return {
      ...course,
      teacherName: course.teacherName ?? undefined,
      subjects: subjectsByCourse,
    };
  }

  private async generateUniqueCourseCode(name: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = makeCourseCode(name);
      const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.code, candidate));
      if (!existing) return candidate;
    }

    return `CUR-${Date.now().toString().slice(-6)}`;
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const [course] = await db
      .insert(courses)
      .values({
        ...insertCourse,
        code: await this.generateUniqueCourseCode(insertCourse.name),
      })
      .returning();

    await this.ensureDefaultClassSection(course);
    return course;
  }

  async updateCourse(id: number, updates: Partial<InsertCourse>): Promise<Course> {
    const [course] = await db.update(courses).set(updates).where(eq(courses.id, id)).returning();
    if (course) {
      await this.ensureCourseTeacherOnSections(course.id, updates.teacherId ?? course.teacherId);
    }
    return course;
  }

  async getClassSectionsForUser(user: User, courseId?: number): Promise<StudentScopeResponse["classSections"]> {
    const rows = await db
      .select({
        id: classSections.id,
        code: classSections.code,
        name: classSections.name,
        courseId: classSections.courseId,
        academicTermId: classSections.academicTermId,
        academicTermCode: academicTerms.code,
      })
      .from(classSections)
      .innerJoin(academicTerms, eq(academicTerms.id, classSections.academicTermId))
      .where(courseId ? eq(classSections.courseId, courseId) : undefined)
      .orderBy(desc(academicTerms.startsAt), classSections.name);

    if (user.role === "admin") return rows;

    const allowedCourseIds = new Set(await this.getAllowedCourseIdsForUser(user));
    const allowedSectionIds = new Set(await this.getAllowedClassSectionIdsForUser(user));

    return rows.filter(
      (row) => allowedCourseIds.has(row.courseId) && (allowedSectionIds.size === 0 || allowedSectionIds.has(row.id)),
    );
  }

  async getSubjects(): Promise<Subject[]> {
    return db.select().from(subjects).orderBy(subjects.name);
  }

  private async generateUniqueSubjectCode(name: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = makeSubjectCode(name);
      const [existing] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, candidate));
      if (!existing) return candidate;
    }

    return `MAT-${Date.now().toString().slice(-6)}`;
  }

  async createSubject(insertSubject: InsertSubject): Promise<Subject> {
    const [subject] = await db
      .insert(subjects)
      .values({
        ...insertSubject,
        code: await this.generateUniqueSubjectCode(insertSubject.name),
      })
      .returning();

    return subject;
  }

  async getCourseSubjects(courseId: number): Promise<Subject[]> {
    const rows = await db
      .select({
        id: subjects.id,
        code: subjects.code,
        name: subjects.name,
        description: subjects.description,
        area: subjects.area,
        subarea: subjects.subarea,
        requiredLocationKind: subjects.requiredLocationKind,
        requiredEquipment: subjects.requiredEquipment,
        workloadHours: subjects.workloadHours,
        createdAt: subjects.createdAt,
      })
      .from(courseSubjects)
      .innerJoin(subjects, eq(subjects.id, courseSubjects.subjectId))
      .where(eq(courseSubjects.courseId, courseId))
      .orderBy(subjects.name);

    return rows;
  }

  async setCourseSubjects(courseId: number, subjectIds: number[]): Promise<void> {
    const deduped = Array.from(new Set(subjectIds));

    await db.delete(courseSubjects).where(eq(courseSubjects.courseId, courseId));

    if (deduped.length === 0) return;

    await db.insert(courseSubjects).values(
      deduped.map((subjectId) => ({
        courseId,
        subjectId,
        isRequired: true,
      })),
    );
  }

  async getEnrollments(courseId?: number, studentId?: number, classSectionId?: number): Promise<EnrollmentResponse[]> {
    const clauses = [];

    if (courseId) clauses.push(eq(enrollments.courseId, courseId));
    if (studentId) clauses.push(eq(enrollments.studentId, studentId));
    if (classSectionId) clauses.push(eq(enrollments.classSectionId, classSectionId));

    const rows = await db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        courseId: enrollments.courseId,
        status: enrollments.status,
        classSectionId: enrollments.classSectionId,
        academicTermId: enrollments.academicTermId,
        enrolledAt: enrollments.enrolledAt,
        createdAt: enrollments.createdAt,
        grade: enrollments.grade,
        attendance: enrollments.attendance,
        studentName: users.name,
        studentEmail: users.email,
        studentRa: users.ra,
        courseName: courses.name,
        classSectionCode: classSections.code,
        classSectionName: classSections.name,
        academicTermCode: academicTerms.code,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .leftJoin(classSections, eq(classSections.id, enrollments.classSectionId))
      .leftJoin(academicTerms, eq(academicTerms.id, enrollments.academicTermId))
      .where(clauses.length > 0 ? and(...clauses) : undefined)
      .orderBy(desc(enrollments.createdAt));

    return rows.map((row) => ({
      ...row,
      classSectionCode: row.classSectionCode ?? undefined,
      classSectionName: row.classSectionName ?? undefined,
      academicTermCode: row.academicTermCode ?? undefined,
    }));
  }

  async getEnrollmentById(id: number): Promise<Enrollment | undefined> {
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    return enrollment;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const activeTerm = await this.getOrCreateActiveAcademicTerm();

    let classSectionId = insertEnrollment.classSectionId ?? null;
    let academicTermId = insertEnrollment.academicTermId ?? null;

    if (classSectionId) {
      const [section] = await db
        .select({ academicTermId: classSections.academicTermId, courseId: classSections.courseId })
        .from(classSections)
        .where(eq(classSections.id, classSectionId));
      if (!section) {
        throw new Error("Turma nao encontrada");
      }
      if (section.courseId !== insertEnrollment.courseId) {
        throw new Error("Turma nao pertence ao curso informado");
      }
      academicTermId = section.academicTermId;
    }

    if (!classSectionId) {
      const [section] = await db
        .select({ id: classSections.id, academicTermId: classSections.academicTermId })
        .from(classSections)
        .where(eq(classSections.courseId, insertEnrollment.courseId))
        .orderBy(desc(classSections.createdAt));

      if (section) {
        classSectionId = section.id;
        academicTermId = section.academicTermId;
      }
    }

    if (!academicTermId) {
      academicTermId = activeTerm.id;
    }

    const [enrollment] = await db
      .insert(enrollments)
      .values({
        ...insertEnrollment,
        status: insertEnrollment.status ?? "active",
        classSectionId,
        academicTermId,
      })
      .returning();
    await this.appendEnrollmentStatusHistory(enrollment.id, null, enrollment.status, undefined, "Matricula criada");
    return enrollment;
  }

  async updateEnrollment(
    id: number,
    updates: Partial<InsertEnrollment>,
    changedByUserId?: number,
    reason?: string,
  ): Promise<Enrollment> {
    const [current] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    if (!current) {
      throw new Error("Matricula nao encontrada");
    }

    const [enrollment] = await db.update(enrollments).set(updates).where(eq(enrollments.id, id)).returning();

    if (updates.status && updates.status !== current.status) {
      await this.appendEnrollmentStatusHistory(
        id,
        current.status,
        updates.status,
        changedByUserId,
        reason ?? "Atualizacao de status de matricula",
      );
    }

    return enrollment;
  }

  async lockEnrollment(input: LockEnrollmentInput): Promise<{ enrollment: Enrollment; preservedApprovedSubjects: number }> {
    const enrollment = await this.getEnrollmentById(input.enrollmentId);
    if (!enrollment) {
      throw new Error("Matricula nao encontrada");
    }

    const previousStatus = enrollment.status;

    let updatedEnrollment = enrollment;
    if (enrollment.status !== "locked") {
      updatedEnrollment = await this.updateEnrollment(
        enrollment.id,
        { status: "locked" },
        input.changedByUserId,
        input.reason,
      );
    }

    const existingApproved = await db
      .select({ subjectId: approvedSubjectRecords.subjectId })
      .from(approvedSubjectRecords)
      .where(eq(approvedSubjectRecords.enrollmentId, enrollment.id));

    const existingSubjectIds = new Set(existingApproved.map((row) => row.subjectId));

    const requestedSubjectIds = uniqueNumbers(input.approvedSubjectIds ?? []);
    let subjectsToPersist = requestedSubjectIds;

    if (subjectsToPersist.length > 0) {
      const validSubjects = await db
        .select({ subjectId: courseSubjects.subjectId })
        .from(courseSubjects)
        .where(
          and(
            eq(courseSubjects.courseId, enrollment.courseId),
            inArray(courseSubjects.subjectId, subjectsToPersist),
          ),
        );

      subjectsToPersist = validSubjects.map((row) => row.subjectId);
    }

    const toInsert = subjectsToPersist.filter((subjectId) => !existingSubjectIds.has(subjectId));

    if (toInsert.length > 0) {
      const snapshotBatchId = `lock-${enrollment.id}-${Date.now()}`;
      await db.insert(approvedSubjectRecords).values(
        toInsert.map((subjectId) => ({
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          subjectId,
          approvedGrade: enrollment.grade,
          approvedAt: new Date(),
          snapshotBatchId,
          source: "lock_snapshot" as const,
        })),
      );
    }

    if (previousStatus === "locked") {
      return {
        enrollment: updatedEnrollment,
        preservedApprovedSubjects: existingSubjectIds.size,
      };
    }

    return {
      enrollment: updatedEnrollment,
      preservedApprovedSubjects: existingSubjectIds.size + toInsert.length,
    };
  }

  async getStudentScope(user: User): Promise<StudentScopeResponse> {
    const availableCourses = await this.getCoursesForUser(user);
    const sections = await this.getClassSectionsForUser(user);

    return {
      courses: availableCourses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
      })),
      classSections: sections,
    };
  }

  async getStudentsByScope(user: User, filters?: StudentsFilterInput): Promise<StudentListResponse[]> {
    if (user.role === "student") return [];

    const allowedCourseIds = await this.getAllowedCourseIdsForUser(user);
    if (allowedCourseIds.length === 0) return [];

    const allowedSectionIds = await this.getAllowedClassSectionIdsForUser(user);

    if (filters?.courseId && !allowedCourseIds.includes(filters.courseId)) {
      return [];
    }

    if (
      filters?.classSectionId &&
      user.role !== "admin" &&
      !allowedSectionIds.includes(filters.classSectionId)
    ) {
      return [];
    }

    const clauses = [eq(users.role, "student"), inArray(enrollments.courseId, allowedCourseIds)];

    if (filters?.courseId) {
      clauses.push(eq(enrollments.courseId, filters.courseId));
    }

    if (filters?.classSectionId) {
      clauses.push(eq(enrollments.classSectionId, filters.classSectionId));
    }

    if (filters?.status) {
      clauses.push(eq(enrollments.status, filters.status));
    }

    if (user.role === "teacher" && !filters?.classSectionId && allowedSectionIds.length > 0) {
      clauses.push(
        or(
          inArray(enrollments.classSectionId, allowedSectionIds),
          sql`${enrollments.classSectionId} IS NULL`,
        )!,
      );
    }

    const rows = await db
      .select({
        id: users.id,
        ra: users.ra,
        username: users.username,
        role: users.role,
        name: users.name,
        cpf: users.cpf,
        phone: users.phone,
        email: users.email,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        courseId: courses.id,
        courseCode: courses.code,
        courseName: courses.name,
        classSectionId: enrollments.classSectionId,
        classSectionCode: classSections.code,
        classSectionName: classSections.name,
        academicTermId: enrollments.academicTermId,
        academicTermCode: academicTerms.code,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .leftJoin(classSections, eq(classSections.id, enrollments.classSectionId))
      .leftJoin(academicTerms, eq(academicTerms.id, enrollments.academicTermId))
      .where(and(...clauses))
      .orderBy(users.name);

    return rows.map((row) => ({
      ...row,
      classSectionCode: row.classSectionCode ?? undefined,
      classSectionName: row.classSectionName ?? undefined,
      academicTermCode: row.academicTermCode ?? undefined,
    }));
  }

  async getAnnouncementById(id: number): Promise<AnnouncementResponse | undefined> {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        authorId: announcements.authorId,
        isGlobal: announcements.isGlobal,
        expiresAt: announcements.expiresAt,
        createdAt: announcements.createdAt,
        authorName: users.name,
        targetType: announcementTargets.targetType,
        targetId: announcementTargets.targetId,
        legacyCourseId: announcementCourses.courseId,
      })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.authorId))
      .leftJoin(announcementTargets, eq(announcementTargets.announcementId, announcements.id))
      .leftJoin(announcementCourses, eq(announcementCourses.announcementId, announcements.id))
      .where(eq(announcements.id, id));

    if (rows.length === 0) return undefined;

    const announcement: AnnouncementResponse = {
      id: rows[0].id,
      title: rows[0].title,
      content: rows[0].content,
      authorId: rows[0].authorId,
      isGlobal: rows[0].isGlobal,
      expiresAt: rows[0].expiresAt,
      createdAt: rows[0].createdAt,
      authorName: rows[0].authorName ?? undefined,
      courseIds: [],
      classSectionIds: [],
    };

    for (const row of rows) {
      if (row.legacyCourseId && !announcement.courseIds?.includes(row.legacyCourseId)) {
        announcement.courseIds?.push(row.legacyCourseId);
      }

      if (row.targetType === "course" && row.targetId && !announcement.courseIds?.includes(row.targetId)) {
        announcement.courseIds?.push(row.targetId);
      }

      if (
        row.targetType === "class_section" &&
        row.targetId &&
        !announcement.classSectionIds?.includes(row.targetId)
      ) {
        announcement.classSectionIds?.push(row.targetId);
      }
    }

    return announcement;
  }

  async getAnnouncementsForUser(user: User, courseId?: number, classSectionId?: number): Promise<AnnouncementResponse[]> {
    const now = new Date();

    const announcementRows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        authorId: announcements.authorId,
        isGlobal: announcements.isGlobal,
        expiresAt: announcements.expiresAt,
        createdAt: announcements.createdAt,
        authorName: users.name,
        targetType: announcementTargets.targetType,
        targetId: announcementTargets.targetId,
        legacyCourseId: announcementCourses.courseId,
      })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.authorId))
      .leftJoin(announcementTargets, eq(announcementTargets.announcementId, announcements.id))
      .leftJoin(announcementCourses, eq(announcementCourses.announcementId, announcements.id))
      .where(or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)))
      .orderBy(desc(announcements.createdAt));

    const allowedCourseIds = new Set(await this.getAllowedCourseIdsForUser(user));
    const allowedClassSectionIds = new Set(await this.getAllowedClassSectionIdsForUser(user));

    const grouped = new Map<number, AnnouncementResponse>();

    for (const row of announcementRows) {
      const current = grouped.get(row.id) ?? {
        id: row.id,
        title: row.title,
        content: row.content,
        authorId: row.authorId,
        isGlobal: row.isGlobal,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        authorName: row.authorName ?? undefined,
        courseIds: [],
        classSectionIds: [],
      };

      if (row.legacyCourseId) {
        current.courseIds = current.courseIds ?? [];
        if (!current.courseIds.includes(row.legacyCourseId)) {
          current.courseIds.push(row.legacyCourseId);
        }
      }

      if (row.targetType === "course" && row.targetId) {
        current.courseIds = current.courseIds ?? [];
        if (!current.courseIds.includes(row.targetId)) {
          current.courseIds.push(row.targetId);
        }
      }

      if (row.targetType === "class_section" && row.targetId) {
        current.classSectionIds = current.classSectionIds ?? [];
        if (!current.classSectionIds.includes(row.targetId)) {
          current.classSectionIds.push(row.targetId);
        }
      }

      grouped.set(row.id, current);
    }

    return Array.from(grouped.values()).filter((announcement) => {
      if (courseId && !announcement.isGlobal) {
        const hasCourseTarget = announcement.courseIds?.includes(courseId) ?? false;
        if (!hasCourseTarget) return false;
      }

      if (classSectionId && !announcement.isGlobal) {
        const hasSectionTarget = announcement.classSectionIds?.includes(classSectionId) ?? false;
        if (!hasSectionTarget) return false;
      }

      if (announcement.isGlobal) return true;

      const linkedCourses = announcement.courseIds ?? [];
      const linkedClassSections = announcement.classSectionIds ?? [];

      return (
        linkedCourses.some((id) => allowedCourseIds.has(id)) ||
        linkedClassSections.some((id) => allowedClassSectionIds.has(id))
      );
    });
  }

  private async createNotificationBatch(records: InsertNotification[]) {
    if (records.length === 0) return;
    await db.insert(notifications).values(records);
  }

  private async resolveAnnouncementRecipients(input: {
    authorId: number;
    isGlobal: boolean;
    courseIds: number[];
    classSectionIds: number[];
  }) {
    if (input.isGlobal) {
      const everyone = await db.select({ id: users.id }).from(users).where(sql`${users.id} <> ${input.authorId}`);
      return everyone.map((row) => row.id);
    }

    const recipients = new Set<number>();

    if (input.courseIds.length > 0) {
      const enrolledStudents = await db
        .select({ userId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            inArray(enrollments.courseId, input.courseIds),
            inArray(enrollments.status, activeAcademicStatuses),
          ),
        );

      for (const row of enrolledStudents) recipients.add(row.userId);

      const courseTeachers = await db
        .select({ teacherId: courses.teacherId })
        .from(courses)
        .where(and(inArray(courses.id, input.courseIds), sql`${courses.teacherId} IS NOT NULL`));

      for (const row of courseTeachers) {
        if (row.teacherId) recipients.add(row.teacherId);
      }
    }

    if (input.classSectionIds.length > 0) {
      const sectionStudents = await db
        .select({ userId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            inArray(enrollments.classSectionId, input.classSectionIds),
            inArray(enrollments.status, activeAcademicStatuses),
          ),
        );

      for (const row of sectionStudents) recipients.add(row.userId);

      const sectionTeachers = await db
        .select({ teacherId: classSectionTeachers.teacherId })
        .from(classSectionTeachers)
        .where(inArray(classSectionTeachers.classSectionId, input.classSectionIds));

      for (const row of sectionTeachers) recipients.add(row.teacherId);

      const courseTeachersBySection = await db
        .select({ teacherId: courses.teacherId })
        .from(classSections)
        .innerJoin(courses, eq(courses.id, classSections.courseId))
        .where(
          and(
            inArray(classSections.id, input.classSectionIds),
            sql`${courses.teacherId} IS NOT NULL`,
          ),
        );

      for (const row of courseTeachersBySection) {
        if (row.teacherId) recipients.add(row.teacherId);
      }
    }

    recipients.delete(input.authorId);
    return Array.from(recipients);
  }

  async createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementResponse> {
    const { courseIds = [], classSectionIds = [], ...announcementData } = input;

    const dedupedCourseIds = uniqueNumbers(courseIds);
    const dedupedClassSectionIds = uniqueNumbers(classSectionIds);

    const [announcement] = await db.insert(announcements).values(announcementData).returning();

    if (!announcement.isGlobal) {
      const targetValues = [
        ...dedupedCourseIds.map((courseId) => ({
          announcementId: announcement.id,
          targetType: "course" as const,
          targetId: courseId,
        })),
        ...dedupedClassSectionIds.map((classSectionId) => ({
          announcementId: announcement.id,
          targetType: "class_section" as const,
          targetId: classSectionId,
        })),
      ];

      if (targetValues.length > 0) {
        await db.insert(announcementTargets).values(targetValues);
      }

      if (dedupedCourseIds.length > 0) {
        await db.insert(announcementCourses).values(
          dedupedCourseIds.map((courseId) => ({
            announcementId: announcement.id,
            courseId,
          })),
        );
      }
    }

    const [author] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, announcement.authorId));

    const recipients = await this.resolveAnnouncementRecipients({
      authorId: announcement.authorId,
      isGlobal: announcement.isGlobal,
      courseIds: dedupedCourseIds,
      classSectionIds: dedupedClassSectionIds,
    });

    await this.createNotificationBatch(
      recipients.map((userId) => ({
        userId,
        type: "announcement",
        title: `Novo comunicado: ${announcement.title}`,
        message: truncate(announcement.content),
        senderId: announcement.authorId,
        destinationRoute: `/announcements?announcementId=${announcement.id}`,
        relatedEntityType: "announcement",
        relatedEntityId: announcement.id,
      })),
    );

    return {
      ...announcement,
      authorName: author?.name,
      courseIds: announcement.isGlobal ? [] : dedupedCourseIds,
      classSectionIds: announcement.isGlobal ? [] : dedupedClassSectionIds,
    };
  }

  async deleteAnnouncement(id: number): Promise<void> {
    const [existingAnnouncement] = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.id, id));

    if (!existingAnnouncement) {
      throw new Error("Comunicado nao encontrado");
    }

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.relatedEntityType, "announcement"),
          eq(notifications.relatedEntityId, id),
        ),
      );

    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getMaterialsForUser(user: User): Promise<CourseMaterialResponse[]> {
    const allowedCourseIds = await this.getAllowedCourseIdsForUser(user);
    if (allowedCourseIds.length === 0) return [];

    const allowedSectionIds = new Set(await this.getAllowedClassSectionIdsForUser(user));
    const allowedTeacherPairs =
      user.role === "teacher"
        ? new Set(
            (await teachingAssignmentService.getTeacherClassSectionSubjectPairs(user.id)).map(
              (item) => `${item.classSectionId}:${item.subjectId}`,
            ),
          )
        : null;

    const rows = await db
      .select({
        id: courseMaterials.id,
        originalName: courseMaterials.originalName,
        internalName: courseMaterials.internalName,
        storagePath: courseMaterials.storagePath,
        mimeType: courseMaterials.mimeType,
        sizeBytes: courseMaterials.sizeBytes,
        authorId: courseMaterials.authorId,
        courseId: courseMaterials.courseId,
        subjectId: courseMaterials.subjectId,
        classSectionId: courseMaterials.classSectionId,
        issuedAt: courseMaterials.issuedAt,
        createdAt: courseMaterials.createdAt,
        authorName: users.name,
        courseName: courses.name,
        subjectName: subjects.name,
        classSectionCode: classSections.code,
        classSectionName: classSections.name,
        isPinned: sql<boolean>`${userPinnedMaterials.id} IS NOT NULL`,
      })
      .from(courseMaterials)
      .innerJoin(users, eq(users.id, courseMaterials.authorId))
      .innerJoin(courses, eq(courses.id, courseMaterials.courseId))
      .leftJoin(subjects, eq(subjects.id, courseMaterials.subjectId))
      .leftJoin(classSections, eq(classSections.id, courseMaterials.classSectionId))
      .leftJoin(
        userPinnedMaterials,
        and(
          eq(userPinnedMaterials.materialId, courseMaterials.id),
          eq(userPinnedMaterials.userId, user.id),
        ),
      )
      .where(inArray(courseMaterials.courseId, allowedCourseIds))
      .orderBy(desc(courseMaterials.issuedAt), desc(courseMaterials.createdAt));

    return rows
      .filter((row) => {
        if (user.role === "teacher") {
          if (!row.classSectionId || !row.subjectId) return false;
          return allowedTeacherPairs?.has(`${row.classSectionId}:${row.subjectId}`) ?? false;
        }

        return this.canAccessClassSectionForRole(user, row.classSectionId ?? null, allowedSectionIds);
      })
      .map((row) => ({
        id: row.id,
        originalName: row.originalName,
        internalName: row.internalName,
        storagePath: row.storagePath,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        authorId: row.authorId,
        courseId: row.courseId,
        subjectId: row.subjectId,
        classSectionId: row.classSectionId,
        issuedAt: row.issuedAt,
        createdAt: row.createdAt,
        authorName: row.authorName ?? undefined,
        courseName: row.courseName ?? undefined,
        subjectName: row.subjectName ?? undefined,
        classSectionCode: row.classSectionCode ?? undefined,
        classSectionName: row.classSectionName ?? undefined,
        isPinned: Boolean(row.isPinned),
      }));
  }

  async getMaterialById(id: number): Promise<CourseMaterial | undefined> {
    const [material] = await db.select().from(courseMaterials).where(eq(courseMaterials.id, id));
    return material;
  }

  async canUserAccessMaterial(user: User, material: CourseMaterial): Promise<boolean> {
    if (user.role === "teacher" && material.classSectionId && material.subjectId) {
      return teachingAssignmentService.teacherHasOperationalAssignment(
        user.id,
        material.classSectionId,
        material.subjectId,
      );
    }

    const [allowedCourseIds, allowedSectionIds] = await Promise.all([
      this.getAllowedCourseIdsForUser(user),
      this.getAllowedClassSectionIdsForUser(user),
    ]);

    if (!allowedCourseIds.includes(material.courseId)) return false;

    return this.canAccessClassSectionForRole(
      user,
      material.classSectionId ?? null,
      new Set(allowedSectionIds),
    );
  }

  async createMaterial(material: InsertCourseMaterial): Promise<CourseMaterial> {
    const [createdMaterial] = await db.insert(courseMaterials).values(material).returning();
    return createdMaterial;
  }

  async pinMaterial(userId: number, materialId: number): Promise<void> {
    await db
      .insert(userPinnedMaterials)
      .values({ userId, materialId })
      .onConflictDoNothing();
  }

  async unpinMaterial(userId: number, materialId: number): Promise<void> {
    await db
      .delete(userPinnedMaterials)
      .where(
        and(
          eq(userPinnedMaterials.userId, userId),
          eq(userPinnedMaterials.materialId, materialId),
        ),
      );
  }

  async getNotificationsForUser(userId: number, unreadOnly = false): Promise<Array<Notification & { senderName?: string }>> {
    const rows = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        senderId: notifications.senderId,
        senderName: users.name,
        destinationRoute: notifications.destinationRoute,
        relatedEntityType: notifications.relatedEntityType,
        relatedEntityId: notifications.relatedEntityId,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.senderId))
      .where(
        and(
          eq(notifications.userId, userId),
          unreadOnly ? eq(notifications.isRead, false) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt));

    return rows.map((row) => ({
      ...row,
      senderName: row.senderName ?? undefined,
    }));
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async createPasswordResetRequest(payload: InsertPasswordResetRequest): Promise<PasswordResetRequest> {
    await db
      .update(passwordResetRequests)
      .set({ canceledAt: new Date() })
      .where(
        and(
          eq(passwordResetRequests.userId, payload.userId),
          isNull(passwordResetRequests.usedAt),
          isNull(passwordResetRequests.canceledAt),
          gt(passwordResetRequests.expiresAt, new Date()),
        ),
      );

    const [request] = await db.insert(passwordResetRequests).values(payload).returning();
    return request;
  }

  async getLatestActivePasswordResetRequest(
    userId: number,
    deviceHash: string,
  ): Promise<PasswordResetRequest | undefined> {
    const [request] = await db
      .select()
      .from(passwordResetRequests)
      .where(
        and(
          eq(passwordResetRequests.userId, userId),
          eq(passwordResetRequests.deviceHash, deviceHash),
          isNull(passwordResetRequests.usedAt),
          isNull(passwordResetRequests.canceledAt),
          gt(passwordResetRequests.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(passwordResetRequests.createdAt));

    return request;
  }

  async getPasswordResetById(id: number): Promise<PasswordResetRequest | undefined> {
    const [request] = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, id));
    return request;
  }

  async incrementPasswordResetAttempts(id: number): Promise<void> {
    await db
      .update(passwordResetRequests)
      .set({ attempts: sql`${passwordResetRequests.attempts} + 1` })
      .where(eq(passwordResetRequests.id, id));
  }

  async markPasswordResetUsed(id: number): Promise<void> {
    await db.update(passwordResetRequests).set({ usedAt: new Date() }).where(eq(passwordResetRequests.id, id));
  }

  async cancelPasswordReset(id: number): Promise<void> {
    await db
      .update(passwordResetRequests)
      .set({ canceledAt: new Date() })
      .where(eq(passwordResetRequests.id, id));
  }

  async blockDevice(deviceHash: string, blockedUntil: Date, reason: string): Promise<void> {
    await db
      .insert(blockedDevices)
      .values({ deviceHash, blockedUntil, reason })
      .onConflictDoUpdate({
        target: blockedDevices.deviceHash,
        set: {
          blockedUntil,
          reason,
        },
      });
  }

  async isDeviceBlocked(deviceHash: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(blockedDevices)
      .where(and(eq(blockedDevices.deviceHash, deviceHash), gt(blockedDevices.blockedUntil, new Date())));

    return Boolean(row);
  }
}

export const storage = new DatabaseStorage();
