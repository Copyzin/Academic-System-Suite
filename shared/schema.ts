import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    ra: text("ra").notNull().unique(),
    username: text("username").unique(),
    password: text("password").notNull(),
    role: text("role", { enum: ["admin", "teacher", "student"] })
      .notNull()
      .default("student"),
    name: text("name").notNull(),
    cpf: text("cpf").notNull().unique(),
    phone: text("phone"),
    email: text("email").notNull().unique(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usersRaIdx: uniqueIndex("users_ra_idx").on(table.ra),
  }),
);

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  teacherId: integer("teacher_id").references(() => users.id),
  schedule: text("schedule"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  workloadHours: integer("workload_hours").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const courseSubjects = pgTable(
  "course_subjects",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    semester: text("semester"),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.courseId, table.subjectId] }),
  }),
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed", "dropped"] })
      .notNull()
      .default("active"),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    grade: integer("grade"),
    attendance: integer("attendance"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    studentCourseUnique: uniqueIndex("enrollments_student_course_unique").on(
      table.studentId,
      table.courseId,
    ),
  }),
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isGlobal: boolean("is_global").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcementCourses = pgTable(
  "announcement_courses",
  {
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.announcementId, table.courseId] }),
  }),
);

export const passwordResetRequests = pgTable("password_reset_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  cancelTokenHash: text("cancel_token_hash").notNull(),
  requestIp: text("request_ip"),
  deviceHash: text("device_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  canceledAt: timestamp("canceled_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blockedDevices = pgTable("blocked_devices", {
  id: serial("id").primaryKey(),
  deviceHash: text("device_hash").notNull().unique(),
  blockedUntil: timestamp("blocked_until").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  teachingCourses: many(courses, { relationName: "teacherCourses" }),
  enrollments: many(enrollments),
  announcements: many(announcements),
  passwordResets: many(passwordResetRequests),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(users, {
    fields: [courses.teacherId],
    references: [users.id],
    relationName: "teacherCourses",
  }),
  enrollments: many(enrollments),
  announcementLinks: many(announcementCourses),
  subjectLinks: many(courseSubjects),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  courseLinks: many(courseSubjects),
}));

export const courseSubjectsRelations = relations(courseSubjects, ({ one }) => ({
  course: one(courses, {
    fields: [courseSubjects.courseId],
    references: [courses.id],
  }),
  subject: one(subjects, {
    fields: [courseSubjects.subjectId],
    references: [subjects.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
  courseLinks: many(announcementCourses),
}));

export const announcementCoursesRelations = relations(announcementCourses, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementCourses.announcementId],
    references: [announcements.id],
  }),
  course: one(courses, {
    fields: [announcementCourses.courseId],
    references: [courses.id],
  }),
}));

export const passwordResetRequestsRelations = relations(passwordResetRequests, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetRequests.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  ra: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  code: true,
  createdAt: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  code: true,
  createdAt: true,
});

export const insertCourseSubjectSchema = createInsertSchema(courseSubjects).omit({
  createdAt: true,
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  enrolledAt: true,
  createdAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export const insertAnnouncementCourseSchema = createInsertSchema(announcementCourses);

export const insertPasswordResetRequestSchema = createInsertSchema(passwordResetRequests).omit({
  id: true,
  attempts: true,
  usedAt: true,
  canceledAt: true,
  createdAt: true,
});

export const insertBlockedDeviceSchema = createInsertSchema(blockedDevices).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type CourseSubject = typeof courseSubjects.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementCourse = typeof announcementCourses.$inferSelect;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
export type BlockedDevice = typeof blockedDevices.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertCourseSubject = z.infer<typeof insertCourseSubjectSchema>;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertAnnouncementCourse = z.infer<typeof insertAnnouncementCourseSchema>;
export type InsertPasswordResetRequest = z.infer<typeof insertPasswordResetRequestSchema>;
export type InsertBlockedDevice = z.infer<typeof insertBlockedDeviceSchema>;

export type UserResponse = Omit<User, "password">;

export type CourseResponse = Course & {
  teacherName?: string;
  subjects?: Subject[];
};

export type EnrollmentResponse = Enrollment & {
  studentName?: string;
  studentEmail?: string;
  studentRa?: string;
  courseName?: string;
};

export type AnnouncementResponse = Announcement & {
  authorName?: string;
  courseIds?: number[];
};
