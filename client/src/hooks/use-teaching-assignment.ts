import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "./use-toast";

async function parseJsonResponse(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => ({ message: fallbackMessage }));
  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }
  return payload;
}

export function useTeachingAssignmentsAdminWorkspace(enabled = true) {
  return useQuery({
    queryKey: [api.teachingAssignments.adminWorkspace.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.teachingAssignments.adminWorkspace.path, { credentials: "include" });
      const payload = await parseJsonResponse(res, "Falha ao carregar atribuicao administrativa");
      return api.teachingAssignments.adminWorkspace.responses[200].parse(payload);
    },
  });
}

export function useTeachingAssignmentsTeacherWorkspace(enabled = true) {
  return useQuery({
    queryKey: [api.teachingAssignments.teacherWorkspace.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.teachingAssignments.teacherWorkspace.path, { credentials: "include" });
      const payload = await parseJsonResponse(res, "Falha ao carregar atribuicao do professor");
      return api.teachingAssignments.teacherWorkspace.responses[200].parse(payload);
    },
  });
}

export function useTeachingAssignmentsMySchedule(enabled = true) {
  return useQuery({
    queryKey: [api.teachingAssignments.mySchedule.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.teachingAssignments.mySchedule.path, { credentials: "include" });
      const payload = await parseJsonResponse(res, "Falha ao carregar calendario semanal");
      return api.teachingAssignments.mySchedule.responses[200].parse(payload);
    },
  });
}

export function useSaveTeacherPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: typeof api.teachingAssignments.teacherPreferences.input._type) => {
      const res = await fetch(api.teachingAssignments.teacherPreferences.path, {
        method: api.teachingAssignments.teacherPreferences.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar preferencias");
      return api.teachingAssignments.teacherPreferences.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.teacherWorkspace.path] });
      toast({ title: "Preferencias salvas", description: "Suas preferencias foram atualizadas." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar preferencias",
        description: error instanceof Error ? error.message : "Falha ao salvar preferencias",
        variant: "destructive",
      });
    },
  });
}

export function useSaveTeacherAssignmentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: typeof api.teachingAssignments.teacherProfile.input._type) => {
      const res = await fetch(api.teachingAssignments.teacherProfile.path, {
        method: api.teachingAssignments.teacherProfile.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar perfil docente");
      return api.teachingAssignments.teacherProfile.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.teacherWorkspace.path] });
      toast({ title: "Perfil salvo", description: "Parametros de carreira e carga atualizados." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar perfil",
        description: error instanceof Error ? error.message : "Falha ao salvar perfil",
        variant: "destructive",
      });
    },
  });
}

export function useSaveLocationCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { id?: number } & typeof api.teachingAssignments.locationCategories.create.input._type) => {
      const url = input.id
        ? buildUrl(api.teachingAssignments.locationCategories.update.path, { id: input.id })
        : api.teachingAssignments.locationCategories.create.path;
      const method = input.id
        ? api.teachingAssignments.locationCategories.update.method
        : api.teachingAssignments.locationCategories.create.method;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: input.name,
          kind: input.kind,
          maxCapacity: input.maxCapacity,
          quantity: input.quantity,
          unitPrefix: input.unitPrefix,
          defaultEquipment: input.defaultEquipment,
        }),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar categoria de local");
      return input.id
        ? api.teachingAssignments.locationCategories.update.responses[200].parse(payload)
        : api.teachingAssignments.locationCategories.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      toast({ title: "Locais atualizados", description: "Categoria e unidades sincronizadas." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar local",
        description: error instanceof Error ? error.message : "Falha ao salvar local",
        variant: "destructive",
      });
    },
  });
}

export function useSaveTeachingAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: typeof api.teachingAssignments.assignments.upsert.input._type) => {
      const res = await fetch(api.teachingAssignments.assignments.upsert.path, {
        method: api.teachingAssignments.assignments.upsert.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar atribuicao");
      return api.teachingAssignments.assignments.upsert.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      toast({ title: "Atribuicao salva", description: "Professor, materia e turma foram vinculados." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar atribuicao",
        description: error instanceof Error ? error.message : "Falha ao salvar atribuicao",
        variant: "destructive",
      });
    },
  });
}

export function useCreateScheduleEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: typeof api.teachingAssignments.scheduleEntries.create.input._type) => {
      const res = await fetch(api.teachingAssignments.scheduleEntries.create.path, {
        method: api.teachingAssignments.scheduleEntries.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar slot");
      return api.teachingAssignments.scheduleEntries.create.responses[201].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      toast({ title: "Slot salvo", description: "O horario foi adicionado ao rascunho." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar slot",
        description: error instanceof Error ? error.message : "Falha ao salvar slot",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteScheduleEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entryId: number) => {
      const url = buildUrl(api.teachingAssignments.scheduleEntries.remove.path, { id: entryId });
      const res = await fetch(url, {
        method: api.teachingAssignments.scheduleEntries.remove.method,
        credentials: "include",
      });
      const payload = await parseJsonResponse(res, "Falha ao remover slot");
      return api.teachingAssignments.scheduleEntries.remove.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      toast({ title: "Slot removido", description: "O horario saiu do rascunho." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover slot",
        description: error instanceof Error ? error.message : "Falha ao remover slot",
        variant: "destructive",
      });
    },
  });
}

export function useValidateTeachingAssignments() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.teachingAssignments.validate.path, {
        method: api.teachingAssignments.validate.method,
        credentials: "include",
      });
      const payload = await parseJsonResponse(res, "Falha ao validar grade horaria");
      return api.teachingAssignments.validate.responses[200].parse(payload);
    },
    onSuccess: (payload) => {
      toast({
        title: "Validacao concluida",
        description: `${payload.hardConflictCount} conflitos hard e ${payload.softConflictCount} observacoes soft.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao validar grade",
        description: error instanceof Error ? error.message : "Falha ao validar grade",
        variant: "destructive",
      });
    },
  });
}

export function usePublishTeachingAssignments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: typeof api.teachingAssignments.publish.input._type) => {
      const res = await fetch(api.teachingAssignments.publish.path, {
        method: api.teachingAssignments.publish.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse(res, "Falha ao publicar horarios");
      return api.teachingAssignments.publish.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.adminWorkspace.path] });
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.teacherWorkspace.path] });
      queryClient.invalidateQueries({ queryKey: [api.teachingAssignments.mySchedule.path] });
      toast({ title: "Horarios publicados", description: "A grade oficial foi publicada." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao publicar horarios",
        description: error instanceof Error ? error.message : "Falha ao publicar horarios",
        variant: "destructive",
      });
    },
  });
}

export function useTeachingAssignmentAiAssist() {
  return useMutation({
    mutationFn: async (teacherId: number) => {
      const res = await fetch(api.teachingAssignments.aiAssist.path, {
        method: api.teachingAssignments.aiAssist.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teacherId }),
      });
      const payload = await parseJsonResponse(res, "Falha ao consultar apoio assistivo");
      return api.teachingAssignments.aiAssist.responses[200].parse(payload);
    },
  });
}

export function useAcademicRecordSheet(classSectionId?: number, subjectId?: number, enabled = true) {
  return useQuery({
    queryKey: [api.academicRecords.list.path, classSectionId, subjectId],
    enabled: enabled && Boolean(classSectionId && subjectId),
    queryFn: async () => {
      const url = buildUrl(api.academicRecords.list.path, {
        classSectionId: classSectionId!,
        subjectId: subjectId!,
      });
      const res = await fetch(url, { credentials: "include" });
      const payload = await parseJsonResponse(res, "Falha ao carregar diario");
      return api.academicRecords.list.responses[200].parse(payload);
    },
  });
}

export function useUpsertAcademicRecord(classSectionId?: number, subjectId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { studentId: number; grade?: number; absences?: number }) => {
      if (!classSectionId || !subjectId) {
        throw new Error("Turma ou materia nao selecionada");
      }

      const url = buildUrl(api.academicRecords.upsert.path, {
        classSectionId,
        subjectId,
        studentId: input.studentId,
      });
      const res = await fetch(url, {
        method: api.academicRecords.upsert.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          grade: input.grade,
          absences: input.absences,
        }),
      });
      const payload = await parseJsonResponse(res, "Falha ao salvar diario");
      return api.academicRecords.upsert.responses[200].parse(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.academicRecords.list.path, classSectionId, subjectId] });
      toast({ title: "Diario atualizado", description: "Nota/faltas salvas com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar diario",
        description: error instanceof Error ? error.message : "Falha ao salvar diario",
        variant: "destructive",
      });
    },
  });
}
