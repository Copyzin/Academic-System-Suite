import { z } from "zod";

const roleSchema = z.enum(["admin", "teacher", "student"]);

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
  workloadHours: z.number(),
  createdAt: z.string().or(z.date()).optional(),
});

export const enrollmentSchema = z.object({
  id: z.number(),
  studentId: z.number(),
  courseId: z.number(),
  status: z.enum(["active", "completed", "dropped"]),
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
    enroll: {
      method: "POST" as const,
      path: "/api/students/enroll" as const,
      input: z.object({
        name: z.string().min(3, "Nome completo obrigatorio"),
        cpf: z.string().min(11, "CPF obrigatorio"),
        phone: z.string().min(8, "Telefone obrigatorio"),
        email: z.string().email("E-mail invalido"),
        courseId: z.coerce.number().int().positive("Curso obrigatorio"),
      }),
      responses: {
        201: z.object({
          user: userPublicSchema,
          enrollment: enrollmentSchema,
        }),
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
        grade: z.coerce.number().nullable().optional(),
        attendance: z.coerce.number().nullable().optional(),
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
          grade: z.coerce.number().min(0).max(100).optional(),
          attendance: z.coerce.number().min(0).max(100).optional(),
          status: z.enum(["active", "completed", "dropped"]).optional(),
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
        expiresAt: z.string().datetime().optional(),
      }),
      responses: {
        201: announcementSchema,
        400: errorSchemas.validation,
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
