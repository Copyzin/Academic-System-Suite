ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "required_location_kind" text,
ADD COLUMN IF NOT EXISTS "required_equipment" text;

ALTER TABLE "class_sections"
ADD COLUMN IF NOT EXISTS "coordinator_teacher_id" integer REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "course_materials"
ADD COLUMN IF NOT EXISTS "subject_id" integer REFERENCES "subjects"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "teacher_assignment_profiles" (
  "teacher_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "career_track" text,
  "priority_order" integer DEFAULT 100 NOT NULL,
  "weekly_load_target_hours" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_time_slots" (
  "id" serial PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "sequence" integer NOT NULL,
  "is_break" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_availability_slots" (
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "weekday" text NOT NULL,
  "time_slot_id" integer NOT NULL REFERENCES "schedule_time_slots"("id") ON DELETE cascade,
  "is_available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_availability_slots_pk" PRIMARY KEY("teacher_id", "weekday", "time_slot_id")
);

CREATE TABLE IF NOT EXISTS "location_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "max_capacity" integer NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_prefix" text DEFAULT 'Sala' NOT NULL,
  "default_equipment" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "location_categories_name_idx" ON "location_categories" ("name");

CREATE TABLE IF NOT EXISTS "locations" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_id" integer NOT NULL REFERENCES "location_categories"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "max_capacity" integer NOT NULL,
  "equipment" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "locations_name_idx" ON "locations" ("name");

CREATE TABLE IF NOT EXISTS "class_section_subject_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "class_section_id" integer NOT NULL REFERENCES "class_sections"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "weekly_slot_target" integer DEFAULT 1 NOT NULL,
  "notes" text,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "class_section_subject_assignments_unique"
  ON "class_section_subject_assignments" ("class_section_id", "subject_id");

CREATE TABLE IF NOT EXISTS "teacher_preference_submissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "academic_term_id" integer NOT NULL REFERENCES "academic_terms"("id") ON DELETE cascade,
  "status" text DEFAULT 'draft' NOT NULL,
  "notes" text,
  "submitted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_preference_submissions_teacher_term_unique"
  ON "teacher_preference_submissions" ("teacher_id", "academic_term_id");

CREATE TABLE IF NOT EXISTS "teacher_preference_subjects" (
  "submission_id" integer NOT NULL REFERENCES "teacher_preference_submissions"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "priority" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_preference_subjects_pk" PRIMARY KEY("submission_id", "subject_id")
);

CREATE TABLE IF NOT EXISTS "teacher_preference_class_sections" (
  "submission_id" integer NOT NULL REFERENCES "teacher_preference_submissions"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "class_section_id" integer NOT NULL REFERENCES "class_sections"("id") ON DELETE cascade,
  "priority" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_preference_class_sections_pk" PRIMARY KEY("submission_id", "subject_id", "class_section_id")
);

CREATE TABLE IF NOT EXISTS "schedule_generation_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "academic_term_id" integer NOT NULL REFERENCES "academic_terms"("id") ON DELETE cascade,
  "triggered_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "status" text DEFAULT 'draft' NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_publications" (
  "id" serial PRIMARY KEY NOT NULL,
  "academic_term_id" integer NOT NULL REFERENCES "academic_terms"("id") ON DELETE cascade,
  "generation_run_id" integer REFERENCES "schedule_generation_runs"("id") ON DELETE set null,
  "published_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "class_schedule_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "class_section_id" integer NOT NULL REFERENCES "class_sections"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "assignment_id" integer REFERENCES "class_section_subject_assignments"("id") ON DELETE set null,
  "weekday" text NOT NULL,
  "time_slot_id" integer NOT NULL REFERENCES "schedule_time_slots"("id") ON DELETE cascade,
  "span_slots" integer DEFAULT 1 NOT NULL,
  "location_id" integer NOT NULL REFERENCES "locations"("id") ON DELETE cascade,
  "publication_id" integer REFERENCES "schedule_publications"("id") ON DELETE set null,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "class_slot_conflicts" (
  "id" serial PRIMARY KEY NOT NULL,
  "generation_run_id" integer REFERENCES "schedule_generation_runs"("id") ON DELETE set null,
  "schedule_entry_id" integer REFERENCES "class_schedule_entries"("id") ON DELETE set null,
  "conflict_type" text NOT NULL,
  "severity" text DEFAULT 'hard' NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "grade_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "class_section_id" integer NOT NULL REFERENCES "class_sections"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "student_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "grade" double precision NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "grade_entries_student_subject_unique"
  ON "grade_entries" ("class_section_id", "subject_id", "student_id");

CREATE TABLE IF NOT EXISTS "attendance_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "class_section_id" integer NOT NULL REFERENCES "class_sections"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "student_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "absences" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_entries_student_subject_unique"
  ON "attendance_entries" ("class_section_id", "subject_id", "student_id");
