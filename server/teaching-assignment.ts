import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  academicTerms,
  attendanceEntries,
  classScheduleEntries,
  classSlotConflicts,
  classSectionSubjectAssignments,
  classSections,
  courseMaterials,
  courseSubjects,
  courses,
  enrollments,
  gradeEntries,
  locationCategories,
  locations,
  scheduleGenerationRuns,
  schedulePublications,
  scheduleTimeSlots,
  subjectCompetencies,
  subjects,
  teacherAssignmentProfiles,
  teacherAvailabilitySlots,
  teacherPreferenceClassSections,
  teacherPreferenceSubmissions,
  teacherPreferenceSubjects,
  users,
} from "@shared/schema";
import { db } from "./db";
import {
  calculateTeacherSubjectCompatibility,
  teacherSubjectCompatibilityService,
} from "./teacher-subject-compatibility";

export const SCHEDULE_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type ScheduleWeekday = (typeof SCHEDULE_WEEKDAYS)[number];

const DEFAULT_TIME_SLOTS = [
  { label: "19:25 - 20:15", startsAt: "19:25", endsAt: "20:15", sequence: 1, isBreak: false },
  { label: "20:15 - 21:05", startsAt: "20:15", endsAt: "21:05", sequence: 2, isBreak: false },
  { label: "21:05 - 21:20", startsAt: "21:05", endsAt: "21:20", sequence: 3, isBreak: true },
  { label: "21:20 - 22:10", startsAt: "21:20", endsAt: "22:10", sequence: 4, isBreak: false },
  { label: "22:10 - 23:00", startsAt: "22:10", endsAt: "23:00", sequence: 5, isBreak: false },
] as const;

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number => Number.isInteger(value))));
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function buildTimeSlotSet(startSequence: number, spanSlots: number) {
  return Array.from({ length: spanSlots }, (_, index) => startSequence + index);
}

function overlapBySequence(
  leftStart: number,
  leftSpan: number,
  rightStart: number,
  rightSpan: number,
) {
  const leftEnd = leftStart + leftSpan - 1;
  const rightEnd = rightStart + rightSpan - 1;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

type ScheduleConflictType =
  | "teacher"
  | "class_section"
  | "location"
  | "capacity"
  | "location_kind"
  | "availability"
  | "integrity"
  | "coordinator";

type ScheduleConflictSeverity = "hard" | "soft";

export interface ScheduleConflict {
  scheduleEntryId?: number | null;
  conflictType: ScheduleConflictType;
  severity: ScheduleConflictSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduleEntryInput {
  assignmentId: number;
  weekday: ScheduleWeekday;
  timeSlotId: number;
  spanSlots: number;
  locationId: number;
}

async function getOrCreateActiveAcademicTerm() {
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

async function ensureDefaultTimeSlots() {
  const existing = await db.select().from(scheduleTimeSlots).orderBy(asc(scheduleTimeSlots.sequence));
  if (existing.length > 0) return existing;

  await db.insert(scheduleTimeSlots).values(DEFAULT_TIME_SLOTS.map((slot) => ({ ...slot })));
  return db.select().from(scheduleTimeSlots).orderBy(asc(scheduleTimeSlots.sequence));
}

async function getLatestPublication(academicTermId: number) {
  const [latestPublication] = await db
    .select()
    .from(schedulePublications)
    .where(eq(schedulePublications.academicTermId, academicTermId))
    .orderBy(desc(schedulePublications.createdAt));

  return latestPublication;
}

export class TeachingAssignmentService {
  async ensureFoundationalData() {
    const activeTerm = await getOrCreateActiveAcademicTerm();
    const timeSlots = await ensureDefaultTimeSlots();
    return { activeTerm, timeSlots };
  }

  async upsertTeacherAssignmentProfile(input: {
    teacherId: number;
    careerTrack?: string;
    priorityOrder?: number;
    weeklyLoadTargetHours?: number;
    notes?: string;
  }) {
    const [teacher] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, input.teacherId));

    if (!teacher) {
      throw new Error("Professor nao encontrado");
    }

    if (teacher.role !== "teacher") {
      throw new Error("Professor invalido");
    }

    const [profile] = await db
      .insert(teacherAssignmentProfiles)
      .values({
        teacherId: input.teacherId,
        careerTrack: input.careerTrack ?? null,
        priorityOrder: input.priorityOrder ?? 100,
        weeklyLoadTargetHours: input.weeklyLoadTargetHours ?? 0,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: teacherAssignmentProfiles.teacherId,
        set: {
          careerTrack: input.careerTrack ?? null,
          priorityOrder: input.priorityOrder ?? 100,
          weeklyLoadTargetHours: input.weeklyLoadTargetHours ?? 0,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return profile;
  }

  async upsertLocationCategory(input: {
    id?: number;
    name: string;
    kind: "classroom" | "laboratory";
    maxCapacity: number;
    quantity: number;
    unitPrefix: string;
    defaultEquipment?: string;
  }) {
    if (input.quantity <= 0) {
      throw new Error("Quantidade de locais invalida");
    }

    let categoryId = input.id;

    if (categoryId) {
      await db
        .update(locationCategories)
        .set({
          name: input.name,
          kind: input.kind,
          maxCapacity: input.maxCapacity,
          quantity: input.quantity,
          unitPrefix: input.unitPrefix,
          defaultEquipment: input.defaultEquipment ?? null,
          updatedAt: new Date(),
        })
        .where(eq(locationCategories.id, categoryId));
    } else {
      const [created] = await db
        .insert(locationCategories)
        .values({
          name: input.name,
          kind: input.kind,
          maxCapacity: input.maxCapacity,
          quantity: input.quantity,
          unitPrefix: input.unitPrefix,
          defaultEquipment: input.defaultEquipment ?? null,
        })
        .returning();
      categoryId = created.id;
    }

    return this.syncLocationUnits(categoryId);
  }

  async syncLocationUnits(categoryId: number) {
    const [category] = await db
      .select()
      .from(locationCategories)
      .where(eq(locationCategories.id, categoryId));

    if (!category) {
      throw new Error("Categoria de local nao encontrada");
    }

    const existingUnits = await db
      .select()
      .from(locations)
      .where(eq(locations.categoryId, categoryId))
      .orderBy(asc(locations.id));

    for (let index = 0; index < category.quantity; index += 1) {
      const name = `${category.unitPrefix} ${index + 1}`;
      const existing = existingUnits[index];

      if (existing) {
        await db
          .update(locations)
          .set({
            name,
            kind: category.kind,
            maxCapacity: category.maxCapacity,
            equipment: category.defaultEquipment ?? null,
            isActive: true,
          })
          .where(eq(locations.id, existing.id));
      } else {
        await db.insert(locations).values({
          categoryId: category.id,
          name,
          kind: category.kind,
          maxCapacity: category.maxCapacity,
          equipment: category.defaultEquipment ?? null,
          isActive: true,
        });
      }
    }

    const unitsToDisable = existingUnits.slice(category.quantity);
    for (const unit of unitsToDisable) {
      await db
        .update(locations)
        .set({ isActive: false })
        .where(eq(locations.id, unit.id));
    }

    return db
      .select()
      .from(locations)
      .where(eq(locations.categoryId, categoryId))
      .orderBy(asc(locations.name));
  }

  async upsertAssignment(input: {
    id?: number;
    classSectionId: number;
    subjectId: number;
    teacherId: number;
    weeklySlotTarget: number;
    notes?: string;
    coordinatorTeacherId?: number | null;
    createdByUserId: number;
  }) {
    const [classSection, subject, teacher] = await Promise.all([
      db
        .select({
          id: classSections.id,
          courseId: classSections.courseId,
          coordinatorTeacherId: classSections.coordinatorTeacherId,
        })
        .from(classSections)
        .where(eq(classSections.id, input.classSectionId))
        .then((rows) => rows[0]),
      db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.id, input.subjectId))
        .then((rows) => rows[0]),
      db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.teacherId))
        .then((rows) => rows[0]),
    ]);

    if (!classSection) throw new Error("Turma nao encontrada");
    if (!subject) throw new Error("Materia nao encontrada");
    if (!teacher || teacher.role !== "teacher") throw new Error("Professor invalido");

    const [curriculumLink] = await db
      .select({ subjectId: courseSubjects.subjectId })
      .from(courseSubjects)
      .where(and(eq(courseSubjects.courseId, classSection.courseId), eq(courseSubjects.subjectId, input.subjectId)));

    if (!curriculumLink) {
      throw new Error("Materia nao pertence a grade curricular da turma");
    }

    const payload = {
      classSectionId: input.classSectionId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      weeklySlotTarget: input.weeklySlotTarget,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId,
      updatedAt: new Date(),
    };

    const [assignment] = input.id
      ? await db
          .update(classSectionSubjectAssignments)
          .set(payload)
          .where(eq(classSectionSubjectAssignments.id, input.id))
          .returning()
      : await db.insert(classSectionSubjectAssignments).values(payload).returning();

    if (input.coordinatorTeacherId !== undefined) {
      await db
        .update(classSections)
        .set({ coordinatorTeacherId: input.coordinatorTeacherId })
        .where(eq(classSections.id, input.classSectionId));
    }

    const [hydrated] = await db
      .select({
        id: classSectionSubjectAssignments.id,
        classSectionId: classSectionSubjectAssignments.classSectionId,
        classSectionName: classSections.name,
        classSectionCode: classSections.code,
        courseName: courses.name,
        subjectId: classSectionSubjectAssignments.subjectId,
        subjectName: subjects.name,
        teacherId: classSectionSubjectAssignments.teacherId,
        teacherName: users.name,
        weeklySlotTarget: classSectionSubjectAssignments.weeklySlotTarget,
        notes: classSectionSubjectAssignments.notes,
      })
      .from(classSectionSubjectAssignments)
      .innerJoin(classSections, eq(classSections.id, classSectionSubjectAssignments.classSectionId))
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .innerJoin(subjects, eq(subjects.id, classSectionSubjectAssignments.subjectId))
      .innerJoin(users, eq(users.id, classSectionSubjectAssignments.teacherId))
      .where(eq(classSectionSubjectAssignments.id, assignment.id));

    return hydrated;
  }

  private async getScheduleEntriesForTerm(academicTermId: number, draftOnly = false) {
    return db
      .select({
        id: classScheduleEntries.id,
        classSectionId: classScheduleEntries.classSectionId,
        classSectionName: classSections.name,
        classSectionCode: classSections.code,
        courseId: courses.id,
        courseName: courses.name,
        subjectId: classScheduleEntries.subjectId,
        subjectName: subjects.name,
        teacherId: classScheduleEntries.teacherId,
        teacherName: users.name,
        assignmentId: classScheduleEntries.assignmentId,
        weekday: classScheduleEntries.weekday,
        timeSlotId: classScheduleEntries.timeSlotId,
        spanSlots: classScheduleEntries.spanSlots,
        locationId: classScheduleEntries.locationId,
        locationName: locations.name,
        locationKind: locations.kind,
        publicationId: classScheduleEntries.publicationId,
        publicationCreatedAt: schedulePublications.createdAt,
        timeSlotLabel: scheduleTimeSlots.label,
        startsAt: scheduleTimeSlots.startsAt,
        endsAt: scheduleTimeSlots.endsAt,
        sequence: scheduleTimeSlots.sequence,
        isBreak: scheduleTimeSlots.isBreak,
      })
      .from(classScheduleEntries)
      .innerJoin(classSections, eq(classSections.id, classScheduleEntries.classSectionId))
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .innerJoin(subjects, eq(subjects.id, classScheduleEntries.subjectId))
      .innerJoin(users, eq(users.id, classScheduleEntries.teacherId))
      .innerJoin(locations, eq(locations.id, classScheduleEntries.locationId))
      .innerJoin(scheduleTimeSlots, eq(scheduleTimeSlots.id, classScheduleEntries.timeSlotId))
      .leftJoin(schedulePublications, eq(schedulePublications.id, classScheduleEntries.publicationId))
      .where(
        and(
          eq(classSections.academicTermId, academicTermId),
          draftOnly ? isNull(classScheduleEntries.publicationId) : undefined,
        ),
      )
      .orderBy(asc(scheduleTimeSlots.sequence), asc(classScheduleEntries.weekday), asc(classSections.name));
  }

  async validateScheduleEntry(
    input: ScheduleEntryInput & { excludeEntryId?: number },
  ): Promise<{ assignment: Awaited<ReturnType<TeachingAssignmentService["upsertAssignment"]>> | null; conflicts: ScheduleConflict[] }> {
    await ensureDefaultTimeSlots();
    const [assignment, timeSlots, location] = await Promise.all([
      db
        .select({
          id: classSectionSubjectAssignments.id,
          classSectionId: classSectionSubjectAssignments.classSectionId,
          subjectId: classSectionSubjectAssignments.subjectId,
          teacherId: classSectionSubjectAssignments.teacherId,
          classSectionCode: classSections.code,
          classSectionName: classSections.name,
          academicTermId: classSections.academicTermId,
          subjectName: subjects.name,
          requiredLocationKind: subjects.requiredLocationKind,
          requiredEquipment: subjects.requiredEquipment,
          weeklySlotTarget: classSectionSubjectAssignments.weeklySlotTarget,
          teacherName: users.name,
        })
        .from(classSectionSubjectAssignments)
        .innerJoin(classSections, eq(classSections.id, classSectionSubjectAssignments.classSectionId))
        .innerJoin(subjects, eq(subjects.id, classSectionSubjectAssignments.subjectId))
        .innerJoin(users, eq(users.id, classSectionSubjectAssignments.teacherId))
        .where(eq(classSectionSubjectAssignments.id, input.assignmentId))
        .then((rows) => rows[0]),
      db.select().from(scheduleTimeSlots).orderBy(asc(scheduleTimeSlots.sequence)),
      db.select().from(locations).where(eq(locations.id, input.locationId)).then((rows) => rows[0]),
    ]);

    if (!assignment) throw new Error("Atribuicao nao encontrada");
    if (!location || !location.isActive) throw new Error("Local invalido");

    const selectedSlot = timeSlots.find((slot) => slot.id === input.timeSlotId);
    if (!selectedSlot) throw new Error("Bloco de horario nao encontrado");
    if (selectedSlot.isBreak) throw new Error("Intervalos nao podem receber aulas");

    const coveredSequences = buildTimeSlotSet(selectedSlot.sequence, input.spanSlots);
    const maxSequence = Math.max(...timeSlots.map((slot) => slot.sequence));
    if (coveredSequences.some((sequence) => sequence > maxSequence)) {
      throw new Error("Duracao de aula ultrapassa os blocos disponiveis");
    }

    const affectedTimeSlots = timeSlots.filter((slot) => coveredSequences.includes(slot.sequence));
    if (affectedTimeSlots.some((slot) => slot.isBreak)) {
      throw new Error("A aula nao pode atravessar um bloco de intervalo");
    }

    const activeStudentCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classSectionId, assignment.classSectionId),
          inArray(enrollments.status, ["active", "locked"]),
        ),
      );
    const studentCount = activeStudentCountRows[0]?.count ?? 0;

    const conflicts: ScheduleConflict[] = [];

    if (location.maxCapacity < studentCount) {
      conflicts.push({
        conflictType: "capacity",
        severity: "hard",
        message: `Local ${location.name} suporta ${location.maxCapacity} alunos, abaixo da turma (${studentCount}).`,
        metadata: { locationId: location.id, studentCount, capacity: location.maxCapacity },
      });
    }

    if (assignment.requiredLocationKind && assignment.requiredLocationKind !== location.kind) {
      conflicts.push({
        conflictType: "location_kind",
        severity: "hard",
        message: `Materia exige local do tipo ${assignment.requiredLocationKind}, mas o local selecionado e ${location.kind}.`,
        metadata: { requiredLocationKind: assignment.requiredLocationKind, actualLocationKind: location.kind },
      });
    }

    if (
      assignment.requiredEquipment &&
      !normalizeText(location.equipment).includes(normalizeText(assignment.requiredEquipment))
    ) {
      conflicts.push({
        conflictType: "location_kind",
        severity: "hard",
        message: `Local nao atende ao equipamento exigido pela materia.`,
        metadata: { requiredEquipment: assignment.requiredEquipment, locationEquipment: location.equipment },
      });
    }

    const availabilityRows = await db
      .select()
      .from(teacherAvailabilitySlots)
      .where(
        and(
          eq(teacherAvailabilitySlots.teacherId, assignment.teacherId),
          eq(teacherAvailabilitySlots.weekday, input.weekday),
          inArray(
            teacherAvailabilitySlots.timeSlotId,
            affectedTimeSlots.map((slot) => slot.id),
          ),
        ),
      );

    if (availabilityRows.some((row) => row.isAvailable === false)) {
      conflicts.push({
        conflictType: "availability",
        severity: "hard",
        message: `Professor possui indisponibilidade cadastrada para este horario.`,
        metadata: { teacherId: assignment.teacherId, weekday: input.weekday },
      });
    }

    const existingEntries = await this.getScheduleEntriesForTerm(assignment.academicTermId, true);
    for (const entry of existingEntries) {
      if (input.excludeEntryId && entry.id === input.excludeEntryId) continue;
      if (entry.weekday !== input.weekday) continue;
      if (!overlapBySequence(selectedSlot.sequence, input.spanSlots, entry.sequence, entry.spanSlots)) continue;

      if (entry.teacherId === assignment.teacherId) {
        conflicts.push({
          scheduleEntryId: entry.id,
          conflictType: "teacher",
          severity: "hard",
          message: `Professor ${assignment.teacherName} ja esta alocado neste horario.`,
          metadata: { conflictingEntryId: entry.id, teacherId: assignment.teacherId },
        });
      }

      if (entry.classSectionId === assignment.classSectionId) {
        conflicts.push({
          scheduleEntryId: entry.id,
          conflictType: "class_section",
          severity: "hard",
          message: `Turma ${assignment.classSectionCode} ja possui aula neste horario.`,
          metadata: { conflictingEntryId: entry.id, classSectionId: assignment.classSectionId },
        });
      }

      if (entry.locationId === input.locationId) {
        conflicts.push({
          scheduleEntryId: entry.id,
          conflictType: "location",
          severity: "hard",
          message: `Local ${location.name} ja esta ocupado neste horario.`,
          metadata: { conflictingEntryId: entry.id, locationId: input.locationId },
        });
      }
    }

    return { assignment: null, conflicts };
  }

  async createScheduleEntry(input: ScheduleEntryInput & { createdByUserId: number }) {
    const validation = await this.validateScheduleEntry(input);
    const hardConflicts = validation.conflicts.filter((conflict) => conflict.severity === "hard");
    if (hardConflicts.length > 0) {
      const error = new Error(hardConflicts[0].message);
      (error as Error & { conflicts?: ScheduleConflict[] }).conflicts = validation.conflicts;
      throw error;
    }

    const [assignment] = await db
      .select()
      .from(classSectionSubjectAssignments)
      .where(eq(classSectionSubjectAssignments.id, input.assignmentId));

    if (!assignment) throw new Error("Atribuicao nao encontrada");

    const [created] = await db
      .insert(classScheduleEntries)
      .values({
        classSectionId: assignment.classSectionId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        assignmentId: assignment.id,
        weekday: input.weekday,
        timeSlotId: input.timeSlotId,
        spanSlots: input.spanSlots,
        locationId: input.locationId,
        createdByUserId: input.createdByUserId,
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async deleteScheduleEntry(entryId: number) {
    await db.delete(classScheduleEntries).where(eq(classScheduleEntries.id, entryId));
  }

  async validateDraftSchedule(triggeredByUserId: number) {
    const { activeTerm } = await this.ensureFoundationalData();
    const entries = await this.getScheduleEntriesForTerm(activeTerm.id, true);

    const [assignments, classSectionRows] = await Promise.all([
      db
        .select({
          id: classSectionSubjectAssignments.id,
          classSectionId: classSectionSubjectAssignments.classSectionId,
          subjectId: classSectionSubjectAssignments.subjectId,
          weeklySlotTarget: classSectionSubjectAssignments.weeklySlotTarget,
          classSectionCode: classSections.code,
          subjectName: subjects.name,
          teacherName: users.name,
        })
        .from(classSectionSubjectAssignments)
        .innerJoin(classSections, eq(classSections.id, classSectionSubjectAssignments.classSectionId))
        .innerJoin(subjects, eq(subjects.id, classSectionSubjectAssignments.subjectId))
        .innerJoin(users, eq(users.id, classSectionSubjectAssignments.teacherId))
        .where(eq(classSections.academicTermId, activeTerm.id)),
      db
        .select({
          id: classSections.id,
          code: classSections.code,
          coordinatorTeacherId: classSections.coordinatorTeacherId,
        })
        .from(classSections)
        .where(eq(classSections.academicTermId, activeTerm.id)),
    ]);

    const slotCountByAssignment = new Map<number, number>();
    const conflicts: ScheduleConflict[] = [];

    for (const entry of entries) {
      if (entry.publicationId) continue;

      if (entry.assignmentId) {
        const existingCount = slotCountByAssignment.get(entry.assignmentId) ?? 0;
        slotCountByAssignment.set(entry.assignmentId, existingCount + entry.spanSlots);
      }
    }

    for (let index = 0; index < entries.length; index += 1) {
      const left = entries[index];
      for (let innerIndex = index + 1; innerIndex < entries.length; innerIndex += 1) {
        const right = entries[innerIndex];
        if (left.weekday !== right.weekday) continue;
        if (!overlapBySequence(left.sequence, left.spanSlots, right.sequence, right.spanSlots)) continue;

        if (left.teacherId === right.teacherId) {
          conflicts.push({
            scheduleEntryId: left.id,
            conflictType: "teacher",
            severity: "hard",
            message: `Professor ${left.teacherName} em conflito entre ${left.classSectionCode} e ${right.classSectionCode}.`,
          });
        }

        if (left.classSectionId === right.classSectionId) {
          conflicts.push({
            scheduleEntryId: left.id,
            conflictType: "class_section",
            severity: "hard",
            message: `Turma ${left.classSectionCode} possui duas aulas no mesmo horario.`,
          });
        }

        if (left.locationId === right.locationId) {
          conflicts.push({
            scheduleEntryId: left.id,
            conflictType: "location",
            severity: "hard",
            message: `Local ${left.locationName} foi duplicado no mesmo horario.`,
          });
        }
      }
    }

    for (const assignment of assignments) {
      const matchingEntries = entries.filter((entry) => entry.classSectionId === assignment.classSectionId && entry.subjectId === assignment.subjectId);
      const allocatedSlots = matchingEntries.reduce((sum, entry) => sum + entry.spanSlots, 0);

      if (allocatedSlots < assignment.weeklySlotTarget) {
        conflicts.push({
          conflictType: "integrity",
          severity: "hard",
          message: `Atribuicao ${assignment.subjectName} / ${assignment.classSectionCode} possui ${allocatedSlots} blocos de ${assignment.weeklySlotTarget} necessarios.`,
          metadata: { assignmentId: assignment.id, allocatedSlots, weeklySlotTarget: assignment.weeklySlotTarget },
        });
      }

      const sameDayGroups = new Map<string, number>();
      for (const entry of matchingEntries) {
        sameDayGroups.set(entry.weekday, (sameDayGroups.get(entry.weekday) ?? 0) + entry.spanSlots);
      }

      for (const [weekday, count] of Array.from(sameDayGroups.entries())) {
        if (count >= assignment.weeklySlotTarget && assignment.weeklySlotTarget > 1) {
          conflicts.push({
            conflictType: "integrity",
            severity: "soft",
            message: `Materia ${assignment.subjectName} ficou concentrada em ${weekday}.`,
            metadata: { assignmentId: assignment.id, weekday, allocatedSlots: count },
          });
        }
      }
    }

    for (const classSection of classSectionRows) {
      if (!classSection.coordinatorTeacherId) {
        conflicts.push({
          conflictType: "coordinator",
          severity: "hard",
          message: `Turma ${classSection.code} esta sem coordenador ativo.`,
          metadata: { classSectionId: classSection.id },
        });
      }
    }

    const [run] = await db
      .insert(scheduleGenerationRuns)
      .values({
        academicTermId: activeTerm.id,
        triggeredByUserId,
        status: conflicts.some((conflict) => conflict.severity === "hard") ? "failed" : "validated",
        summary: {
          hardConflictCount: conflicts.filter((conflict) => conflict.severity === "hard").length,
          softConflictCount: conflicts.filter((conflict) => conflict.severity === "soft").length,
        },
      })
      .returning();

    await db.delete(classSlotConflicts).where(eq(classSlotConflicts.generationRunId, run.id));
    if (conflicts.length > 0) {
      await db.insert(classSlotConflicts).values(
        conflicts.map((conflict) => ({
          generationRunId: run.id,
          scheduleEntryId: conflict.scheduleEntryId ?? null,
          conflictType: conflict.conflictType,
          severity: conflict.severity,
          message: conflict.message,
          metadata: conflict.metadata ?? {},
        })),
      );
    }

    return {
      runId: run.id,
      status: run.status,
      hardConflictCount: conflicts.filter((conflict) => conflict.severity === "hard").length,
      softConflictCount: conflicts.filter((conflict) => conflict.severity === "soft").length,
      conflicts,
    };
  }

  async publishDraftSchedule(input: { notes?: string; publishedByUserId: number }) {
    const { activeTerm } = await this.ensureFoundationalData();
    const validation = await this.validateDraftSchedule(input.publishedByUserId);

    if (validation.hardConflictCount > 0) {
      throw new Error("Existem conflitos obrigatorios pendentes antes da publicacao");
    }

    const [publication] = await db
      .insert(schedulePublications)
      .values({
        academicTermId: activeTerm.id,
        generationRunId: validation.runId,
        publishedByUserId: input.publishedByUserId,
        notes: input.notes ?? null,
      })
      .returning();

    const classSectionIds = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(eq(classSections.academicTermId, activeTerm.id));

    await db
      .update(classScheduleEntries)
      .set({ publicationId: publication.id, updatedAt: new Date() })
      .where(
        and(
          isNull(classScheduleEntries.publicationId),
          inArray(
            classScheduleEntries.classSectionId,
            classSectionIds.map((row) => row.id),
          ),
        ),
      );

    await db
      .update(scheduleGenerationRuns)
      .set({ status: "published" })
      .where(eq(scheduleGenerationRuns.id, validation.runId));

    return publication;
  }

  async teacherHasOperationalAssignment(teacherId: number, classSectionId: number, subjectId: number) {
    const { activeTerm } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);
    if (!latestPublication) return false;

    const [entry] = await db
      .select({ id: classScheduleEntries.id })
      .from(classScheduleEntries)
      .where(
        and(
          eq(classScheduleEntries.teacherId, teacherId),
          eq(classScheduleEntries.classSectionId, classSectionId),
          eq(classScheduleEntries.subjectId, subjectId),
          eq(classScheduleEntries.publicationId, latestPublication.id),
        ),
      );

    return Boolean(entry);
  }

  async getTeacherOperationalSectionIds(teacherId: number) {
    const { activeTerm } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);
    if (!latestPublication) return [];

    const rows = await db
      .select({ classSectionId: classScheduleEntries.classSectionId })
      .from(classScheduleEntries)
      .where(
        and(
          eq(classScheduleEntries.teacherId, teacherId),
          eq(classScheduleEntries.publicationId, latestPublication.id),
        ),
      );

    return uniqueNumbers(rows.map((row) => row.classSectionId));
  }

  async getTeacherOperationalCourseIds(teacherId: number) {
    const sectionIds = await this.getTeacherOperationalSectionIds(teacherId);
    if (sectionIds.length === 0) return [];

    const rows = await db
      .select({ courseId: classSections.courseId })
      .from(classSections)
      .where(inArray(classSections.id, sectionIds));

    return uniqueNumbers(rows.map((row) => row.courseId));
  }

  async getTeacherClassSectionSubjectPairs(teacherId: number) {
    const { activeTerm } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);
    if (!latestPublication) return [];

    return db
      .select({
        classSectionId: classScheduleEntries.classSectionId,
        subjectId: classScheduleEntries.subjectId,
      })
      .from(classScheduleEntries)
      .where(
        and(
          eq(classScheduleEntries.teacherId, teacherId),
          eq(classScheduleEntries.publicationId, latestPublication.id),
        ),
      );
  }

  async upsertTeacherPreferences(input: {
    teacherId: number;
    notes?: string;
    subjectIds: number[];
    sectionPreferences: Array<{ subjectId: number; classSectionId: number; priority: number }>;
    availability: Array<{ weekday: ScheduleWeekday; timeSlotId: number; isAvailable: boolean }>;
  }) {
    const { activeTerm, timeSlots } = await this.ensureFoundationalData();

    const [teacher] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, input.teacherId));

    if (!teacher || teacher.role !== "teacher") {
      throw new Error("Professor invalido");
    }

    const [submission] = await db
      .insert(teacherPreferenceSubmissions)
      .values({
        teacherId: input.teacherId,
        academicTermId: activeTerm.id,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [teacherPreferenceSubmissions.teacherId, teacherPreferenceSubmissions.academicTermId],
        set: {
          notes: input.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db.delete(teacherPreferenceSubjects).where(eq(teacherPreferenceSubjects.submissionId, submission.id));
    await db
      .delete(teacherPreferenceClassSections)
      .where(eq(teacherPreferenceClassSections.submissionId, submission.id));
    await db
      .delete(teacherAvailabilitySlots)
      .where(eq(teacherAvailabilitySlots.teacherId, input.teacherId));

    if (input.subjectIds.length > 0) {
      await db.insert(teacherPreferenceSubjects).values(
        input.subjectIds.map((subjectId, index) => ({
          submissionId: submission.id,
          subjectId,
          priority: index + 1,
        })),
      );
    }

    if (input.sectionPreferences.length > 0) {
      await db.insert(teacherPreferenceClassSections).values(
        input.sectionPreferences.map((item) => ({
          submissionId: submission.id,
          subjectId: item.subjectId,
          classSectionId: item.classSectionId,
          priority: item.priority,
        })),
      );
    }

    const fullAvailability =
      input.availability.length > 0
        ? input.availability
        : SCHEDULE_WEEKDAYS.flatMap((weekday) =>
            timeSlots
              .filter((slot) => !slot.isBreak)
              .map((slot) => ({ weekday, timeSlotId: slot.id, isAvailable: true })),
          );

    await db.insert(teacherAvailabilitySlots).values(
      fullAvailability.map((item) => ({
        teacherId: input.teacherId,
        weekday: item.weekday,
        timeSlotId: item.timeSlotId,
        isAvailable: item.isAvailable,
      })),
    );

    return submission;
  }

  async getTeacherWorkspace(teacherId: number) {
    const { activeTerm, timeSlots } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);

    const [teacher, profile, subjectsList, classSectionRows, submission, publishedEntries, availabilityRows] =
      await Promise.all([
        db
          .select({ id: users.id, role: users.role, name: users.name })
          .from(users)
          .where(eq(users.id, teacherId))
          .then((rows) => rows[0]),
        db
          .select()
          .from(teacherAssignmentProfiles)
          .where(eq(teacherAssignmentProfiles.teacherId, teacherId))
          .then((rows) => rows[0]),
        db.select().from(subjects).orderBy(asc(subjects.name)),
        db
          .select({
            id: classSections.id,
            code: classSections.code,
            name: classSections.name,
            courseId: courses.id,
            courseName: courses.name,
          })
          .from(classSections)
          .innerJoin(courses, eq(courses.id, classSections.courseId))
          .where(eq(classSections.academicTermId, activeTerm.id)),
        db
          .select()
          .from(teacherPreferenceSubmissions)
          .where(
            and(
              eq(teacherPreferenceSubmissions.teacherId, teacherId),
              eq(teacherPreferenceSubmissions.academicTermId, activeTerm.id),
            ),
          )
          .then((rows) => rows[0]),
        latestPublication
          ? db
              .select({
                id: classScheduleEntries.id,
                classSectionId: classScheduleEntries.classSectionId,
                classSectionName: classSections.name,
                classSectionCode: classSections.code,
                courseId: courses.id,
                courseName: courses.name,
                subjectId: classScheduleEntries.subjectId,
                subjectName: subjects.name,
                teacherId: classScheduleEntries.teacherId,
                teacherName: users.name,
                weekday: classScheduleEntries.weekday,
                timeSlotId: classScheduleEntries.timeSlotId,
                timeSlotLabel: scheduleTimeSlots.label,
                startsAt: scheduleTimeSlots.startsAt,
                endsAt: scheduleTimeSlots.endsAt,
                spanSlots: classScheduleEntries.spanSlots,
                locationId: classScheduleEntries.locationId,
                locationName: locations.name,
                locationKind: locations.kind,
                publicationId: classScheduleEntries.publicationId,
              })
              .from(classScheduleEntries)
              .innerJoin(classSections, eq(classSections.id, classScheduleEntries.classSectionId))
              .innerJoin(courses, eq(courses.id, classSections.courseId))
              .innerJoin(subjects, eq(subjects.id, classScheduleEntries.subjectId))
              .innerJoin(users, eq(users.id, classScheduleEntries.teacherId))
              .innerJoin(scheduleTimeSlots, eq(scheduleTimeSlots.id, classScheduleEntries.timeSlotId))
              .innerJoin(locations, eq(locations.id, classScheduleEntries.locationId))
              .where(
                and(
                  eq(classScheduleEntries.teacherId, teacherId),
                  eq(classScheduleEntries.publicationId, latestPublication.id),
                ),
              )
              .orderBy(asc(scheduleTimeSlots.sequence))
          : Promise.resolve([]),
        db.select().from(teacherAvailabilitySlots).where(eq(teacherAvailabilitySlots.teacherId, teacherId)),
      ]);

    if (!teacher || teacher.role !== "teacher") {
      throw new Error("Professor invalido");
    }

    const [preferredSubjects, preferredSections] = submission
      ? await Promise.all([
          db.select().from(teacherPreferenceSubjects).where(eq(teacherPreferenceSubjects.submissionId, submission.id)),
          db
            .select()
            .from(teacherPreferenceClassSections)
            .where(eq(teacherPreferenceClassSections.submissionId, submission.id)),
        ])
      : [[], []];

    const eligibleSubjects = (
      await Promise.all(
        subjectsList.map((subject) =>
          teacherSubjectCompatibilityService.calculateForPair({
            teacherId,
            subjectId: subject.id,
          }),
        ),
      )
    )
      .filter((result) => result.finalScore > 0)
      .sort((left, right) => right.finalScore - left.finalScore);

    const assignedSlotCount = publishedEntries.reduce((sum, entry) => sum + entry.spanSlots, 0);
    const weeklyLoadTargetHours = profile?.weeklyLoadTargetHours ?? 0;

    return {
      activeTerm,
      timeSlots,
      weekdays: [...SCHEDULE_WEEKDAYS],
      teacher: {
        id: teacher.id,
        name: teacher.name,
        careerTrack: profile?.careerTrack ?? null,
        priorityOrder: profile?.priorityOrder ?? 100,
        weeklyLoadTargetHours,
        assignedSlotCount,
        remainingLoadHours: Math.max(0, weeklyLoadTargetHours - assignedSlotCount),
      },
      classSections: classSectionRows,
      eligibleSubjects,
      preferences: {
        submissionId: submission?.id ?? null,
        status: submission?.status ?? "draft",
        notes: submission?.notes ?? "",
        subjectIds: preferredSubjects.map((item) => item.subjectId),
        sectionPreferences: preferredSections.map((item) => ({
          subjectId: item.subjectId,
          classSectionId: item.classSectionId,
          priority: item.priority,
        })),
        availability: availabilityRows.map((item) => ({
          weekday: item.weekday,
          timeSlotId: item.timeSlotId,
          isAvailable: item.isAvailable,
        })),
      },
      publishedEntries,
      aiAssistance: {
        available: Boolean(process.env.GOOGLE_AI_API_KEY),
      },
    };
  }

  async getAdminWorkspace() {
    const { activeTerm, timeSlots } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);

    const [teachers, profiles, classSectionRows, assignmentRows, draftEntries, publishedEntries, categories, locationRows, latestRun] =
      await Promise.all([
        db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "teacher")).orderBy(asc(users.name)),
        db.select().from(teacherAssignmentProfiles),
        db
          .select({
            id: classSections.id,
            code: classSections.code,
            name: classSections.name,
            courseId: courses.id,
            courseName: courses.name,
            coordinatorTeacherId: classSections.coordinatorTeacherId,
            coordinatorTeacherName: users.name,
          })
          .from(classSections)
          .innerJoin(courses, eq(courses.id, classSections.courseId))
          .leftJoin(users, eq(users.id, classSections.coordinatorTeacherId))
          .where(eq(classSections.academicTermId, activeTerm.id))
          .orderBy(asc(courses.name), asc(classSections.name)),
        db
          .select({
            id: classSectionSubjectAssignments.id,
            classSectionId: classSectionSubjectAssignments.classSectionId,
            classSectionName: classSections.name,
            classSectionCode: classSections.code,
            courseName: courses.name,
            subjectId: classSectionSubjectAssignments.subjectId,
            subjectName: subjects.name,
            teacherId: classSectionSubjectAssignments.teacherId,
            teacherName: users.name,
            weeklySlotTarget: classSectionSubjectAssignments.weeklySlotTarget,
            notes: classSectionSubjectAssignments.notes,
          })
          .from(classSectionSubjectAssignments)
          .innerJoin(classSections, eq(classSections.id, classSectionSubjectAssignments.classSectionId))
          .innerJoin(courses, eq(courses.id, classSections.courseId))
          .innerJoin(subjects, eq(subjects.id, classSectionSubjectAssignments.subjectId))
          .innerJoin(users, eq(users.id, classSectionSubjectAssignments.teacherId))
          .where(eq(classSections.academicTermId, activeTerm.id)),
        this.getScheduleEntriesForTerm(activeTerm.id, true),
        latestPublication ? this.getScheduleEntriesForTerm(activeTerm.id, false).then((rows) => rows.filter((row) => row.publicationId === latestPublication.id)) : Promise.resolve([]),
        db.select().from(locationCategories).orderBy(asc(locationCategories.name)),
        db.select().from(locations).orderBy(asc(locations.name)),
        db.select().from(scheduleGenerationRuns).where(eq(scheduleGenerationRuns.academicTermId, activeTerm.id)).orderBy(desc(scheduleGenerationRuns.createdAt)).then((rows) => rows[0]),
      ]);

    const studentCounts = await db
      .select({
        classSectionId: enrollments.classSectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(
        and(
          inArray(
            enrollments.classSectionId,
            classSectionRows.map((row) => row.id),
          ),
          inArray(enrollments.status, ["active", "locked"]),
        ),
      )
      .groupBy(enrollments.classSectionId);

    const studentCountMap = new Map(studentCounts.map((row) => [row.classSectionId ?? 0, row.count]));
    const profileMap = new Map(profiles.map((profile) => [profile.teacherId, profile]));
    const assignedByTeacher = new Map<number, number>();
    for (const entry of draftEntries) {
      assignedByTeacher.set(entry.teacherId, (assignedByTeacher.get(entry.teacherId) ?? 0) + entry.spanSlots);
    }

    return {
      activeTerm,
      timeSlots,
      weekdays: [...SCHEDULE_WEEKDAYS],
      teachers: teachers.map((teacher) => {
        const profile = profileMap.get(teacher.id);
        const assignedSlotCount = assignedByTeacher.get(teacher.id) ?? 0;
        const weeklyLoadTargetHours = profile?.weeklyLoadTargetHours ?? 0;
        return {
          id: teacher.id,
          name: teacher.name,
          careerTrack: profile?.careerTrack ?? null,
          priorityOrder: profile?.priorityOrder ?? 100,
          weeklyLoadTargetHours,
          assignedSlotCount,
          remainingLoadHours: Math.max(0, weeklyLoadTargetHours - assignedSlotCount),
        };
      }),
      classSections: classSectionRows.map((row) => ({
        ...row,
        studentCount: studentCountMap.get(row.id) ?? 0,
      })),
      subjects: await db.select().from(subjects).orderBy(asc(subjects.name)),
      assignments: assignmentRows,
      draftEntries,
      publishedEntries,
      locationCategories: categories,
      locations: locationRows.filter((location) => location.isActive),
      latestPublication,
      latestRun,
    };
  }

  async listAcademicRecords(classSectionId: number, subjectId: number, requester: { id: number; role: string }) {
    const [classSection, subject] = await Promise.all([
      db
        .select({
          id: classSections.id,
          name: classSections.name,
          code: classSections.code,
          courseId: courses.id,
          courseName: courses.name,
        })
        .from(classSections)
        .innerJoin(courses, eq(courses.id, classSections.courseId))
        .where(eq(classSections.id, classSectionId))
        .then((rows) => rows[0]),
      db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).then((rows) => rows[0]),
    ]);

    if (!classSection) throw new Error("Turma nao encontrada");
    if (!subject) throw new Error("Materia nao encontrada");

    if (requester.role === "teacher") {
      const allowed = await this.teacherHasOperationalAssignment(requester.id, classSectionId, subjectId);
      if (!allowed) {
        throw new Error("Professor nao possui atribuicao oficial publicada para esta turma/materia");
      }
    }

    const [gradeRows, attendanceRows, studentRows] = await Promise.all([
      db.select().from(gradeEntries).where(and(eq(gradeEntries.classSectionId, classSectionId), eq(gradeEntries.subjectId, subjectId))),
      db
        .select()
        .from(attendanceEntries)
        .where(and(eq(attendanceEntries.classSectionId, classSectionId), eq(attendanceEntries.subjectId, subjectId))),
      db
        .select({
          studentId: users.id,
          studentName: users.name,
          studentRa: users.ra,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.studentId))
        .where(
          and(
            eq(enrollments.classSectionId, classSectionId),
            inArray(enrollments.status, ["active", "locked"]),
          ),
        )
        .orderBy(asc(users.name)),
    ]);

    const gradeMap = new Map(gradeRows.map((row) => [row.studentId, row]));
    const attendanceMap = new Map(attendanceRows.map((row) => [row.studentId, row]));

    return {
      classSection,
      subject,
      canEdit: requester.role === "admin" || requester.role === "teacher",
      students: studentRows.map((student) => ({
        studentId: student.studentId,
        studentName: student.studentName,
        studentRa: student.studentRa,
        grade: gradeMap.get(student.studentId)?.grade ?? null,
        absences: attendanceMap.get(student.studentId)?.absences ?? 0,
      })),
    };
  }

  async upsertAcademicRecord(input: {
    requesterId: number;
    requesterRole: string;
    classSectionId: number;
    subjectId: number;
    studentId: number;
    grade?: number;
    absences?: number;
  }) {
    if (input.requesterRole === "teacher") {
      const allowed = await this.teacherHasOperationalAssignment(input.requesterId, input.classSectionId, input.subjectId);
      if (!allowed) {
        throw new Error("Professor nao possui atribuicao oficial publicada para lancar nota/falta");
      }
    }

    if (input.grade !== undefined) {
      await db
        .insert(gradeEntries)
        .values({
          classSectionId: input.classSectionId,
          subjectId: input.subjectId,
          studentId: input.studentId,
          teacherId: input.requesterId,
          grade: input.grade,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [gradeEntries.classSectionId, gradeEntries.subjectId, gradeEntries.studentId],
          set: {
            teacherId: input.requesterId,
            grade: input.grade,
            updatedAt: new Date(),
          },
        });
      }

    if (input.absences !== undefined) {
      await db
        .insert(attendanceEntries)
        .values({
          classSectionId: input.classSectionId,
          subjectId: input.subjectId,
          studentId: input.studentId,
          teacherId: input.requesterId,
          absences: input.absences,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [attendanceEntries.classSectionId, attendanceEntries.subjectId, attendanceEntries.studentId],
          set: {
            teacherId: input.requesterId,
            absences: input.absences,
            updatedAt: new Date(),
          },
        });
    }

    return this.listAcademicRecords(input.classSectionId, input.subjectId, {
      id: input.requesterId,
      role: input.requesterRole,
    });
  }

  async createMaterialBatch(input: {
    requesterId: number;
    subjectId: number;
    classSectionIds: number[];
    file: {
      originalName: string;
      internalName: string;
      storagePath: string;
      mimeType: string;
      sizeBytes: number;
    };
    issuedAt?: Date;
  }) {
    const uniqueSectionIds = uniqueNumbers(input.classSectionIds);
    if (uniqueSectionIds.length === 0) {
      throw new Error("Turma invalida para upload");
    }

    const sectionRows = await db
      .select({
        id: classSections.id,
        courseId: classSections.courseId,
      })
      .from(classSections)
      .where(inArray(classSections.id, uniqueSectionIds));

    for (const classSection of sectionRows) {
      const allowed = await this.teacherHasOperationalAssignment(input.requesterId, classSection.id, input.subjectId);
      if (!allowed) {
        throw new Error("Professor nao possui atribuicao oficial publicada para enviar material nesta turma/materia");
      }
    }

    const created = await db
      .insert(courseMaterials)
      .values(
        sectionRows.map((section) => ({
          originalName: input.file.originalName,
          internalName: input.file.internalName,
          storagePath: input.file.storagePath,
          mimeType: input.file.mimeType,
          sizeBytes: input.file.sizeBytes,
          authorId: input.requesterId,
          courseId: section.courseId,
          subjectId: input.subjectId,
          classSectionId: section.id,
          issuedAt: input.issuedAt ?? new Date(),
        })),
      )
      .returning();

    return created;
  }

  async getScheduleForUser(user: { id: number; role: string }) {
    const { activeTerm, timeSlots } = await this.ensureFoundationalData();
    const latestPublication = await getLatestPublication(activeTerm.id);
    if (!latestPublication) {
      return {
        activeTerm,
        timeSlots,
        weekdays: [...SCHEDULE_WEEKDAYS],
        entries: [],
      };
    }

    if (user.role === "teacher") {
      const entries = await this.getScheduleEntriesForTerm(activeTerm.id, false);
      return {
        activeTerm,
        timeSlots,
        weekdays: [...SCHEDULE_WEEKDAYS],
        entries: entries.filter((entry) => entry.publicationId === latestPublication.id && entry.teacherId === user.id),
      };
    }

    if (user.role === "student") {
      const [enrollment] = await db
        .select({ classSectionId: enrollments.classSectionId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, user.id),
            inArray(enrollments.status, ["active", "locked"]),
            sql`${enrollments.classSectionId} IS NOT NULL`,
          ),
        )
        .orderBy(desc(enrollments.createdAt));

      const entries = await this.getScheduleEntriesForTerm(activeTerm.id, false);
      return {
        activeTerm,
        timeSlots,
        weekdays: [...SCHEDULE_WEEKDAYS],
        entries: entries.filter(
          (entry) => entry.publicationId === latestPublication.id && entry.classSectionId === enrollment?.classSectionId,
        ),
      };
    }

    return {
      activeTerm,
      timeSlots,
      weekdays: [...SCHEDULE_WEEKDAYS],
      entries: [],
    };
  }

  async getOptionalAiEligibilitySuggestions(input: { teacherId: number; requestedByUserId: number }) {
    const workspace = await this.getTeacherWorkspace(input.teacherId);
    const deterministic = workspace.eligibleSubjects.slice(0, 8).map((item) => ({
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      finalScore: item.finalScore,
      compatibilityBand: item.compatibilityBand,
    }));

    if (!process.env.GOOGLE_AI_API_KEY) {
      return {
        aiAvailable: false,
        suggestions: [],
        deterministicFallback: deterministic,
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: JSON.stringify({
                    teacher: workspace.teacher,
                    deterministic,
                  }),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      return {
        aiAvailable: false,
        suggestions: [],
        deterministicFallback: deterministic,
      };
    }

    const payload = await response.json();
    const summary = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      aiAvailable: true,
      suggestions: summary ? [{ summary }] : [],
      deterministicFallback: deterministic,
    };
  }
}

export const teachingAssignmentService = new TeachingAssignmentService();
