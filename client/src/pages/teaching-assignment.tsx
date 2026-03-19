import { useEffect, useMemo, useState } from "react";
import { Bot, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useAcademicRecordSheet,
  useCreateScheduleEntry,
  useDeleteScheduleEntry,
  usePublishTeachingAssignments,
  useSaveLocationCategory,
  useSaveTeacherAssignmentProfile,
  useSaveTeacherPreferences,
  useSaveTeachingAssignment,
  useTeachingAssignmentAiAssist,
  useTeachingAssignmentsAdminWorkspace,
  useTeachingAssignmentsTeacherWorkspace,
  useUpsertAcademicRecord,
  useValidateTeachingAssignments,
} from "@/hooks/use-teaching-assignment";
import { AcademicWeeklySchedule } from "@/components/schedule/academic-weekly-schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
};

function formatCompatibilityBand(value: string) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baixa";
  return "Inapta";
}

function formatScheduleTitle(section?: { code: string; name: string; courseName: string } | null) {
  if (!section) {
    return {
      title: "Academic Weekly Schedule",
      subtitle: "Calendario semanal academico",
      sheetId: "SCHEDULE-DRAFT",
    };
  }

  return {
    title: "Academic Weekly Schedule",
    subtitle: `${section.courseName} | Turma: ${section.code} - ${section.name}`,
    sheetId: `${section.code}-${section.name}`.replace(/\s+/g, "-").toUpperCase(),
  };
}

export default function TeachingAssignmentPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const adminWorkspace = useTeachingAssignmentsAdminWorkspace(isAdmin);
  const teacherWorkspace = useTeachingAssignmentsTeacherWorkspace(isTeacher);
  const saveAssignment = useSaveTeachingAssignment();
  const saveLocationCategory = useSaveLocationCategory();
  const saveTeacherProfile = useSaveTeacherAssignmentProfile();
  const createScheduleEntry = useCreateScheduleEntry();
  const deleteScheduleEntry = useDeleteScheduleEntry();
  const validateSchedule = useValidateTeachingAssignments();
  const publishSchedule = usePublishTeachingAssignments();
  const saveTeacherPreferences = useSaveTeacherPreferences();
  const aiAssist = useTeachingAssignmentAiAssist();

  const [selectedSectionId, setSelectedSectionId] = useState<number | undefined>();
  const [validationState, setValidationState] = useState<Awaited<
    ReturnType<typeof validateSchedule.mutateAsync>
  > | null>(null);

  const [assignmentForm, setAssignmentForm] = useState({
    classSectionId: "",
    subjectId: "",
    teacherId: "",
    weeklySlotTarget: "2",
    coordinatorTeacherId: "",
    notes: "",
  });
  const [slotForm, setSlotForm] = useState({
    assignmentId: "",
    weekday: "monday" as Weekday,
    timeSlotId: "",
    spanSlots: "1",
    locationId: "",
  });
  const [locationForm, setLocationForm] = useState({
    name: "",
    kind: "classroom" as "classroom" | "laboratory",
    maxCapacity: "40",
    quantity: "1",
    unitPrefix: "Sala",
    defaultEquipment: "",
  });
  const [profileForm, setProfileForm] = useState({
    teacherId: "",
    careerTrack: "",
    priorityOrder: "100",
    weeklyLoadTargetHours: "0",
    notes: "",
  });

  const [teacherNotes, setTeacherNotes] = useState("");
  const [preferredSubjectIds, setPreferredSubjectIds] = useState<number[]>([]);
  const [preferredSectionPairs, setPreferredSectionPairs] = useState<Array<{ subjectId: number; classSectionId: number }>>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [recordSelectionKey, setRecordSelectionKey] = useState("");

  useEffect(() => {
    if (!adminWorkspace.data?.classSections.length) return;
    if (!selectedSectionId) {
      setSelectedSectionId(adminWorkspace.data.classSections[0].id);
    }
  }, [adminWorkspace.data, selectedSectionId]);

  useEffect(() => {
    if (!teacherWorkspace.data?.preferences) return;

    setTeacherNotes(teacherWorkspace.data.preferences.notes);
    setPreferredSubjectIds(teacherWorkspace.data.preferences.subjectIds);
    setPreferredSectionPairs(
      teacherWorkspace.data.preferences.sectionPreferences.map((item) => ({
        subjectId: item.subjectId,
        classSectionId: item.classSectionId,
      })),
    );

    const nextMap: Record<string, boolean> = {};
    for (const slot of teacherWorkspace.data.preferences.availability) {
      nextMap[`${slot.weekday}:${slot.timeSlotId}`] = slot.isAvailable;
    }
    setAvailabilityMap(nextMap);
  }, [teacherWorkspace.data]);

  const adminSelectedSection = useMemo(
    () => adminWorkspace.data?.classSections.find((section) => section.id === selectedSectionId) ?? null,
    [adminWorkspace.data, selectedSectionId],
  );

  const adminSectionEntries = useMemo(() => {
    if (!adminWorkspace.data || !selectedSectionId) return [];
    return adminWorkspace.data.draftEntries.filter((entry) => entry.classSectionId === selectedSectionId);
  }, [adminWorkspace.data, selectedSectionId]);

  const adminScheduleMeta = formatScheduleTitle(adminSelectedSection);

  const teacherSectionOptions = useMemo(() => {
    if (!teacherWorkspace.data) return [];

    return teacherWorkspace.data.classSections.filter((section) =>
      preferredSubjectIds.some((subjectId) =>
        teacherWorkspace.data.eligibleSubjects.some(
          (subject) => subject.subjectId === subjectId && subject.compatibilityBand !== "ineligible",
        ),
      ),
    );
  }, [teacherWorkspace.data, preferredSubjectIds]);

  const teacherRecordOptions = useMemo(() => {
    if (!teacherWorkspace.data) return [];

    const byKey = new Map<
      string,
      {
        classSectionId: number;
        classSectionName: string;
        classSectionCode: string;
        courseName: string;
        subjectId: number;
        subjectName: string;
      }
    >();

    for (const entry of teacherWorkspace.data.publishedEntries) {
      const key = `${entry.classSectionId}:${entry.subjectId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          classSectionId: entry.classSectionId,
          classSectionName: entry.classSectionName,
          classSectionCode: entry.classSectionCode,
          courseName: entry.courseName,
          subjectId: entry.subjectId,
          subjectName: entry.subjectName,
        });
      }
    }

    return Array.from(byKey.values()).sort((left, right) => {
      const courseDiff = left.courseName.localeCompare(right.courseName);
      if (courseDiff !== 0) return courseDiff;
      const classDiff = left.classSectionCode.localeCompare(right.classSectionCode);
      if (classDiff !== 0) return classDiff;
      return left.subjectName.localeCompare(right.subjectName);
    });
  }, [teacherWorkspace.data]);

  useEffect(() => {
    if (!teacherRecordOptions.length) {
      setRecordSelectionKey("");
      return;
    }

    if (!recordSelectionKey) {
      setRecordSelectionKey(`${teacherRecordOptions[0].classSectionId}:${teacherRecordOptions[0].subjectId}`);
    }
  }, [teacherRecordOptions, recordSelectionKey]);

  const selectedRecordOption = useMemo(
    () => teacherRecordOptions.find((item) => `${item.classSectionId}:${item.subjectId}` === recordSelectionKey),
    [teacherRecordOptions, recordSelectionKey],
  );

  const recordSheet = useAcademicRecordSheet(
    selectedRecordOption?.classSectionId,
    selectedRecordOption?.subjectId,
    Boolean(selectedRecordOption),
  );
  const saveAcademicRecord = useUpsertAcademicRecord(
    selectedRecordOption?.classSectionId,
    selectedRecordOption?.subjectId,
  );

  if (!user) return null;

  if (!isAdmin && !isTeacher) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atribuicao de Aulas</CardTitle>
          <CardDescription>Esta area e exclusiva para administradores e professores.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isLoading = (isAdmin && adminWorkspace.isLoading) || (isTeacher && teacherWorkspace.isLoading);
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const teacherPublishedSchedule = teacherWorkspace.data
    ? {
        title: "Academic Weekly Schedule",
        subtitle: `${teacherWorkspace.data.teacher.name} | Grade publicada`,
        semesterLabel: teacherWorkspace.data.activeTerm.name,
        timeSlots: teacherWorkspace.data.timeSlots,
        weekdays: teacherWorkspace.data.weekdays,
        entries: teacherWorkspace.data.publishedEntries,
        generatedAt: new Date().toLocaleDateString("pt-BR"),
        institutionLabel: "Academic Suite Official Data",
        sheetId: `TEACHER-${teacherWorkspace.data.teacher.id}-${teacherWorkspace.data.activeTerm.code}`,
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-4xl font-bold tracking-tight">Atribuicao de Aulas</h2>
        <p className="text-muted-foreground max-w-4xl">
          Ferramenta central para atribuir professor, materia, turma, horario, local, coordenacao por turma e
          publicar a grade oficial que habilita materiais, notas e faltas.
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? "admin" : "teacher"} className="space-y-6">
        <TabsList className="bg-white border border-border rounded-xl p-1">
          {isAdmin && (
            <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Administracao
            </TabsTrigger>
          )}
          {isTeacher && (
            <TabsTrigger value="teacher" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <GraduationCap className="mr-2 h-4 w-4" />
              Professor
            </TabsTrigger>
          )}
        </TabsList>

        {isAdmin && adminWorkspace.data && (
          <TabsContent value="admin" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Panorama administrativo</CardTitle>
                  <CardDescription>
                    Consolidacao por turma, prioridade docente, conflitos de horario, locais e publicacao final.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Professores</p>
                    <p className="mt-2 text-3xl font-bold">{adminWorkspace.data.teachers.length}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Turmas</p>
                    <p className="mt-2 text-3xl font-bold">{adminWorkspace.data.classSections.length}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atribuicoes</p>
                    <p className="mt-2 text-3xl font-bold">{adminWorkspace.data.assignments.length}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Slots em rascunho</p>
                    <p className="mt-2 text-3xl font-bold">{adminWorkspace.data.draftEntries.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Validacao e publicacao</CardTitle>
                  <CardDescription>
                    Hard constraints bloqueiam publicacao. Soft constraints aparecem como observacao auditavel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        validateSchedule.mutate(undefined, {
                          onSuccess: (payload) => setValidationState(payload),
                        });
                      }}
                      disabled={validateSchedule.isPending}
                    >
                      {validateSchedule.isPending ? "Validando..." : "Validar grade"}
                    </Button>
                    <Button
                      onClick={() => publishSchedule.mutate({ notes: "Publicacao administrativa da grade oficial" })}
                      disabled={publishSchedule.isPending || (validationState?.hardConflictCount ?? 0) > 0}
                    >
                      {publishSchedule.isPending ? "Publicando..." : "Publicar horarios"}
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                    <p>
                      Ultima execucao:{" "}
                      <strong>{adminWorkspace.data.latestRun?.status ?? "sem validacao ainda"}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      Ultima publicacao:{" "}
                      {adminWorkspace.data.latestPublication
                        ? new Date(adminWorkspace.data.latestPublication.createdAt).toLocaleString("pt-BR")
                        : "nao publicada"}
                    </p>
                  </div>

                  {validationState && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={validationState.hardConflictCount > 0 ? "destructive" : "secondary"}>
                          Hard: {validationState.hardConflictCount}
                        </Badge>
                        <Badge variant="outline">Soft: {validationState.softConflictCount}</Badge>
                      </div>
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {validationState.conflicts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum conflito encontrado.</p>
                        ) : (
                          validationState.conflicts.map((conflict, index) => (
                            <div key={`${conflict.conflictType}-${index}`} className="rounded-lg border p-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant={conflict.severity === "hard" ? "destructive" : "outline"}>
                                  {conflict.severity}
                                </Badge>
                                <span className="font-medium">{conflict.conflictType}</span>
                              </div>
                              <p className="mt-2 text-muted-foreground">{conflict.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Perfil docente e fila</CardTitle>
                  <CardDescription>Carreira, prioridade e carga semanal para ordenar a etapa de preferencia.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="profile-teacher">Professor</Label>
                    <select
                      id="profile-teacher"
                      value={profileForm.teacherId}
                      onChange={(event) => {
                        const teacher = adminWorkspace.data?.teachers.find((item) => item.id === Number(event.target.value));
                        setProfileForm({
                          teacherId: event.target.value,
                          careerTrack: teacher?.careerTrack ?? "",
                          priorityOrder: String(teacher?.priorityOrder ?? 100),
                          weeklyLoadTargetHours: String(teacher?.weeklyLoadTargetHours ?? 0),
                          notes: "",
                        });
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      {adminWorkspace.data.teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-track">Estrutura da carreira</Label>
                    <Input
                      id="career-track"
                      value={profileForm.careerTrack}
                      onChange={(event) => setProfileForm((current) => ({ ...current, careerTrack: event.target.value }))}
                      placeholder="Magisterio Superior, visitante, etc."
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority-order">Prioridade</Label>
                      <Input
                        id="priority-order"
                        type="number"
                        min={1}
                        value={profileForm.priorityOrder}
                        onChange={(event) => setProfileForm((current) => ({ ...current, priorityOrder: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekly-load">Carga semanal alvo</Label>
                      <Input
                        id="weekly-load"
                        type="number"
                        min={0}
                        value={profileForm.weeklyLoadTargetHours}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, weeklyLoadTargetHours: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-notes">Observacoes</Label>
                    <Textarea
                      id="profile-notes"
                      value={profileForm.notes}
                      onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      saveTeacherProfile.mutate({
                        teacherId: Number(profileForm.teacherId),
                        careerTrack: profileForm.careerTrack || undefined,
                        priorityOrder: Number(profileForm.priorityOrder),
                        weeklyLoadTargetHours: Number(profileForm.weeklyLoadTargetHours),
                        notes: profileForm.notes || undefined,
                      })
                    }
                    disabled={!profileForm.teacherId || saveTeacherProfile.isPending}
                  >
                    {saveTeacherProfile.isPending ? "Salvando..." : "Salvar perfil docente"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Categorias de local</CardTitle>
                  <CardDescription>Mapeie salas e laboratorios por capacidade, quantidade e equipamento base.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="location-name">Categoria</Label>
                    <Input
                      id="location-name"
                      value={locationForm.name}
                      onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Sala 100 max"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location-kind">Tipo</Label>
                      <select
                        id="location-kind"
                        value={locationForm.kind}
                        onChange={(event) =>
                          setLocationForm((current) => ({
                            ...current,
                            kind: event.target.value as "classroom" | "laboratory",
                          }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="classroom">Sala</option>
                        <option value="laboratory">Laboratorio</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-capacity">Capacidade maxima</Label>
                      <Input
                        id="location-capacity"
                        type="number"
                        min={1}
                        value={locationForm.maxCapacity}
                        onChange={(event) =>
                          setLocationForm((current) => ({ ...current, maxCapacity: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location-quantity">Quantidade</Label>
                      <Input
                        id="location-quantity"
                        type="number"
                        min={1}
                        value={locationForm.quantity}
                        onChange={(event) => setLocationForm((current) => ({ ...current, quantity: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-prefix">Prefixo das unidades</Label>
                      <Input
                        id="location-prefix"
                        value={locationForm.unitPrefix}
                        onChange={(event) =>
                          setLocationForm((current) => ({ ...current, unitPrefix: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location-equip">Equipamento base</Label>
                    <Input
                      id="location-equip"
                      value={locationForm.defaultEquipment}
                      onChange={(event) =>
                        setLocationForm((current) => ({ ...current, defaultEquipment: event.target.value }))
                      }
                      placeholder="Projetor, bancada, computadores..."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      saveLocationCategory.mutate({
                        name: locationForm.name,
                        kind: locationForm.kind,
                        maxCapacity: Number(locationForm.maxCapacity),
                        quantity: Number(locationForm.quantity),
                        unitPrefix: locationForm.unitPrefix,
                        defaultEquipment: locationForm.defaultEquipment || undefined,
                      })
                    }
                    disabled={!locationForm.name || saveLocationCategory.isPending}
                  >
                    {saveLocationCategory.isPending ? "Sincronizando..." : "Salvar categoria"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Professor por turma/materia</CardTitle>
                  <CardDescription>
                    A permissao operacional so nasce depois da atribuicao e da publicacao oficial do calendario.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="assignment-class">Turma</Label>
                    <select
                      id="assignment-class"
                      value={assignmentForm.classSectionId}
                      onChange={(event) => setAssignmentForm((current) => ({ ...current, classSectionId: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      {adminWorkspace.data.classSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.code} - {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignment-subject">Materia</Label>
                    <select
                      id="assignment-subject"
                      value={assignmentForm.subjectId}
                      onChange={(event) => setAssignmentForm((current) => ({ ...current, subjectId: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      {adminWorkspace.data.subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignment-teacher">Professor</Label>
                    <select
                      id="assignment-teacher"
                      value={assignmentForm.teacherId}
                      onChange={(event) => setAssignmentForm((current) => ({ ...current, teacherId: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      {adminWorkspace.data.teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="assignment-target">Blocos semanais</Label>
                      <Input
                        id="assignment-target"
                        type="number"
                        min={1}
                        value={assignmentForm.weeklySlotTarget}
                        onChange={(event) =>
                          setAssignmentForm((current) => ({ ...current, weeklySlotTarget: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignment-coordinator">Coordenador da turma</Label>
                      <select
                        id="assignment-coordinator"
                        value={assignmentForm.coordinatorTeacherId}
                        onChange={(event) =>
                          setAssignmentForm((current) => ({ ...current, coordinatorTeacherId: event.target.value }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Manter atual</option>
                        {adminWorkspace.data.teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignment-notes">Observacoes</Label>
                    <Textarea
                      id="assignment-notes"
                      value={assignmentForm.notes}
                      onChange={(event) => setAssignmentForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      saveAssignment.mutate({
                        classSectionId: Number(assignmentForm.classSectionId),
                        subjectId: Number(assignmentForm.subjectId),
                        teacherId: Number(assignmentForm.teacherId),
                        weeklySlotTarget: Number(assignmentForm.weeklySlotTarget),
                        coordinatorTeacherId: assignmentForm.coordinatorTeacherId
                          ? Number(assignmentForm.coordinatorTeacherId)
                          : null,
                        notes: assignmentForm.notes || undefined,
                      })
                    }
                    disabled={
                      !assignmentForm.classSectionId ||
                      !assignmentForm.subjectId ||
                      !assignmentForm.teacherId ||
                      saveAssignment.isPending
                    }
                  >
                    {saveAssignment.isPending ? "Salvando..." : "Salvar atribuicao"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Grade semanal por turma</CardTitle>
                  <CardDescription>
                    Estrutura semanal academica real, com merge por bloco e celulas vazias discretas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="space-y-2 min-w-[260px]">
                      <Label htmlFor="preview-class">Turma exibida</Label>
                      <select
                        id="preview-class"
                        value={selectedSectionId ?? ""}
                        onChange={(event) => setSelectedSectionId(Number(event.target.value))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {adminWorkspace.data.classSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.code} - {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Publicado: {adminWorkspace.data.publishedEntries.length}</Badge>
                      <Badge variant="secondary">Rascunho: {adminSectionEntries.length}</Badge>
                    </div>
                  </div>

                  <AcademicWeeklySchedule
                    title={adminScheduleMeta.title}
                    subtitle={adminScheduleMeta.subtitle}
                    semesterLabel={adminWorkspace.data.activeTerm.name}
                    timeSlots={adminWorkspace.data.timeSlots}
                    weekdays={adminWorkspace.data.weekdays}
                    entries={adminSectionEntries}
                    generatedAt={new Date().toLocaleDateString("pt-BR")}
                    institutionLabel="Academic Suite Official Data"
                    sheetId={adminScheduleMeta.sheetId}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Slots de aula</CardTitle>
                  <CardDescription>Crie o encontro oficial entre turma, materia, professor e local.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="slot-assignment">Atribuicao</Label>
                    <select
                      id="slot-assignment"
                      value={slotForm.assignmentId}
                      onChange={(event) => setSlotForm((current) => ({ ...current, assignmentId: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione</option>
                      {adminWorkspace.data.assignments.map((assignment) => (
                        <option key={assignment.id} value={assignment.id}>
                          {assignment.classSectionCode} | {assignment.subjectName} | {assignment.teacherName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="slot-weekday">Dia</Label>
                      <select
                        id="slot-weekday"
                        value={slotForm.weekday}
                        onChange={(event) =>
                          setSlotForm((current) => ({ ...current, weekday: event.target.value as Weekday }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {adminWorkspace.data.weekdays.map((weekday) => (
                          <option key={weekday} value={weekday}>
                            {WEEKDAY_LABELS[weekday]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-time">Bloco inicial</Label>
                      <select
                        id="slot-time"
                        value={slotForm.timeSlotId}
                        onChange={(event) => setSlotForm((current) => ({ ...current, timeSlotId: event.target.value }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Selecione</option>
                        {adminWorkspace.data.timeSlots
                          .filter((slot) => !slot.isBreak)
                          .map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="slot-span">Duracao em blocos</Label>
                      <Input
                        id="slot-span"
                        type="number"
                        min={1}
                        value={slotForm.spanSlots}
                        onChange={(event) => setSlotForm((current) => ({ ...current, spanSlots: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-location">Local</Label>
                      <select
                        id="slot-location"
                        value={slotForm.locationId}
                        onChange={(event) => setSlotForm((current) => ({ ...current, locationId: event.target.value }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Selecione</option>
                        {adminWorkspace.data.locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} ({location.kind})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      createScheduleEntry.mutate({
                        assignmentId: Number(slotForm.assignmentId),
                        weekday: slotForm.weekday,
                        timeSlotId: Number(slotForm.timeSlotId),
                        spanSlots: Number(slotForm.spanSlots),
                        locationId: Number(slotForm.locationId),
                      })
                    }
                    disabled={
                      !slotForm.assignmentId || !slotForm.timeSlotId || !slotForm.locationId || createScheduleEntry.isPending
                    }
                  >
                    {createScheduleEntry.isPending ? "Salvando..." : "Adicionar slot"}
                  </Button>

                  <div className="space-y-2">
                    {adminSectionEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum slot em rascunho para a turma selecionada.</p>
                    ) : (
                      adminSectionEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {entry.subjectName} | {entry.teacherName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {WEEKDAY_LABELS[entry.weekday]} | {entry.timeSlotLabel} | {entry.locationName}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => deleteScheduleEntry.mutate(entry.id)}
                            disabled={deleteScheduleEntry.isPending}
                          >
                            Remover
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
        {isTeacher && teacherWorkspace.data && (
          <TabsContent value="teacher" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Fila e carga semanal</CardTitle>
                  <CardDescription>
                    Transparencia da prioridade parametrizada e da carga atual ja ocupada na grade publicada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Professor</p>
                    <p className="mt-2 text-lg font-semibold">{teacherWorkspace.data.teacher.name}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Carreira</p>
                    <p className="mt-2 text-lg font-semibold">{teacherWorkspace.data.teacher.careerTrack || "Nao definida"}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prioridade</p>
                    <p className="mt-2 text-3xl font-bold">{teacherWorkspace.data.teacher.priorityOrder}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Carga restante</p>
                    <p className="mt-2 text-3xl font-bold">{teacherWorkspace.data.teacher.remainingLoadHours}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Apoio assistivo controlado</CardTitle>
                  <CardDescription>
                    A IA e apenas assistiva. O sistema continua usando validacoes deterministicas para decidir.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={teacherWorkspace.data.aiAssistance.available ? "secondary" : "outline"}>
                      {teacherWorkspace.data.aiAssistance.available ? "Google AI disponivel" : "Fallback deterministico ativo"}
                    </Badge>
                    <Badge variant="outline">Sem permissao automatica</Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => aiAssist.mutate(teacherWorkspace.data.teacher.id)}
                    disabled={aiAssist.isPending}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    {aiAssist.isPending ? "Consultando..." : "Gerar sugestao assistiva"}
                  </Button>
                  {aiAssist.data && (
                    <div className="space-y-2 rounded-xl border bg-slate-50 p-4 text-sm">
                      {aiAssist.data.suggestions.map((item, index) => (
                        <p key={index}>{item.summary}</p>
                      ))}
                      <div className="space-y-1">
                        {aiAssist.data.deterministicFallback.map((item) => (
                          <div key={item.subjectId} className="flex items-center justify-between gap-3">
                            <span>{item.subjectName}</span>
                            <Badge variant="outline">
                              {item.finalScore} / {formatCompatibilityBand(item.compatibilityBand)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Preferencias do professor</CardTitle>
                  <CardDescription>
                    Escolha materias, turmas desejadas e disponibilidade semanal. Isso registra preferencia, nao atribuicao final.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Materias elegiveis ranqueadas</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {teacherWorkspace.data.eligibleSubjects.slice(0, 8).map((subject) => {
                        const checked = preferredSubjectIds.includes(subject.subjectId);
                        return (
                          <label key={subject.subjectId} className="rounded-xl border p-4 text-sm cursor-pointer bg-white">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const nextChecked = Boolean(value);
                                  setPreferredSubjectIds((current) =>
                                    nextChecked
                                      ? current.includes(subject.subjectId)
                                        ? current
                                        : [...current, subject.subjectId]
                                      : current.filter((item) => item !== subject.subjectId),
                                  );
                                  if (!nextChecked) {
                                    setPreferredSectionPairs((current) =>
                                      current.filter((item) => item.subjectId !== subject.subjectId),
                                    );
                                  }
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{subject.subjectName}</p>
                                  <Badge variant="outline">{subject.finalScore}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Faixa: {formatCompatibilityBand(subject.compatibilityBand)}
                                </p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Turmas pretendidas</h3>
                    </div>
                    <div className="space-y-3">
                      {preferredSubjectIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Selecione ao menos uma materia para listar turmas pretendidas.</p>
                      ) : (
                        preferredSubjectIds.map((subjectId) => {
                          const subject = teacherWorkspace.data?.eligibleSubjects.find((item) => item.subjectId === subjectId);
                          if (!subject) return null;

                          return (
                            <div key={subjectId} className="rounded-xl border p-4">
                              <p className="font-medium">{subject.subjectName}</p>
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {teacherSectionOptions.map((section) => {
                                  const checked = preferredSectionPairs.some(
                                    (item) => item.subjectId === subjectId && item.classSectionId === section.id,
                                  );

                                  return (
                                    <label key={`${subjectId}-${section.id}`} className="flex items-start gap-3 rounded-lg border p-3">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) => {
                                          const nextChecked = Boolean(value);
                                          setPreferredSectionPairs((current) => {
                                            const exists = current.some(
                                              (item) => item.subjectId === subjectId && item.classSectionId === section.id,
                                            );
                                            if (nextChecked && !exists) {
                                              return [...current, { subjectId, classSectionId: section.id }];
                                            }
                                            if (!nextChecked) {
                                              return current.filter(
                                                (item) =>
                                                  !(item.subjectId === subjectId && item.classSectionId === section.id),
                                              );
                                            }
                                            return current;
                                          });
                                        }}
                                      />
                                      <div className="text-sm">
                                        <p className="font-medium">
                                          {section.code} - {section.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{section.courseName}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold">Disponibilidade semanal</h3>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="min-w-[760px] w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="border p-2 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Bloco
                            </th>
                            {teacherWorkspace.data.weekdays.map((weekday) => (
                              <th
                                key={weekday}
                                className="border p-2 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground"
                              >
                                {WEEKDAY_LABELS[weekday]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {teacherWorkspace.data.timeSlots
                            .filter((slot) => !slot.isBreak)
                            .map((timeSlot) => (
                              <tr key={timeSlot.id}>
                                <td className="border p-2 text-sm font-medium">{timeSlot.label}</td>
                                {teacherWorkspace.data.weekdays.map((weekday) => {
                                  const key = `${weekday}:${timeSlot.id}`;
                                  const checked = availabilityMap[key] ?? true;
                                  return (
                                    <td key={key} className="border p-2 text-center">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) =>
                                          setAvailabilityMap((current) => ({
                                            ...current,
                                            [key]: Boolean(value),
                                          }))
                                        }
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teacher-notes">Observacoes do professor</Label>
                    <Textarea
                      id="teacher-notes"
                      value={teacherNotes}
                      onChange={(event) => setTeacherNotes(event.target.value)}
                      placeholder="Preferencias de turno, restricoes pedagogicas, observacoes de disponibilidade..."
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() =>
                      saveTeacherPreferences.mutate({
                        notes: teacherNotes || undefined,
                        subjectIds: preferredSubjectIds,
                        sectionPreferences: preferredSectionPairs.map((item, index) => ({
                          subjectId: item.subjectId,
                          classSectionId: item.classSectionId,
                          priority: index + 1,
                        })),
                        availability: Object.entries(availabilityMap).map(([key, isAvailable]) => {
                          const [weekday, timeSlotId] = key.split(":");
                          return {
                            weekday: weekday as Weekday,
                            timeSlotId: Number(timeSlotId),
                            isAvailable,
                          };
                        }),
                      })
                    }
                    disabled={saveTeacherPreferences.isPending}
                  >
                    {saveTeacherPreferences.isPending ? "Salvando..." : "Salvar preferencias"}
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Grade oficial publicada</CardTitle>
                    <CardDescription>Esta e a fonte operacional para materiais, notas e faltas.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teacherPublishedSchedule && teacherPublishedSchedule.entries.length > 0 ? (
                      <AcademicWeeklySchedule
                        title={teacherPublishedSchedule.title}
                        subtitle={teacherPublishedSchedule.subtitle}
                        semesterLabel={teacherPublishedSchedule.semesterLabel}
                        timeSlots={teacherPublishedSchedule.timeSlots}
                        weekdays={teacherPublishedSchedule.weekdays}
                        entries={teacherPublishedSchedule.entries}
                        generatedAt={teacherPublishedSchedule.generatedAt}
                        institutionLabel={teacherPublishedSchedule.institutionLabel}
                        sheetId={teacherPublishedSchedule.sheetId}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ainda nao existe grade publicada vinculada ao seu usuario neste periodo.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Diario oficial por turma/materia</CardTitle>
                    <CardDescription>
                      O professor so consegue lancar nota e faltas quando existe slot oficial publicado para a combinacao.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="record-target">Turma e materia</Label>
                      <select
                        id="record-target"
                        value={recordSelectionKey}
                        onChange={(event) => setRecordSelectionKey(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Selecione</option>
                        {teacherRecordOptions.map((option) => (
                          <option key={`${option.classSectionId}:${option.subjectId}`} value={`${option.classSectionId}:${option.subjectId}`}>
                            {option.courseName} | {option.classSectionCode} | {option.subjectName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {recordSheet.isLoading ? (
                      <Skeleton className="h-56 w-full rounded-xl" />
                    ) : !recordSheet.data ? (
                      <p className="text-sm text-muted-foreground">Selecione uma turma/materia oficial para abrir o diario.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                          <p className="font-medium">
                            {recordSheet.data.classSection.courseName} | {recordSheet.data.classSection.code} - {recordSheet.data.classSection.name}
                          </p>
                          <p className="text-muted-foreground">Materia: {recordSheet.data.subject.name}</p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border">
                          <table className="w-full min-w-[720px] border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="border p-3 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">Aluno</th>
                                <th className="border p-3 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">R.A.</th>
                                <th className="border p-3 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">Nota</th>
                                <th className="border p-3 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">Faltas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recordSheet.data.students.map((student) => (
                                <tr key={student.studentId}>
                                  <td className="border p-3">{student.studentName}</td>
                                  <td className="border p-3">{student.studentRa}</td>
                                  <td className="border p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={10}
                                      step={0.1}
                                      defaultValue={student.grade ?? ""}
                                      disabled={!recordSheet.data?.canEdit || saveAcademicRecord.isPending}
                                      onBlur={(event) => {
                                        const value = event.target.value.trim();
                                        if (!value) return;
                                        saveAcademicRecord.mutate({
                                          studentId: student.studentId,
                                          grade: Number(value),
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="border p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={99}
                                      step={1}
                                      defaultValue={student.absences}
                                      disabled={!recordSheet.data?.canEdit || saveAcademicRecord.isPending}
                                      onBlur={(event) => {
                                        const value = event.target.value.trim();
                                        if (!value) return;
                                        saveAcademicRecord.mutate({
                                          studentId: student.studentId,
                                          absences: Number(value),
                                        });
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
