import { z } from "zod";

const roleSchema = z.enum(["admin", "teacher", "student"]);
const enrollmentStatusSchema = z.enum(["active", "completed", "dropped", "locked", "canceled"]);
const notificationTypeSchema = z.enum(["announcement", "finance", "academic", "system"]);
const compatibilityBandSchema = z.enum(["high", "medium", "low", "ineligible"]);
const teacherSubjectOverrideActionSchema = z.enum(["boost", "penalty", "block", "force_eligible"]);
const weekdaySchema = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]);
const locationKindSchema = z.enum(["classroom", "laboratory"]);
const scheduleConflictTypeSchema = z.enum([
  "teacher",
  "class_section",
  "location",
  "capacity",
  "location_kind",
  "availability",
  "integrity",
  "coordinator",
]);
const scheduleConflictSeveritySchema = z.enum(["hard", "soft"]);
const decimalGradeSchema = z
  .coerce
  .number()
  .min(0)
  .max(10)
  .refine((value) => Number.isFinite(value) && Math.round(value * 100) / 100 === value, {
    message: "Nota deve ter no maximo duas casas decimais",
  });

export const userPublicSchema = z.object({
  id: z.number(),
  ra: z.string(),
  username: z.string().nullable().optional(),
  role: roleSchema,
  name: z.string(),
  cpf: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().email(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const courseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  teacherId: z.number().nullable().optional(),
  teacherName: z.string().optional(),
  schedule: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export const subjectSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  subarea: z.string().nullable().optional(),
  workloadHours: z.number(),
  createdAt: z.string().or(z.date()).optional(),
});

export const teacherSubjectCompatibilitySchema = z.object({
  teacherId: z.number(),
  teacherName: z.string(),
  subjectId: z.number(),
  subjectName: z.string(),
  finalScore: z.number().int().min(0).max(100),
  compatibilityBand: compatibilityBandSchema,
  scoreDegree: z.number().int().min(0).max(25),
  scoreArea: z.number().int().min(0).max(20),
  scoreCompetency: z.number().int().min(0).max(20),
  scoreTeachingHistory: z.number().int().min(0).max(20),
  scoreProfessionalExperience: z.number().int().min(0).max(10),
  scoreManualAdjustment: z.number().int().min(-5).max(5),
  algorithmVersion: z.string(),
  blocked: z.boolean(),
  explanation: z.record(z.any()),
  calculatedAt: z.string().or(z.date()),
});

export const teacherSubjectOverrideSchema = z.object({
  id: z.number(),
  teacherId: z.number(),
  subjectId: z.number(),
  action: teacherSubjectOverrideActionSchema,
  value: z.number().int(),
  reason: z.string(),
  createdByUserId: z.number().nullable().optional(),
  revokedAt: z.string().or(z.date()).nullable().optional(),
  revokedByUserId: z.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export const classSectionSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  courseId: z.number(),
  academicTermId: z.number(),
  academicTermCode: z.string(),
});

export const scheduleTimeSlotSchema = z.object({
  id: z.number(),
  label: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  sequence: z.number().int(),
  isBreak: z.boolean(),
});

export const locationCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: locationKindSchema,
  maxCapacity: z.number().int(),
  quantity: z.number().int(),
  unitPrefix: z.string(),
  defaultEquipment: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const locationSchema = z.object({
  id: z.number(),
  categoryId: z.number(),
  name: z.string(),
  kind: locationKindSchema,
  maxCapacity: z.number().int(),
  equipment: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const teachingAssignmentProfileSchema = z.object({
  id: z.number().optional(),
  teacherId: z.number(),
  name: z.string().optional(),
  careerTrack: z.string().nullable().optional(),
  priorityOrder: z.number().int(),
  weeklyLoadTargetHours: z.number().int(),
  assignedSlotCount: z.number().int().optional(),
  remainingLoadHours: z.number().int().optional(),
});

export const classSectionSubjectAssignmentSchema = z.object({
  id: z.number(),
  classSectionId: z.number(),
  classSectionName: z.string(),
  classSectionCode: z.string().optional(),
  courseName: z.string(),
  subjectId: z.number(),
  subjectName: z.string(),
  teacherId: z.number(),
  teacherName: z.string(),
  weeklySlotTarget: z.number().int(),
  notes: z.string().nullable().optional(),
});

export const classScheduleEntrySchema = z.object({
  id: z.number(),
  classSectionId: z.number(),
  classSectionName: z.string(),
  classSectionCode: z.string(),
  courseId: z.number(),
  courseName: z.string(),
  subjectId: z.number(),
  subjectName: z.string(),
  teacherId: z.number(),
  teacherName: z.string(),
  assignmentId: z.number().nullable().optional(),
  weekday: weekdaySchema,
  timeSlotId: z.number(),
  timeSlotLabel: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  spanSlots: z.number().int(),
  locationId: z.number(),
  locationName: z.string(),
  locationKind: locationKindSchema,
  publicationId: z.number().nullable().optional(),
  publicationCreatedAt: z.string().or(z.date()).nullable().optional(),
  sequence: z.number().int(),
  isBreak: z.boolean(),
});

export const scheduleConflictSchema = z.object({
  scheduleEntryId: z.number().nullable().optional(),
  conflictType: scheduleConflictTypeSchema,
  severity: scheduleConflictSeveritySchema,
  message: z.string(),
  metadata: z.record(z.any()).optional(),
});

export const academicRecordStudentSchema = z.object({
  studentId: z.number(),
  studentName: z.string(),
  studentRa: z.string(),
  grade: z.number().nullable().optional(),
  absences: z.number().int(),
});

export const academicRecordSheetSchema = z.object({
  classSection: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string(),
    courseId: z.number(),
    courseName: z.string(),
  }),
  subject: z.object({
    id: z.number(),
    name: z.string(),
  }),
  canEdit: z.boolean(),
  students: z.array(academicRecordStudentSchema),
});

export const weeklySchedulePayloadSchema = z.object({
  activeTerm: z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
  }),
  timeSlots: z.array(scheduleTimeSlotSchema),
  weekdays: z.array(weekdaySchema),
  entries: z.array(classScheduleEntrySchema),
});

export const teacherAssignmentWorkspaceSchema = z.object({
  activeTerm: z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
  }),
  timeSlots: z.array(scheduleTimeSlotSchema),
  weekdays: z.array(weekdaySchema),
  teacher: teachingAssignmentProfileSchema.extend({
    id: z.number(),
    name: z.string(),
  }),
  classSections: z.array(
    z.object({
      id: z.number(),
      code: z.string(),
      name: z.string(),
      courseId: z.number(),
      courseName: z.string(),
    }),
  ),
  eligibleSubjects: z.array(teacherSubjectCompatibilitySchema),
  preferences: z.object({
    submissionId: z.number().nullable(),
    status: z.enum(["draft", "submitted"]),
    notes: z.string(),
    subjectIds: z.array(z.number()),
    sectionPreferences: z.array(
      z.object({
        subjectId: z.number(),
        classSectionId: z.number(),
        priority: z.number().int(),
      }),
    ),
    availability: z.array(
      z.object({
        weekday: weekdaySchema,
        timeSlotId: z.number(),
        isAvailable: z.boolean(),
      }),
    ),
  }),
  publishedEntries: z.array(classScheduleEntrySchema),
  aiAssistance: z.object({
    available: z.boolean(),
  }),
});

export const teachingAssignmentAdminWorkspaceSchema = z.object({
  activeTerm: z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
  }),
  timeSlots: z.array(scheduleTimeSlotSchema),
  weekdays: z.array(weekdaySchema),
  teachers: z.array(teachingAssignmentProfileSchema.extend({ id: z.number(), name: z.string() })),
  classSections: z.array(
    z.object({
      id: z.number(),
      code: z.string(),
      name: z.string(),
      courseId: z.number(),
      courseName: z.string(),
      coordinatorTeacherId: z.number().nullable().optional(),
      coordinatorTeacherName: z.string().nullable().optional(),
      studentCount: z.number().int(),
    }),
  ),
  subjects: z.array(subjectSchema),
  assignments: z.array(classSectionSubjectAssignmentSchema),
  draftEntries: z.array(classScheduleEntrySchema),
  publishedEntries: z.array(classScheduleEntrySchema),
  locationCategories: z.array(locationCategorySchema),
  locations: z.array(locationSchema),
  latestPublication: z
    .object({
      id: z.number(),
      academicTermId: z.number(),
      notes: z.string().nullable().optional(),
      createdAt: z.string().or(z.date()),
    })
    .nullable()
    .optional(),
  latestRun: z
    .object({
      id: z.number(),
      academicTermId: z.number(),
      status: z.enum(["draft", "validated", "failed", "published"]),
      summary: z.record(z.any()),
      createdAt: z.string().or(z.date()),
    })
    .nullable()
    .optional(),
});

export const enrollmentSchema = z.object({
  id: z.number(),
  studentId: z.number(),
  courseId: z.number(),
  status: enrollmentStatusSchema,
  classSectionId: z.number().nullable().optional(),
  academicTermId: z.number().nullable().optional(),
  classSectionCode: z.string().optional(),
  classSectionName: z.string().optional(),
  academicTermCode: z.string().optional(),
  enrolledAt: z.string().or(z.date()).optional(),
  createdAt: z.string().or(z.date()).optional(),
  grade: z.number().nullable().optional(),
  attendance: z.number().nullable().optional(),
  studentName: z.string().optional(),
  studentEmail: z.string().optional(),
  studentRa: z.string().optional(),
  courseName: z.string().optional(),
});

export const announcementSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  authorId: z.number(),
  authorName: z.string().optional(),
  isGlobal: z.boolean(),
  expiresAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  courseIds: z.array(z.number()).optional(),
  classSectionIds: z.array(z.number()).optional(),
});

export const notificationSchema = z.object({
  id: z.number(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  senderId: z.number().nullable().optional(),
  senderName: z.string().optional(),
  destinationRoute: z.string(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.number().nullable().optional(),
  isRead: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const materialSchema = z.object({
  id: z.number(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  authorId: z.number(),
  authorName: z.string().optional(),
  courseId: z.number(),
  courseName: z.string().optional(),
  subjectId: z.number().nullable().optional(),
  subjectName: z.string().optional(),
  classSectionId: z.number().nullable().optional(),
  classSectionCode: z.string().optional(),
  classSectionName: z.string().optional(),
  issuedAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
  isPinned: z.boolean(),
  downloadUrl: z.string(),
});

export const studentListSchema = userPublicSchema.extend({
  enrollmentId: z.number(),
  enrollmentStatus: enrollmentStatusSchema,
  courseId: z.number(),
  courseCode: z.string(),
  courseName: z.string(),
  classSectionId: z.number().nullable(),
  classSectionCode: z.string().optional(),
  classSectionName: z.string().optional(),
  academicTermId: z.number().nullable().optional(),
  academicTermCode: z.string().optional(),
});

export const studentScopeSchema = z.object({
  courses: z.array(
    z.object({
      id: z.number(),
      code: z.string(),
      name: z.string(),
    }),
  ),
  classSections: z.array(classSectionSchema),
});

export const errorSchemas = {
  validation: z.object({ message: z.string() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login" as const,
      input: z.object({
        identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
        password: z.string().min(1, "Informe a senha"),
      }),
      responses: {
        200: userPublicSchema,
        401: errorSchemas.unauthorized,
      },
    },
    changePassword: {
      method: "POST" as const,
      path: "/api/change-password" as const,
      input: z
        .object({
          currentPassword: z.string().min(1, "Senha atual obrigatoria"),
          newPassword: z.string().min(8, "Nova senha deve ter no minimo 8 caracteres"),
          confirmPassword: z.string().min(1, "Confirme a nova senha"),
        })
        .refine((v) => v.newPassword === v.confirmPassword, {
          message: "A confirmacao da senha deve ser identica",
          path: ["confirmPassword"],
        }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    forgotPassword: {
      method: "POST" as const,
      path: "/api/auth/forgot-password" as const,
      input: z.object({
        identifier: z.string().min(1, "Informe R.A, CPF ou e-mail"),
        deviceId: z.string().min(10, "Dispositivo invalido"),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    validateResetToken: {
      method: "POST" as const,
      path: "/api/auth/validate-reset-token" as const,
      input: z.object({
        identifier: z.string().min(1),
        token: z.string().regex(/^\d{5}$/, "Token deve conter 5 digitos"),
        deviceId: z.string().min(10),
      }),
      responses: {
        200: z.object({ valid: z.boolean() }),
      },
    },
    resetPassword: {
      method: "POST" as const,
      path: "/api/auth/reset-password" as const,
      input: z
        .object({
          identifier: z.string().min(1),
          token: z.string().regex(/^\d{5}$/, "Token deve conter 5 digitos"),
          deviceId: z.string().min(10),
          newPassword: z.string().min(8, "Senha deve ter no minimo 8 caracteres"),
          confirmPassword: z.string().min(1),
        })
        .refine((v) => v.newPassword === v.confirmPassword, {
          message: "A confirmacao da senha deve ser identica",
          path: ["confirmPassword"],
        }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
    cancelPasswordReset: {
      method: "POST" as const,
      path: "/api/auth/cancel-password-reset" as const,
      input: z.object({
        requestId: z.coerce.number().int().positive(),
        cancelToken: z.string().min(20),
        deviceId: z.string().min(10),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout" as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/user" as const,
      responses: {
        200: userPublicSchema,
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users" as const,
      input: z
        .object({
          role: roleSchema.optional(),
        })
        .optional(),
      responses: {
        200: z.array(userPublicSchema.extend({ courseName: z.string().optional() })),
      },
    },
    updateAvatar: {
      method: "POST" as const,
      path: "/api/users/me/avatar" as const,
      input: z.object({
        avatarUrl: z.string().min(20, "Imagem invalida"),
      }),
      responses: {
        200: userPublicSchema,
      },
    },
  },
  students: {
    scope: {
      method: "GET" as const,
      path: "/api/students/scope" as const,
      responses: {
        200: studentScopeSchema,
        403: errorSchemas.forbidden,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/students" as const,
      input: z
        .object({
          courseId: z.coerce.number().optional(),
          classSectionId: z.coerce.number().optional(),
          status: enrollmentStatusSchema.optional(),
        })
        .optional(),
      responses: {
        200: z.array(studentListSchema),
        403: errorSchemas.forbidden,
      },
    },
    enroll: {
      method: "POST" as const,
      path: "/api/students/enroll" as const,
      input: z.object({
        name: z.string().min(3, "Nome completo obrigatorio"),
        cpf: z.string().min(11, "CPF obrigatorio"),
        phone: z.string().min(8, "Telefone obrigatorio"),
        email: z.string().email("E-mail invalido"),
        courseId: z.coerce.number().int().positive("Curso obrigatorio"),
        classSectionId: z.coerce.number().int().positive("Turma obrigatoria"),
      }),
      responses: {
        201: z.object({
          user: userPublicSchema,
          enrollment: enrollmentSchema,
        }),
      },
    },
    lockEnrollment: {
      method: "POST" as const,
      path: "/api/students/enrollments/:id/lock" as const,
      input: z.object({
        reason: z.string().min(5, "Motivo obrigatorio"),
        approvedSubjectIds: z.array(z.coerce.number().int().positive()).optional(),
      }),
      responses: {
        200: z.object({
          enrollment: enrollmentSchema,
          preservedApprovedSubjects: z.number().int().nonnegative(),
        }),
        400: errorSchemas.validation,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
  },
  courses: {
    list: {
      method: "GET" as const,
      path: "/api/courses" as const,
      responses: {
        200: z.array(courseSchema),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/courses/:id" as const,
      responses: {
        200: courseSchema.extend({ subjects: z.array(subjectSchema).optional() }),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/courses" as const,
      input: z.object({
        name: z.string().min(2, "Nome do curso obrigatorio"),
        description: z.string().optional(),
        schedule: z.string().optional(),
        teacherId: z.coerce.number().optional(),
      }),
      responses: {
        201: courseSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/courses/:id" as const,
      input: z
        .object({
          name: z.string().min(2).optional(),
          description: z.string().nullable().optional(),
          schedule: z.string().nullable().optional(),
          teacherId: z.coerce.number().nullable().optional(),
        })
        .partial(),
      responses: {
        200: courseSchema,
        404: errorSchemas.notFound,
      },
    },
    subjects: {
      list: {
        method: "GET" as const,
        path: "/api/courses/:id/subjects" as const,
        responses: {
          200: z.array(subjectSchema),
        },
      },
      update: {
        method: "PUT" as const,
        path: "/api/courses/:id/subjects" as const,
        input: z.object({
          subjectIds: z.array(z.coerce.number().int().positive()),
        }),
        responses: {
          200: z.object({ message: z.string() }),
        },
      },
    },
  },
  subjects: {
    list: {
      method: "GET" as const,
      path: "/api/subjects" as const,
      responses: {
        200: z.array(subjectSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/subjects" as const,
      input: z.object({
        name: z.string().min(2, "Nome da materia obrigatorio"),
        description: z.string().optional(),
        area: z.string().max(120).optional(),
        subarea: z.string().max(120).optional(),
        workloadHours: z.coerce.number().int().min(0),
      }),
      responses: {
        201: subjectSchema,
      },
    },
  },
  enrollments: {
    list: {
      method: "GET" as const,
      path: "/api/enrollments" as const,
      input: z
        .object({
          courseId: z.coerce.number().optional(),
          studentId: z.coerce.number().optional(),
        })
        .optional(),
      responses: {
        200: z.array(enrollmentSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/enrollments" as const,
      input: z.object({
        studentId: z.coerce.number().int().positive(),
        courseId: z.coerce.number().int().positive(),
        classSectionId: z.coerce.number().int().positive().optional(),
        academicTermId: z.coerce.number().int().positive().optional(),
        grade: decimalGradeSchema.nullable().optional(),
        attendance: z.coerce.number().int().min(0).max(500).nullable().optional(),
      }),
      responses: {
        201: enrollmentSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/enrollments/:id" as const,
      input: z
        .object({
          grade: decimalGradeSchema.optional(),
          attendance: z.coerce.number().int().min(0).max(500).optional(),
          status: enrollmentStatusSchema.optional(),
        })
        .partial(),
      responses: {
        200: enrollmentSchema,
        404: errorSchemas.notFound,
      },
    },
  },
  announcements: {
    list: {
      method: "GET" as const,
      path: "/api/announcements" as const,
      input: z
        .object({
          courseId: z.coerce.number().optional(),
          classSectionId: z.coerce.number().optional(),
        })
        .optional(),
      responses: {
        200: z.array(announcementSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/announcements" as const,
      input: z.object({
        title: z.string().min(3, "Titulo obrigatorio"),
        content: z.string().min(3, "Conteudo obrigatorio"),
        isGlobal: z.boolean(),
        courseIds: z.array(z.coerce.number().int().positive()).optional(),
        classSectionIds: z.array(z.coerce.number().int().positive()).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
      responses: {
        201: announcementSchema,
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/announcements/:id" as const,
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
  },
  materials: {
    list: {
      method: "GET" as const,
      path: "/api/materials" as const,
      responses: {
        200: z.array(materialSchema),
        403: errorSchemas.forbidden,
      },
    },
    upload: {
      method: "POST" as const,
      path: "/api/materials/upload" as const,
      input: z.object({
        subjectId: z.coerce.number().int().positive(),
        classSectionIds: z.array(z.coerce.number().int().positive()).min(1, "Selecione ao menos uma turma"),
        issuedAt: z.string().datetime().optional(),
      }),
      responses: {
        201: z.object({
          createdCount: z.number().int().positive(),
          materials: z.array(materialSchema),
        }),
        400: errorSchemas.validation,
        403: errorSchemas.forbidden,
      },
    },
    download: {
      method: "GET" as const,
      path: "/api/materials/:id/download" as const,
      responses: {
        200: z.void(),
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    pin: {
      method: "POST" as const,
      path: "/api/materials/:id/pin" as const,
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    unpin: {
      method: "DELETE" as const,
      path: "/api/materials/:id/pin" as const,
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
  },
  notifications: {
    list: {
      method: "GET" as const,
      path: "/api/notifications" as const,
      input: z
        .object({
          unreadOnly: z.coerce.boolean().optional(),
        })
        .optional(),
      responses: {
        200: z.array(notificationSchema),
      },
    },
    markRead: {
      method: "POST" as const,
      path: "/api/notifications/:id/read" as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  dashboard: {
    get: {
      method: "GET" as const,
      path: "/api/dashboard" as const,
      responses: {
        200: z.object({
          role: roleSchema,
          cards: z.array(
            z.object({
              label: z.string(),
              value: z.string(),
              trend: z.string().optional(),
            }),
          ),
        }),
      },
    },
  },
  teacherSubjectCompatibility: {
    calculate: {
      method: "GET" as const,
      path: "/api/admin/teacher-subject-compatibility" as const,
      input: z.object({
        teacherId: z.coerce.number().int().positive(),
        subjectId: z.coerce.number().int().positive(),
        persist: z.coerce.boolean().optional(),
      }),
      responses: {
        200: teacherSubjectCompatibilitySchema,
        400: errorSchemas.validation,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    override: {
      create: {
        method: "POST" as const,
        path: "/api/admin/teacher-subject-compatibility/override" as const,
        input: z.object({
          teacherId: z.coerce.number().int().positive(),
          subjectId: z.coerce.number().int().positive(),
          action: teacherSubjectOverrideActionSchema,
          value: z.coerce.number().int().min(0).max(5).optional(),
          reason: z.string().min(5, "Motivo obrigatorio"),
        }),
        responses: {
          201: teacherSubjectOverrideSchema,
          400: errorSchemas.validation,
          403: errorSchemas.forbidden,
          404: errorSchemas.notFound,
        },
      },
      revoke: {
        method: "POST" as const,
        path: "/api/admin/teacher-subject-compatibility/override/:id/revoke" as const,
        input: z.object({
          reason: z.string().min(5, "Motivo obrigatorio").optional(),
        }),
        responses: {
          200: teacherSubjectOverrideSchema,
          400: errorSchemas.validation,
          403: errorSchemas.forbidden,
          404: errorSchemas.notFound,
        },
      },
    },
  },
  teachingAssignments: {
    adminWorkspace: {
      method: "GET" as const,
      path: "/api/teaching-assignments/admin/workspace" as const,
      responses: {
        200: teachingAssignmentAdminWorkspaceSchema,
        403: errorSchemas.forbidden,
      },
    },
    teacherWorkspace: {
      method: "GET" as const,
      path: "/api/teaching-assignments/teacher/workspace" as const,
      responses: {
        200: teacherAssignmentWorkspaceSchema,
        403: errorSchemas.forbidden,
      },
    },
    teacherPreferences: {
      method: "PUT" as const,
      path: "/api/teaching-assignments/teacher/preferences" as const,
      input: z.object({
        notes: z.string().optional(),
        subjectIds: z.array(z.coerce.number().int().positive()),
        sectionPreferences: z.array(
          z.object({
            subjectId: z.coerce.number().int().positive(),
            classSectionId: z.coerce.number().int().positive(),
            priority: z.coerce.number().int().min(1),
          }),
        ),
        availability: z.array(
          z.object({
            weekday: weekdaySchema,
            timeSlotId: z.coerce.number().int().positive(),
            isAvailable: z.boolean(),
          }),
        ),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.forbidden,
      },
    },
    teacherProfile: {
      method: "POST" as const,
      path: "/api/teaching-assignments/admin/teacher-profiles" as const,
      input: z.object({
        teacherId: z.coerce.number().int().positive(),
        careerTrack: z.string().optional(),
        priorityOrder: z.coerce.number().int().min(1),
        weeklyLoadTargetHours: z.coerce.number().int().min(0),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.forbidden,
      },
    },
    locationCategories: {
      create: {
        method: "POST" as const,
        path: "/api/teaching-assignments/admin/location-categories" as const,
        input: z.object({
          name: z.string().min(2),
          kind: locationKindSchema,
          maxCapacity: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().positive(),
          unitPrefix: z.string().min(2),
          defaultEquipment: z.string().optional(),
        }),
        responses: {
          201: z.array(locationSchema),
          403: errorSchemas.forbidden,
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/teaching-assignments/admin/location-categories/:id" as const,
        input: z.object({
          name: z.string().min(2),
          kind: locationKindSchema,
          maxCapacity: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().positive(),
          unitPrefix: z.string().min(2),
          defaultEquipment: z.string().optional(),
        }),
        responses: {
          200: z.array(locationSchema),
          403: errorSchemas.forbidden,
        },
      },
    },
    assignments: {
      upsert: {
        method: "POST" as const,
        path: "/api/teaching-assignments/admin/assignments" as const,
        input: z.object({
          id: z.coerce.number().int().positive().optional(),
          classSectionId: z.coerce.number().int().positive(),
          subjectId: z.coerce.number().int().positive(),
          teacherId: z.coerce.number().int().positive(),
          weeklySlotTarget: z.coerce.number().int().positive(),
          notes: z.string().optional(),
          coordinatorTeacherId: z.coerce.number().int().positive().nullable().optional(),
        }),
        responses: {
          200: classSectionSubjectAssignmentSchema,
          403: errorSchemas.forbidden,
        },
      },
    },
    scheduleEntries: {
      create: {
        method: "POST" as const,
        path: "/api/teaching-assignments/admin/schedule-entries" as const,
        input: z.object({
          assignmentId: z.coerce.number().int().positive(),
          weekday: weekdaySchema,
          timeSlotId: z.coerce.number().int().positive(),
          spanSlots: z.coerce.number().int().positive(),
          locationId: z.coerce.number().int().positive(),
        }),
        responses: {
          201: z.object({ message: z.string() }),
          400: errorSchemas.validation,
          403: errorSchemas.forbidden,
        },
      },
      remove: {
        method: "DELETE" as const,
        path: "/api/teaching-assignments/admin/schedule-entries/:id" as const,
        responses: {
          200: z.object({ message: z.string() }),
          403: errorSchemas.forbidden,
        },
      },
    },
    validate: {
      method: "POST" as const,
      path: "/api/teaching-assignments/admin/validate" as const,
      responses: {
        200: z.object({
          runId: z.number(),
          status: z.enum(["draft", "validated", "failed", "published"]),
          hardConflictCount: z.number().int(),
          softConflictCount: z.number().int(),
          conflicts: z.array(scheduleConflictSchema),
        }),
        403: errorSchemas.forbidden,
      },
    },
    publish: {
      method: "POST" as const,
      path: "/api/teaching-assignments/admin/publish" as const,
      input: z.object({
        notes: z.string().optional(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        403: errorSchemas.forbidden,
      },
    },
    mySchedule: {
      method: "GET" as const,
      path: "/api/teaching-assignments/my-schedule" as const,
      responses: {
        200: weeklySchedulePayloadSchema,
        403: errorSchemas.forbidden,
      },
    },
    aiAssist: {
      method: "POST" as const,
      path: "/api/teaching-assignments/admin/ai-eligibility-suggestions" as const,
      input: z.object({
        teacherId: z.coerce.number().int().positive(),
      }),
      responses: {
        200: z.object({
          aiAvailable: z.boolean(),
          suggestions: z.array(z.object({ summary: z.string() })),
          deterministicFallback: z.array(
            z.object({
              subjectId: z.number(),
              subjectName: z.string(),
              finalScore: z.number(),
              compatibilityBand: compatibilityBandSchema,
            }),
          ),
        }),
      },
    },
  },
  academicRecords: {
    list: {
      method: "GET" as const,
      path: "/api/class-sections/:classSectionId/subjects/:subjectId/records" as const,
      responses: {
        200: academicRecordSheetSchema,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    upsert: {
      method: "PUT" as const,
      path: "/api/class-sections/:classSectionId/subjects/:subjectId/records/:studentId" as const,
      input: z
        .object({
          grade: decimalGradeSchema.optional(),
          absences: z.coerce.number().int().min(0).max(99).optional(),
        })
        .refine((value) => value.grade !== undefined || value.absences !== undefined, {
          message: "Informe ao menos nota ou faltas",
        }),
      responses: {
        200: academicRecordSheetSchema,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, String(value));
    }
  }
  return url;
}
