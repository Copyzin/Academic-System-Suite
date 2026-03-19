import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  uniqueIndex,
  primaryKey,
  jsonb,
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
  area: text("area"),
  subarea: text("subarea"),
  requiredLocationKind: text("required_location_kind", { enum: ["classroom", "laboratory"] }),
  requiredEquipment: text("required_equipment"),
  workloadHours: integer("workload_hours").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherAcademicDegrees = pgTable("teacher_academic_degrees", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  degreeLevel: text("degree_level", {
    enum: ["bachelor", "specialization", "master", "doctorate"],
  }).notNull(),
  courseName: text("course_name").notNull(),
  institution: text("institution"),
  area: text("area"),
  subarea: text("subarea"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const competencyTags = pgTable("competency_tags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  area: text("area"),
  subarea: text("subarea"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherCompetencies = pgTable(
  "teacher_competencies",
  {
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => competencyTags.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull().default(3),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teacherId, table.tagId] }),
  }),
);

export const subjectCompetencies = pgTable(
  "subject_competencies",
  {
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => competencyTags.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull().default(3),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subjectId, table.tagId] }),
  }),
);

export const teacherProfessionalExperiences = pgTable("teacher_professional_experiences", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  roleName: text("role_name").notNull(),
  description: text("description"),
  area: text("area"),
  subarea: text("subarea"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherProfessionalExperienceCompetencies = pgTable(
  "teacher_professional_experience_competencies",
  {
    experienceId: integer("experience_id")
      .notNull()
      .references(() => teacherProfessionalExperiences.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => competencyTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.experienceId, table.tagId] }),
  }),
);

export const teacherSubjectHistory = pgTable("teacher_subject_history", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  academicTermId: integer("academic_term_id").references(() => academicTerms.id, {
    onDelete: "set null",
  }),
  classSectionId: integer("class_section_id").references(() => classSections.id, {
    onDelete: "set null",
  }),
  taughtAt: timestamp("taught_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherSubjectManualOverrides = pgTable("teacher_subject_manual_overrides", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  action: text("action", {
    enum: ["boost", "penalty", "block", "force_eligible"],
  }).notNull(),
  value: integer("value").notNull().default(0),
  reason: text("reason").notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  revokedAt: timestamp("revoked_at"),
  revokedByUserId: integer("revoked_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherSubjectMatchScores = pgTable(
  "teacher_subject_match_scores",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    finalScore: integer("final_score").notNull(),
    compatibilityBand: text("compatibility_band", {
      enum: ["high", "medium", "low", "ineligible"],
    }).notNull(),
    scoreDegree: integer("score_degree").notNull(),
    scoreArea: integer("score_area").notNull(),
    scoreCompetency: integer("score_competency").notNull(),
    scoreTeachingHistory: integer("score_teaching_history").notNull(),
    scoreProfessionalExperience: integer("score_professional_experience").notNull(),
    scoreManualAdjustment: integer("score_manual_adjustment").notNull().default(0),
    algorithmVersion: text("algorithm_version").notNull(),
    manualOverrideId: integer("manual_override_id").references(() => teacherSubjectManualOverrides.id, {
      onDelete: "set null",
    }),
    explanation: jsonb("explanation").$type<Record<string, unknown>>().notNull(),
    calculatedByUserId: integer("calculated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  },
  (table) => ({
    teacherSubjectAlgorithmUnique: uniqueIndex("teacher_subject_match_scores_unique").on(
      table.teacherId,
      table.subjectId,
      table.algorithmVersion,
    ),
  }),
);

export const teacherAssignmentProfiles = pgTable("teacher_assignment_profiles", {
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  careerTrack: text("career_track"),
  priorityOrder: integer("priority_order").notNull().default(100),
  weeklyLoadTargetHours: integer("weekly_load_target_hours").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scheduleTimeSlots = pgTable("schedule_time_slots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  sequence: integer("sequence").notNull(),
  isBreak: boolean("is_break").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teacherAvailabilitySlots = pgTable(
  "teacher_availability_slots",
  {
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: text("weekday", {
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    }).notNull(),
    timeSlotId: integer("time_slot_id")
      .notNull()
      .references(() => scheduleTimeSlots.id, { onDelete: "cascade" }),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teacherId, table.weekday, table.timeSlotId] }),
  }),
);

export const locationCategories = pgTable("location_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: text("kind", { enum: ["classroom", "laboratory"] }).notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrefix: text("unit_prefix").notNull().default("Sala"),
  defaultEquipment: text("default_equipment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => locationCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull().unique(),
  kind: text("kind", { enum: ["classroom", "laboratory"] }).notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  equipment: text("equipment"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classSectionSubjectAssignments = pgTable(
  "class_section_subject_assignments",
  {
    id: serial("id").primaryKey(),
    classSectionId: integer("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weeklySlotTarget: integer("weekly_slot_target").notNull().default(1),
    notes: text("notes"),
    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    classSectionSubjectUnique: uniqueIndex("class_section_subject_assignments_unique").on(
      table.classSectionId,
      table.subjectId,
    ),
  }),
);

export const teacherPreferenceSubmissions = pgTable(
  "teacher_preference_submissions",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    academicTermId: integer("academic_term_id")
      .notNull()
      .references(() => academicTerms.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
    notes: text("notes"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teacherTermUnique: uniqueIndex("teacher_preference_submissions_teacher_term_unique").on(
      table.teacherId,
      table.academicTermId,
    ),
  }),
);

export const teacherPreferenceSubjects = pgTable(
  "teacher_preference_subjects",
  {
    submissionId: integer("submission_id")
      .notNull()
      .references(() => teacherPreferenceSubmissions.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.submissionId, table.subjectId] }),
  }),
);

export const teacherPreferenceClassSections = pgTable(
  "teacher_preference_class_sections",
  {
    submissionId: integer("submission_id")
      .notNull()
      .references(() => teacherPreferenceSubmissions.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    classSectionId: integer("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.submissionId, table.subjectId, table.classSectionId] }),
  }),
);

export const scheduleGenerationRuns = pgTable("schedule_generation_runs", {
  id: serial("id").primaryKey(),
  academicTermId: integer("academic_term_id")
    .notNull()
    .references(() => academicTerms.id, { onDelete: "cascade" }),
  triggeredByUserId: integer("triggered_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: text("status", { enum: ["draft", "validated", "failed", "published"] })
    .notNull()
    .default("draft"),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const schedulePublications = pgTable("schedule_publications", {
  id: serial("id").primaryKey(),
  academicTermId: integer("academic_term_id")
    .notNull()
    .references(() => academicTerms.id, { onDelete: "cascade" }),
  generationRunId: integer("generation_run_id").references(() => scheduleGenerationRuns.id, {
    onDelete: "set null",
  }),
  publishedByUserId: integer("published_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classScheduleEntries = pgTable("class_schedule_entries", {
  id: serial("id").primaryKey(),
  classSectionId: integer("class_section_id")
    .notNull()
    .references(() => classSections.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id").references(() => classSectionSubjectAssignments.id, {
    onDelete: "set null",
  }),
  weekday: text("weekday", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday"] }).notNull(),
  timeSlotId: integer("time_slot_id")
    .notNull()
    .references(() => scheduleTimeSlots.id, { onDelete: "cascade" }),
  spanSlots: integer("span_slots").notNull().default(1),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  publicationId: integer("publication_id").references(() => schedulePublications.id, {
    onDelete: "set null",
  }),
  createdByUserId: integer("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const classSlotConflicts = pgTable("class_slot_conflicts", {
  id: serial("id").primaryKey(),
  generationRunId: integer("generation_run_id").references(() => scheduleGenerationRuns.id, {
    onDelete: "set null",
  }),
  scheduleEntryId: integer("schedule_entry_id").references(() => classScheduleEntries.id, {
    onDelete: "set null",
  }),
  conflictType: text("conflict_type", {
    enum: [
      "teacher",
      "class_section",
      "location",
      "capacity",
      "location_kind",
      "availability",
      "integrity",
      "coordinator",
    ],
  }).notNull(),
  severity: text("severity", { enum: ["hard", "soft"] }).notNull().default("hard"),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gradeEntries = pgTable(
  "grade_entries",
  {
    id: serial("id").primaryKey(),
    classSectionId: integer("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grade: doublePrecision("grade").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    studentSubjectUnique: uniqueIndex("grade_entries_student_subject_unique").on(
      table.classSectionId,
      table.subjectId,
      table.studentId,
    ),
  }),
);

export const attendanceEntries = pgTable(
  "attendance_entries",
  {
    id: serial("id").primaryKey(),
    classSectionId: integer("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    absences: integer("absences").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    studentSubjectUnique: uniqueIndex("attendance_entries_student_subject_unique").on(
      table.classSectionId,
      table.subjectId,
      table.studentId,
    ),
  }),
);

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

export const academicTerms = pgTable("academic_terms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classSections = pgTable("class_sections", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  academicTermId: integer("academic_term_id")
    .notNull()
    .references(() => academicTerms.id, { onDelete: "cascade" }),
  coordinatorTeacherId: integer("coordinator_teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  room: text("room"),
  scheduleSummary: text("schedule_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classSectionTeachers = pgTable(
  "class_section_teachers",
  {
    classSectionId: integer("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.classSectionId, table.teacherId] }),
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
    status: text("status", { enum: ["active", "completed", "dropped", "locked", "canceled"] })
      .notNull()
      .default("active"),
    classSectionId: integer("class_section_id").references(() => classSections.id, {
      onDelete: "set null",
    }),
    academicTermId: integer("academic_term_id").references(() => academicTerms.id, {
      onDelete: "set null",
    }),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    grade: doublePrecision("grade"),
    attendance: integer("attendance"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    studentCourseTermUnique: uniqueIndex("enrollments_student_course_term_unique").on(
      table.studentId,
      table.courseId,
      table.academicTermId,
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

export const announcementTargets = pgTable(
  "announcement_targets",
  {
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["course", "class_section"] }).notNull(),
    targetId: integer("target_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.announcementId, table.targetType, table.targetId] }),
  }),
);

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

export const enrollmentStatusHistory = pgTable("enrollment_status_history", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  nextStatus: text("next_status").notNull(),
  changedByUserId: integer("changed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const approvedSubjectRecords = pgTable("approved_subject_records", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  approvedGrade: doublePrecision("approved_grade"),
  approvedAt: timestamp("approved_at").notNull().defaultNow(),
  snapshotBatchId: text("snapshot_batch_id"),
  source: text("source", { enum: ["manual", "lock_snapshot"] })
    .notNull()
    .default("lock_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["announcement", "finance", "academic", "system"] })
    .notNull()
    .default("system"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "set null" }),
  destinationRoute: text("destination_route").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: integer("related_entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const courseMaterials = pgTable("course_materials", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  internalName: text("internal_name").notNull().unique(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjects.id, {
    onDelete: "set null",
  }),
  classSectionId: integer("class_section_id").references(() => classSections.id, {
    onDelete: "set null",
  }),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPinnedMaterials = pgTable(
  "user_pinned_materials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    materialId: integer("material_id")
      .notNull()
      .references(() => courseMaterials.id, { onDelete: "cascade" }),
    pinnedAt: timestamp("pinned_at").notNull().defaultNow(),
  },
  (table) => ({
    userMaterialUnique: uniqueIndex("user_pinned_materials_user_material_unique").on(
      table.userId,
      table.materialId,
    ),
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
  classSectionAssignments: many(classSectionTeachers),
  enrollments: many(enrollments),
  announcements: many(announcements),
  enrollmentStatusChanges: many(enrollmentStatusHistory),
  approvedSubjectRecords: many(approvedSubjectRecords),
  receivedNotifications: many(notifications, { relationName: "notificationRecipient" }),
  sentNotifications: many(notifications, { relationName: "notificationSender" }),
  authoredMaterials: many(courseMaterials),
  pinnedMaterials: many(userPinnedMaterials),
  passwordResets: many(passwordResetRequests),
  academicDegrees: many(teacherAcademicDegrees),
  competencies: many(teacherCompetencies),
  professionalExperiences: many(teacherProfessionalExperiences),
  subjectHistory: many(teacherSubjectHistory, { relationName: "teacherSubjectHistory" }),
  subjectOverrides: many(teacherSubjectManualOverrides, { relationName: "teacherSubjectOverrideTeacher" }),
  createdSubjectOverrides: many(teacherSubjectManualOverrides, {
    relationName: "teacherSubjectOverrideCreatedBy",
  }),
  revokedSubjectOverrides: many(teacherSubjectManualOverrides, {
    relationName: "teacherSubjectOverrideRevokedBy",
  }),
  subjectMatchScores: many(teacherSubjectMatchScores, { relationName: "teacherSubjectMatchTeacher" }),
  calculatedSubjectMatchScores: many(teacherSubjectMatchScores, {
    relationName: "teacherSubjectMatchCalculatedBy",
  }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(users, {
    fields: [courses.teacherId],
    references: [users.id],
    relationName: "teacherCourses",
  }),
  enrollments: many(enrollments),
  classSections: many(classSections),
  announcementLinks: many(announcementCourses),
  subjectLinks: many(courseSubjects),
  approvedSubjectRecords: many(approvedSubjectRecords),
  materials: many(courseMaterials),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  courseLinks: many(courseSubjects),
  approvedSubjectRecords: many(approvedSubjectRecords),
  competencies: many(subjectCompetencies),
  teachingHistory: many(teacherSubjectHistory, { relationName: "teacherSubjectHistorySubject" }),
  overrides: many(teacherSubjectManualOverrides, { relationName: "teacherSubjectOverrideSubject" }),
  matchScores: many(teacherSubjectMatchScores, { relationName: "teacherSubjectMatchSubject" }),
}));

export const teacherAcademicDegreesRelations = relations(teacherAcademicDegrees, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherAcademicDegrees.teacherId],
    references: [users.id],
  }),
}));

export const competencyTagsRelations = relations(competencyTags, ({ many }) => ({
  teacherLinks: many(teacherCompetencies),
  subjectLinks: many(subjectCompetencies),
  professionalExperienceLinks: many(teacherProfessionalExperienceCompetencies),
}));

export const teacherCompetenciesRelations = relations(teacherCompetencies, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherCompetencies.teacherId],
    references: [users.id],
  }),
  tag: one(competencyTags, {
    fields: [teacherCompetencies.tagId],
    references: [competencyTags.id],
  }),
}));

export const subjectCompetenciesRelations = relations(subjectCompetencies, ({ one }) => ({
  subject: one(subjects, {
    fields: [subjectCompetencies.subjectId],
    references: [subjects.id],
  }),
  tag: one(competencyTags, {
    fields: [subjectCompetencies.tagId],
    references: [competencyTags.id],
  }),
}));

export const teacherProfessionalExperiencesRelations = relations(
  teacherProfessionalExperiences,
  ({ one, many }) => ({
    teacher: one(users, {
      fields: [teacherProfessionalExperiences.teacherId],
      references: [users.id],
    }),
    competencies: many(teacherProfessionalExperienceCompetencies),
  }),
);

export const teacherProfessionalExperienceCompetenciesRelations = relations(
  teacherProfessionalExperienceCompetencies,
  ({ one }) => ({
    experience: one(teacherProfessionalExperiences, {
      fields: [teacherProfessionalExperienceCompetencies.experienceId],
      references: [teacherProfessionalExperiences.id],
    }),
    tag: one(competencyTags, {
      fields: [teacherProfessionalExperienceCompetencies.tagId],
      references: [competencyTags.id],
    }),
  }),
);

export const teacherSubjectHistoryRelations = relations(teacherSubjectHistory, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherSubjectHistory.teacherId],
    references: [users.id],
    relationName: "teacherSubjectHistory",
  }),
  subject: one(subjects, {
    fields: [teacherSubjectHistory.subjectId],
    references: [subjects.id],
    relationName: "teacherSubjectHistorySubject",
  }),
  academicTerm: one(academicTerms, {
    fields: [teacherSubjectHistory.academicTermId],
    references: [academicTerms.id],
  }),
  classSection: one(classSections, {
    fields: [teacherSubjectHistory.classSectionId],
    references: [classSections.id],
  }),
}));

export const teacherSubjectManualOverridesRelations = relations(
  teacherSubjectManualOverrides,
  ({ one, many }) => ({
    teacher: one(users, {
      fields: [teacherSubjectManualOverrides.teacherId],
      references: [users.id],
      relationName: "teacherSubjectOverrideTeacher",
    }),
    subject: one(subjects, {
      fields: [teacherSubjectManualOverrides.subjectId],
      references: [subjects.id],
      relationName: "teacherSubjectOverrideSubject",
    }),
    createdBy: one(users, {
      fields: [teacherSubjectManualOverrides.createdByUserId],
      references: [users.id],
      relationName: "teacherSubjectOverrideCreatedBy",
    }),
    revokedBy: one(users, {
      fields: [teacherSubjectManualOverrides.revokedByUserId],
      references: [users.id],
      relationName: "teacherSubjectOverrideRevokedBy",
    }),
    matchScores: many(teacherSubjectMatchScores),
  }),
);

export const teacherSubjectMatchScoresRelations = relations(teacherSubjectMatchScores, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherSubjectMatchScores.teacherId],
    references: [users.id],
    relationName: "teacherSubjectMatchTeacher",
  }),
  subject: one(subjects, {
    fields: [teacherSubjectMatchScores.subjectId],
    references: [subjects.id],
    relationName: "teacherSubjectMatchSubject",
  }),
  manualOverride: one(teacherSubjectManualOverrides, {
    fields: [teacherSubjectMatchScores.manualOverrideId],
    references: [teacherSubjectManualOverrides.id],
  }),
  calculatedBy: one(users, {
    fields: [teacherSubjectMatchScores.calculatedByUserId],
    references: [users.id],
    relationName: "teacherSubjectMatchCalculatedBy",
  }),
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

export const academicTermsRelations = relations(academicTerms, ({ many }) => ({
  classSections: many(classSections),
  enrollments: many(enrollments),
}));

export const classSectionsRelations = relations(classSections, ({ one, many }) => ({
  course: one(courses, {
    fields: [classSections.courseId],
    references: [courses.id],
  }),
  academicTerm: one(academicTerms, {
    fields: [classSections.academicTermId],
    references: [academicTerms.id],
  }),
  teachers: many(classSectionTeachers),
  enrollments: many(enrollments),
  materials: many(courseMaterials),
}));

export const classSectionTeachersRelations = relations(classSectionTeachers, ({ one }) => ({
  classSection: one(classSections, {
    fields: [classSectionTeachers.classSectionId],
    references: [classSections.id],
  }),
  teacher: one(users, {
    fields: [classSectionTeachers.teacherId],
    references: [users.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  classSection: one(classSections, {
    fields: [enrollments.classSectionId],
    references: [classSections.id],
  }),
  academicTerm: one(academicTerms, {
    fields: [enrollments.academicTermId],
    references: [academicTerms.id],
  }),
  statusHistory: many(enrollmentStatusHistory),
  approvedSubjectRecords: many(approvedSubjectRecords),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
  courseLinks: many(announcementCourses),
  targets: many(announcementTargets),
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

export const announcementTargetsRelations = relations(announcementTargets, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementTargets.announcementId],
    references: [announcements.id],
  }),
}));

export const enrollmentStatusHistoryRelations = relations(enrollmentStatusHistory, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [enrollmentStatusHistory.enrollmentId],
    references: [enrollments.id],
  }),
  changedBy: one(users, {
    fields: [enrollmentStatusHistory.changedByUserId],
    references: [users.id],
  }),
}));

export const approvedSubjectRecordsRelations = relations(approvedSubjectRecords, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [approvedSubjectRecords.enrollmentId],
    references: [enrollments.id],
  }),
  student: one(users, {
    fields: [approvedSubjectRecords.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [approvedSubjectRecords.courseId],
    references: [courses.id],
  }),
  subject: one(subjects, {
    fields: [approvedSubjectRecords.subjectId],
    references: [subjects.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: "notificationRecipient",
  }),
  sender: one(users, {
    fields: [notifications.senderId],
    references: [users.id],
    relationName: "notificationSender",
  }),
}));

export const courseMaterialsRelations = relations(courseMaterials, ({ one, many }) => ({
  author: one(users, {
    fields: [courseMaterials.authorId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseMaterials.courseId],
    references: [courses.id],
  }),
  classSection: one(classSections, {
    fields: [courseMaterials.classSectionId],
    references: [classSections.id],
  }),
  pins: many(userPinnedMaterials),
}));

export const userPinnedMaterialsRelations = relations(userPinnedMaterials, ({ one }) => ({
  user: one(users, {
    fields: [userPinnedMaterials.userId],
    references: [users.id],
  }),
  material: one(courseMaterials, {
    fields: [userPinnedMaterials.materialId],
    references: [courseMaterials.id],
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

export const insertTeacherAcademicDegreeSchema = createInsertSchema(teacherAcademicDegrees).omit({
  id: true,
  createdAt: true,
});

export const insertCompetencyTagSchema = createInsertSchema(competencyTags).omit({
  id: true,
  createdAt: true,
});

export const insertTeacherCompetencySchema = createInsertSchema(teacherCompetencies).omit({
  createdAt: true,
});

export const insertSubjectCompetencySchema = createInsertSchema(subjectCompetencies).omit({
  createdAt: true,
});

export const insertTeacherProfessionalExperienceSchema = createInsertSchema(
  teacherProfessionalExperiences,
).omit({
  id: true,
  createdAt: true,
});

export const insertTeacherProfessionalExperienceCompetencySchema = createInsertSchema(
  teacherProfessionalExperienceCompetencies,
).omit({
  createdAt: true,
});

export const insertTeacherSubjectHistorySchema = createInsertSchema(teacherSubjectHistory).omit({
  id: true,
  createdAt: true,
});

export const insertTeacherSubjectManualOverrideSchema = createInsertSchema(
  teacherSubjectManualOverrides,
).omit({
  id: true,
  createdAt: true,
});

export const insertTeacherSubjectMatchScoreSchema = createInsertSchema(teacherSubjectMatchScores).omit({
  id: true,
  calculatedAt: true,
});

export const insertAcademicTermSchema = createInsertSchema(academicTerms).omit({
  id: true,
  createdAt: true,
});

export const insertClassSectionSchema = createInsertSchema(classSections).omit({
  id: true,
  createdAt: true,
});

export const insertClassSectionTeacherSchema = createInsertSchema(classSectionTeachers).omit({
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
export const insertAnnouncementTargetSchema = createInsertSchema(announcementTargets);

export const insertEnrollmentStatusHistorySchema = createInsertSchema(enrollmentStatusHistory).omit({
  id: true,
  createdAt: true,
});

export const insertApprovedSubjectRecordSchema = createInsertSchema(approvedSubjectRecords).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  readAt: true,
  createdAt: true,
});

export const insertCourseMaterialSchema = createInsertSchema(courseMaterials).omit({
  id: true,
  createdAt: true,
});

export const insertUserPinnedMaterialSchema = createInsertSchema(userPinnedMaterials).omit({
  id: true,
  pinnedAt: true,
});

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
export type TeacherAcademicDegree = typeof teacherAcademicDegrees.$inferSelect;
export type CompetencyTag = typeof competencyTags.$inferSelect;
export type TeacherCompetency = typeof teacherCompetencies.$inferSelect;
export type SubjectCompetency = typeof subjectCompetencies.$inferSelect;
export type TeacherProfessionalExperience = typeof teacherProfessionalExperiences.$inferSelect;
export type TeacherProfessionalExperienceCompetency =
  typeof teacherProfessionalExperienceCompetencies.$inferSelect;
export type TeacherSubjectHistory = typeof teacherSubjectHistory.$inferSelect;
export type TeacherSubjectManualOverride = typeof teacherSubjectManualOverrides.$inferSelect;
export type TeacherSubjectMatchScore = typeof teacherSubjectMatchScores.$inferSelect;
export type AcademicTerm = typeof academicTerms.$inferSelect;
export type ClassSection = typeof classSections.$inferSelect;
export type ClassSectionTeacher = typeof classSectionTeachers.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementTarget = typeof announcementTargets.$inferSelect;
export type AnnouncementCourse = typeof announcementCourses.$inferSelect;
export type EnrollmentStatusHistory = typeof enrollmentStatusHistory.$inferSelect;
export type ApprovedSubjectRecord = typeof approvedSubjectRecords.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type UserPinnedMaterial = typeof userPinnedMaterials.$inferSelect;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
export type BlockedDevice = typeof blockedDevices.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertCourseSubject = z.infer<typeof insertCourseSubjectSchema>;
export type InsertTeacherAcademicDegree = z.infer<typeof insertTeacherAcademicDegreeSchema>;
export type InsertCompetencyTag = z.infer<typeof insertCompetencyTagSchema>;
export type InsertTeacherCompetency = z.infer<typeof insertTeacherCompetencySchema>;
export type InsertSubjectCompetency = z.infer<typeof insertSubjectCompetencySchema>;
export type InsertTeacherProfessionalExperience = z.infer<typeof insertTeacherProfessionalExperienceSchema>;
export type InsertTeacherProfessionalExperienceCompetency =
  z.infer<typeof insertTeacherProfessionalExperienceCompetencySchema>;
export type InsertTeacherSubjectHistory = z.infer<typeof insertTeacherSubjectHistorySchema>;
export type InsertTeacherSubjectManualOverride = z.infer<typeof insertTeacherSubjectManualOverrideSchema>;
export type InsertTeacherSubjectMatchScore = z.infer<typeof insertTeacherSubjectMatchScoreSchema>;
export type InsertAcademicTerm = z.infer<typeof insertAcademicTermSchema>;
export type InsertClassSection = z.infer<typeof insertClassSectionSchema>;
export type InsertClassSectionTeacher = z.infer<typeof insertClassSectionTeacherSchema>;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertAnnouncementCourse = z.infer<typeof insertAnnouncementCourseSchema>;
export type InsertAnnouncementTarget = z.infer<typeof insertAnnouncementTargetSchema>;
export type InsertEnrollmentStatusHistory = z.infer<typeof insertEnrollmentStatusHistorySchema>;
export type InsertApprovedSubjectRecord = z.infer<typeof insertApprovedSubjectRecordSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertCourseMaterial = z.infer<typeof insertCourseMaterialSchema>;
export type InsertUserPinnedMaterial = z.infer<typeof insertUserPinnedMaterialSchema>;
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
  classSectionCode?: string;
  classSectionName?: string;
  academicTermCode?: string;
};

export type AnnouncementResponse = Announcement & {
  authorName?: string;
  courseIds?: number[];
  classSectionIds?: number[];
};

export type CourseMaterialResponse = CourseMaterial & {
  authorName?: string;
  courseName?: string;
  classSectionCode?: string;
  classSectionName?: string;
  isPinned?: boolean;
};

export type StudentListResponse = UserResponse & {
  enrollmentId: number;
  enrollmentStatus: Enrollment["status"];
  courseId: number;
  courseCode: string;
  courseName: string;
  classSectionId: number | null;
  classSectionCode?: string;
  classSectionName?: string;
  academicTermId?: number | null;
  academicTermCode?: string;
};

export type StudentScopeResponse = {
  courses: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  classSections: Array<{
    id: number;
    code: string;
    name: string;
    courseId: number;
    academicTermId: number;
    academicTermCode: string;
  }>;
};
