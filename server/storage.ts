import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  announcementCourses,
  announcements,
  blockedDevices,
  courseSubjects,
  courses,
  enrollments,
  passwordResetRequests,
  subjects,
  users,
  type Announcement,
  type AnnouncementResponse,
  type Course,
  type CourseResponse,
  type Enrollment,
  type EnrollmentResponse,
  type InsertAnnouncement,
  type InsertCourse,
  type InsertEnrollment,
  type InsertPasswordResetRequest,
  type InsertSubject,
  type InsertUser,
  type PasswordResetRequest,
  type Subject,
  type User,
} from "@shared/schema";
import { db } from "./db";

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

export interface CreateAnnouncementInput extends InsertAnnouncement {
  courseIds?: number[];
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByLoginIdentifier(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(role?: "admin" | "teacher" | "student"): Promise<Array<User & { courseName?: string }>>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;

  getCourses(): Promise<CourseResponse[]>;
  getCourse(id: number): Promise<CourseResponse | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, updates: Partial<InsertCourse>): Promise<Course>;

  getSubjects(): Promise<Subject[]>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  getCourseSubjects(courseId: number): Promise<Subject[]>;
  setCourseSubjects(courseId: number, subjectIds: number[]): Promise<void>;

  getEnrollments(courseId?: number, studentId?: number): Promise<EnrollmentResponse[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(id: number, updates: Partial<InsertEnrollment>): Promise<Enrollment>;

  getAnnouncementsForUser(user: User, courseId?: number): Promise<AnnouncementResponse[]>;
  createAnnouncement(announcement: CreateAnnouncementInput): Promise<AnnouncementResponse>;

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

    return course;
  }

  async updateCourse(id: number, updates: Partial<InsertCourse>): Promise<Course> {
    const [course] = await db.update(courses).set(updates).where(eq(courses.id, id)).returning();
    return course;
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

  async getEnrollments(courseId?: number, studentId?: number): Promise<EnrollmentResponse[]> {
    const clauses = [];

    if (courseId) clauses.push(eq(enrollments.courseId, courseId));
    if (studentId) clauses.push(eq(enrollments.studentId, studentId));

    const rows = await db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        courseId: enrollments.courseId,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        createdAt: enrollments.createdAt,
        grade: enrollments.grade,
        attendance: enrollments.attendance,
        studentName: users.name,
        studentEmail: users.email,
        studentRa: users.ra,
        courseName: courses.name,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(clauses.length > 0 ? and(...clauses) : undefined)
      .orderBy(desc(enrollments.createdAt));

    return rows;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const [enrollment] = await db.insert(enrollments).values(insertEnrollment).returning();
    return enrollment;
  }

  async updateEnrollment(id: number, updates: Partial<InsertEnrollment>): Promise<Enrollment> {
    const [enrollment] = await db.update(enrollments).set(updates).where(eq(enrollments.id, id)).returning();
    return enrollment;
  }

  async getAnnouncementsForUser(user: User, courseId?: number): Promise<AnnouncementResponse[]> {
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
        courseId: announcementCourses.courseId,
      })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.authorId))
      .leftJoin(announcementCourses, eq(announcementCourses.announcementId, announcements.id))
      .where(or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)))
      .orderBy(desc(announcements.createdAt));

    const allowedCourseIds = new Set<number>();

    if (user.role === "admin") {
      const allCourses = await db.select({ id: courses.id }).from(courses);
      for (const row of allCourses) allowedCourseIds.add(row.id);
    } else if (user.role === "teacher") {
      const teacherCourses = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.teacherId, user.id));
      for (const row of teacherCourses) allowedCourseIds.add(row.id);
    } else {
      const studentCourses = await db
        .select({ courseId: enrollments.courseId })
        .from(enrollments)
        .where(and(eq(enrollments.studentId, user.id), eq(enrollments.status, "active")));
      for (const row of studentCourses) allowedCourseIds.add(row.courseId);
    }

    if (courseId) {
      allowedCourseIds.clear();
      allowedCourseIds.add(courseId);
    }

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
      };

      if (row.courseId) {
        current.courseIds = current.courseIds ?? [];
        if (!current.courseIds.includes(row.courseId)) {
          current.courseIds.push(row.courseId);
        }
      }

      grouped.set(row.id, current);
    }

    return Array.from(grouped.values()).filter((announcement) => {
      if (announcement.isGlobal) return true;

      const linked = announcement.courseIds ?? [];
      if (linked.length === 0) return false;

      return linked.some((id) => allowedCourseIds.has(id));
    });
  }

  async createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementResponse> {
    const { courseIds = [], ...announcementData } = input;

    const [announcement] = await db.insert(announcements).values(announcementData).returning();

    const dedupedCourseIds = Array.from(new Set(courseIds));

    if (!announcement.isGlobal && dedupedCourseIds.length > 0) {
      await db.insert(announcementCourses).values(
        dedupedCourseIds.map((courseId) => ({
          announcementId: announcement.id,
          courseId,
        })),
      );
    }

    const [author] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, announcement.authorId));

    return {
      ...announcement,
      authorName: author?.name,
      courseIds: announcement.isGlobal ? [] : dedupedCourseIds,
    };
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
