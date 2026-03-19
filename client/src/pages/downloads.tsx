import { useEffect, useMemo, useState } from "react";
import { Download, GripVertical, Paperclip, Pin, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMaterials, usePinMaterial, useUnpinMaterial, useUploadMaterial } from "@/hooks/use-materials";
import { useTeachingAssignmentsTeacherWorkspace } from "@/hooks/use-teaching-assignment";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function Downloads() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: materials, isLoading } = useMaterials();
  const teacherWorkspace = useTeachingAssignmentsTeacherWorkspace(user?.role === "teacher");

  const uploadMaterial = useUploadMaterial();
  const pinMaterial = usePinMaterial();
  const unpinMaterial = useUnpinMaterial();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [orderedMaterialIds, setOrderedMaterialIds] = useState<number[]>([]);
  const [hasManualOrder, setHasManualOrder] = useState(false);
  const [draggingMaterialId, setDraggingMaterialId] = useState<number | null>(null);

  const [uploadSubjectId, setUploadSubjectId] = useState<string>("");
  const [uploadClassSectionIds, setUploadClassSectionIds] = useState<number[]>([]);
  const [uploadIssuedAt, setUploadIssuedAt] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const materialList = (materials ?? []) as NonNullable<typeof materials>;

  const defaultSortedMaterials = useMemo(() => {
    return [...materialList].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const issuedA = new Date(a.issuedAt).getTime();
      const issuedB = new Date(b.issuedAt).getTime();
      if (issuedB !== issuedA) return issuedB - issuedA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [materialList]);

  useEffect(() => {
    const defaultIds = defaultSortedMaterials.map((item) => item.id);

    setOrderedMaterialIds((current) => {
      if (!hasManualOrder || current.length === 0) {
        return defaultIds;
      }

      const allowedIds = new Set(defaultIds);
      const merged = current.filter((id) => allowedIds.has(id));
      const missing = defaultIds.filter((id) => !merged.includes(id));
      return [...merged, ...missing];
    });
  }, [defaultSortedMaterials, hasManualOrder]);

  const materialMap = useMemo(() => {
    return new Map(materialList.map((item) => [item.id, item]));
  }, [materialList]);

  const orderedMaterials = useMemo(() => {
    return orderedMaterialIds
      .map((id) => materialMap.get(id))
      .filter((item): item is (typeof materialList)[number] => item !== undefined);
  }, [orderedMaterialIds, materialMap]);

  const visibleMaterials = useMemo(() => {
    if (selectedCourseId === "all") return orderedMaterials;
    const parsedCourseId = Number(selectedCourseId);
    return orderedMaterials.filter((item) => item.courseId === parsedCourseId);
  }, [orderedMaterials, selectedCourseId]);

  const courseOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const item of materialList) {
      byId.set(item.courseId, item.courseName || `Curso ${item.courseId}`);
    }

    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materialList]);

  const teacherUploadOptions = useMemo(() => {
    const entries = teacherWorkspace.data?.publishedEntries ?? [];
    const byKey = new Map<
      string,
      {
        subjectId: number;
        subjectName: string;
        classSectionId: number;
        classSectionName: string;
        classSectionCode: string;
        courseName: string;
      }
    >();

    for (const entry of entries) {
      const key = `${entry.subjectId}:${entry.classSectionId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          subjectId: entry.subjectId,
          subjectName: entry.subjectName,
          classSectionId: entry.classSectionId,
          classSectionName: entry.classSectionName,
          classSectionCode: entry.classSectionCode,
          courseName: entry.courseName,
        });
      }
    }

    return Array.from(byKey.values()).sort((left, right) => {
      const subjectDiff = left.subjectName.localeCompare(right.subjectName);
      if (subjectDiff !== 0) return subjectDiff;
      return left.classSectionCode.localeCompare(right.classSectionCode);
    });
  }, [teacherWorkspace.data]);

  const availableSubjects = useMemo(() => {
    const byId = new Map<number, string>();
    for (const item of teacherUploadOptions) {
      byId.set(item.subjectId, item.subjectName);
    }
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [teacherUploadOptions]);

  const availableSections = useMemo(() => {
    if (!uploadSubjectId) return [];
    return teacherUploadOptions.filter((item) => item.subjectId === Number(uploadSubjectId));
  }, [teacherUploadOptions, uploadSubjectId]);

  if (!user) return null;

  function restoreDefaultOrder() {
    setHasManualOrder(false);
    setOrderedMaterialIds(defaultSortedMaterials.map((item) => item.id));
  }

  function moveMaterial(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;

    setOrderedMaterialIds((current) => {
      const sourceIndex = current.indexOf(sourceId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });

    setHasManualOrder(true);
  }

  async function handleDownload(material: (typeof materialList)[number]) {
    try {
      const response = await fetch(material.downloadUrl, { credentials: "include" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Falha ao baixar material" }));
        throw new Error(payload.message || "Falha ao baixar material");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = material.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast({
        title: "Erro no download",
        description: error instanceof Error ? error.message : "Falha ao baixar material",
        variant: "destructive",
      });
    }
  }

  function togglePin(material: (typeof materialList)[number]) {
    if (material.isPinned) {
      unpinMaterial.mutate(material.id);
      return;
    }

    pinMaterial.mutate(material.id);
  }

  function submitUpload() {
    if (!uploadFile) {
      toast({ title: "Arquivo obrigatorio", description: "Selecione um arquivo para enviar.", variant: "destructive" });
      return;
    }

    if (!uploadSubjectId) {
      toast({ title: "Materia obrigatoria", description: "Selecione a materia oficial de destino.", variant: "destructive" });
      return;
    }

    if (uploadClassSectionIds.length === 0) {
      toast({ title: "Turma obrigatoria", description: "Selecione ao menos uma turma oficial.", variant: "destructive" });
      return;
    }

    uploadMaterial.mutate(
      {
        file: uploadFile,
        subjectId: Number(uploadSubjectId),
        classSectionIds: uploadClassSectionIds,
        issuedAt: uploadIssuedAt || undefined,
      },
      {
        onSuccess: () => {
          setUploadFile(null);
          setUploadSubjectId("");
          setUploadClassSectionIds([]);
          setUploadIssuedAt("");
        },
      },
    );
  }

  const pinnedVisibleCount = visibleMaterials.filter((item) => item.isPinned).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Materiais e Downloads</h2>
        <p className="text-muted-foreground mt-1">Downloads reais por curso/turma com permissao, fixacao pessoal e reorganizacao local.</p>
      </div>

      {user.role === "teacher" && (
        <Card>
          <CardHeader>
            <CardTitle>Enviar material</CardTitle>
            <CardDescription>Upload real apenas para turma e materia com atribuicao oficial publicada.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="upload-file">Arquivo</Label>
              <Input
                id="upload-file"
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">Tipos permitidos: PDF, Office, TXT, ZIP/RAR e imagens. Limite: 15 MB.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-subject">Materia</Label>
              <select
                id="upload-subject"
                value={uploadSubjectId}
                onChange={(event) => {
                  setUploadSubjectId(event.target.value);
                  setUploadClassSectionIds([]);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                {availableSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-issued-at">Data de emissao</Label>
              <Input
                id="upload-issued-at"
                type="datetime-local"
                value={uploadIssuedAt}
                onChange={(event) => setUploadIssuedAt(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Turmas oficiais</Label>
              {!uploadSubjectId ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Escolha a materia primeiro para listar somente as turmas oficialmente publicadas.
                </div>
              ) : availableSections.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhuma turma publicada encontrada para esta materia.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {availableSections.map((section) => {
                    const checked = uploadClassSectionIds.includes(section.classSectionId);
                    return (
                      <label key={section.classSectionId} className="flex items-start gap-3 rounded-lg border p-3 bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setUploadClassSectionIds((current) =>
                              event.target.checked
                                ? [...current, section.classSectionId]
                                : current.filter((id) => id !== section.classSectionId),
                            )
                          }
                          className="mt-1"
                        />
                        <div className="text-sm">
                          <p className="font-medium">
                            {section.classSectionCode} - {section.classSectionName}
                          </p>
                          <p className="text-xs text-muted-foreground">{section.courseName}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="md:col-span-4">
              <Button onClick={submitUpload} disabled={uploadMaterial.isPending}>
                <Upload className="w-4 h-4 mr-2" />
                {uploadMaterial.isPending ? "Enviando..." : "Enviar material"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Materiais disponiveis</CardTitle>
          <CardDescription>
            Ordem padrao: fixados pessoais primeiro, depois emissao mais recente. O drag and drop e apenas local da sessao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="space-y-1 min-w-[220px]">
              <Label htmlFor="course-filter">Filtrar por curso</Label>
              <select
                id="course-filter"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos os cursos</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:ml-auto flex items-end gap-2">
              <Button variant="outline" onClick={restoreDefaultOrder}>
                Restaurar ordem padrao
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Fixados visiveis: {pinnedVisibleCount}</p>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : visibleMaterials.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
              Nenhum material disponivel para o filtro selecionado.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleMaterials.map((material) => (
                <div
                  key={material.id}
                  draggable
                  onDragStart={() => setDraggingMaterialId(material.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingMaterialId === null) return;
                    moveMaterial(draggingMaterialId, material.id);
                    setDraggingMaterialId(null);
                  }}
                  onDragEnd={() => setDraggingMaterialId(null)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 bg-white",
                    material.isPinned && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <GripVertical className="w-4 h-4 mt-1 text-muted-foreground cursor-grab" aria-hidden="true" />
                    <Paperclip className="w-4 h-4 mt-1 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{material.originalName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {material.courseName || `Curso ${material.courseId}`}
                        {material.subjectName ? ` | ${material.subjectName}` : ""}
                        {material.classSectionName ? ` | ${material.classSectionName}` : ""}
                        {` | Emitido em ${new Date(material.issuedAt).toLocaleDateString("pt-BR")}`}
                        {` | ${(material.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={material.isPinned ? "Desfixar material" : "Fixar material"}
                      onClick={() => togglePin(material)}
                      disabled={pinMaterial.isPending || unpinMaterial.isPending}
                      className="h-9 w-9 rounded-full"
                    >
                      <Pin className={cn("w-4 h-4", material.isPinned ? "text-primary fill-primary" : "text-muted-foreground")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Baixar ${material.originalName}`}
                      onClick={() => handleDownload(material)}
                      className="h-9 w-9 rounded-full"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
