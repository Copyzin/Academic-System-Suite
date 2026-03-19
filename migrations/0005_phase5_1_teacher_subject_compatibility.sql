ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "area" text,
ADD COLUMN IF NOT EXISTS "subarea" text;

CREATE TABLE IF NOT EXISTS "teacher_academic_degrees" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "degree_level" text NOT NULL,
  "course_name" text NOT NULL,
  "institution" text,
  "area" text,
  "subarea" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "competency_tags" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "area" text,
  "subarea" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "competency_tags_key_idx" ON "competency_tags" ("key");

CREATE TABLE IF NOT EXISTS "teacher_competencies" (
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "tag_id" integer NOT NULL REFERENCES "competency_tags"("id") ON DELETE cascade,
  "weight" integer DEFAULT 3 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_competencies_teacher_id_tag_id_pk" PRIMARY KEY("teacher_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "subject_competencies" (
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "tag_id" integer NOT NULL REFERENCES "competency_tags"("id") ON DELETE cascade,
  "weight" integer DEFAULT 3 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "subject_competencies_subject_id_tag_id_pk" PRIMARY KEY("subject_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "teacher_professional_experiences" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "company_name" text NOT NULL,
  "role_name" text NOT NULL,
  "description" text,
  "area" text,
  "subarea" text,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "is_current" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_professional_experience_competencies" (
  "experience_id" integer NOT NULL REFERENCES "teacher_professional_experiences"("id") ON DELETE cascade,
  "tag_id" integer NOT NULL REFERENCES "competency_tags"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_professional_experience_competencies_pk" PRIMARY KEY("experience_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "teacher_subject_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "academic_term_id" integer REFERENCES "academic_terms"("id") ON DELETE set null,
  "class_section_id" integer REFERENCES "class_sections"("id") ON DELETE set null,
  "taught_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_subject_manual_overrides" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "value" integer DEFAULT 0 NOT NULL,
  "reason" text NOT NULL,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "revoked_at" timestamp,
  "revoked_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_subject_match_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "final_score" integer NOT NULL,
  "compatibility_band" text NOT NULL,
  "score_degree" integer NOT NULL,
  "score_area" integer NOT NULL,
  "score_competency" integer NOT NULL,
  "score_teaching_history" integer NOT NULL,
  "score_professional_experience" integer NOT NULL,
  "score_manual_adjustment" integer DEFAULT 0 NOT NULL,
  "algorithm_version" text NOT NULL,
  "manual_override_id" integer REFERENCES "teacher_subject_manual_overrides"("id") ON DELETE set null,
  "explanation" jsonb NOT NULL,
  "calculated_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "calculated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_subject_match_scores_unique"
  ON "teacher_subject_match_scores" ("teacher_id", "subject_id", "algorithm_version");
