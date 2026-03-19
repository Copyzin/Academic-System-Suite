import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  academicTerms,
  classSections,
  competencyTags,
  subjects,
  subjectCompetencies,
  teacherAcademicDegrees,
  teacherCompetencies,
  teacherProfessionalExperienceCompetencies,
  teacherProfessionalExperiences,
  teacherSubjectHistory,
  teacherSubjectManualOverrides,
  teacherSubjectMatchScores,
  users,
  type TeacherSubjectManualOverride,
} from "@shared/schema";
import { db } from "./db";

export const TEACHER_SUBJECT_COMPATIBILITY_ALGORITHM_VERSION = "teacher-subject-compatibility-v1";

export type CompatibilityBand = "high" | "medium" | "low" | "ineligible";
export type ManualOverrideAction = TeacherSubjectManualOverride["action"];
type RelationshipLevel = "exact" | "close" | "weak" | "none";

export interface CompatibilityTag {
  tagId?: number;
  key: string;
  label: string;
  weight: number;
  area?: string | null;
  subarea?: string | null;
}

export interface CompatibilityDegree {
  id: number;
  degreeLevel: "bachelor" | "specialization" | "master" | "doctorate";
  courseName: string;
  institution?: string | null;
  area?: string | null;
  subarea?: string | null;
  completedAt?: Date | null;
}

export interface CompatibilityHistoryEntry {
  id: number;
  subjectId: number;
  subjectName: string;
  area?: string | null;
  subarea?: string | null;
  taughtAt: Date;
  academicTermCode?: string | null;
  classSectionName?: string | null;
  competencies: CompatibilityTag[];
}

export interface CompatibilityExperience {
  id: number;
  companyName: string;
  roleName: string;
  description?: string | null;
  area?: string | null;
  subarea?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isCurrent: boolean;
  competencies: CompatibilityTag[];
}

export interface CompatibilityManualOverride {
  id: number;
  action: ManualOverrideAction;
  value: number;
  reason: string;
  createdAt: Date;
  createdByUserId?: number | null;
}

export interface TeacherSubjectCompatibilityCalculationInput {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  subjectDescription?: string | null;
  subjectArea?: string | null;
  subjectSubarea?: string | null;
  subjectCompetencies: CompatibilityTag[];
  degrees: CompatibilityDegree[];
  teacherCompetencies: CompatibilityTag[];
  teachingHistory: CompatibilityHistoryEntry[];
  professionalExperiences: CompatibilityExperience[];
  manualOverride?: CompatibilityManualOverride;
}

export interface TeacherSubjectCompatibilityResult {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  finalScore: number;
  compatibilityBand: CompatibilityBand;
  scoreDegree: number;
  scoreArea: number;
  scoreCompetency: number;
  scoreTeachingHistory: number;
  scoreProfessionalExperience: number;
  scoreManualAdjustment: number;
  algorithmVersion: string;
  blocked: boolean;
  explanation: Record<string, unknown>;
  calculatedAt: Date;
}

const DEGREE_BASE_SCORES: Record<CompatibilityDegree["degreeLevel"], number> = {
  doctorate: 25,
  master: 22,
  specialization: 16,
  bachelor: 14,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number) {
  return Math.round(value);
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value?: string | null) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function buildKeywordSet(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap((value) => tokenize(value)).filter(Boolean)));
}

function tokenOverlapRatio(left: Array<string>, right: Array<string>) {
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const overlap = Array.from(leftSet).reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);

  return overlap / Math.max(leftSet.size, rightSet.size);
}

function describeRelationship(
  candidate?: string | null,
  reference?: string | null,
): { level: RelationshipLevel; factor: number; overlap: number } {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedReference = normalizeText(reference);

  if (!normalizedCandidate || !normalizedReference) {
    return { level: "none", factor: 0, overlap: 0 };
  }

  if (normalizedCandidate === normalizedReference) {
    return { level: "exact", factor: 1, overlap: 1 };
  }

  if (normalizedCandidate.includes(normalizedReference) || normalizedReference.includes(normalizedCandidate)) {
    return { level: "close", factor: 0.7, overlap: 0.7 };
  }

  const overlap = tokenOverlapRatio(tokenize(normalizedCandidate), tokenize(normalizedReference));
  if (overlap >= 0.5) {
    return { level: "close", factor: 0.7, overlap };
  }

  if (overlap >= 0.25) {
    return { level: "weak", factor: 0.4, overlap };
  }

  return { level: "none", factor: 0, overlap };
}

function bestRelationship(
  candidates: Array<string | null | undefined>,
  references: Array<string | null | undefined>,
) {
  let best = { level: "none" as RelationshipLevel, factor: 0, overlap: 0, candidate: "", reference: "" };

  for (const candidate of candidates) {
    for (const reference of references) {
      const relationship = describeRelationship(candidate, reference);
      if (relationship.factor > best.factor || relationship.overlap > best.overlap) {
        best = {
          ...relationship,
          candidate: candidate ?? "",
          reference: reference ?? "",
        };
      }
    }
  }

  return best;
}

function monthsBetween(olderDate?: Date | null, newerDate = new Date()) {
  if (!olderDate) return Number.POSITIVE_INFINITY;
  const diffMs = newerDate.getTime() - olderDate.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.4375));
}

function getCompatibilityBand(score: number, blocked: boolean): CompatibilityBand {
  if (blocked || score <= 0) return "ineligible";
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function buildSubjectKeywords(input: TeacherSubjectCompatibilityCalculationInput) {
  return buildKeywordSet([
    input.subjectName,
    input.subjectDescription,
    input.subjectArea,
    input.subjectSubarea,
    ...input.subjectCompetencies.map((tag) => tag.label),
  ]);
}

function calculateDegreeScore(input: TeacherSubjectCompatibilityCalculationInput) {
  const subjectKeywords = buildSubjectKeywords(input);
  const subjectReferences = [input.subjectSubarea, input.subjectArea, input.subjectName, input.subjectDescription];
  let bestDegree:
    | {
        degree: CompatibilityDegree;
        score: number;
        relationship: ReturnType<typeof bestRelationship>;
      }
    | undefined;

  for (const degree of input.degrees) {
    const relationship = bestRelationship(
      [degree.subarea, degree.area, degree.courseName],
      [...subjectReferences, ...subjectKeywords],
    );
    const score = roundScore(DEGREE_BASE_SCORES[degree.degreeLevel] * relationship.factor);

    if (!bestDegree || score > bestDegree.score) {
      bestDegree = { degree, score, relationship };
    }
  }

  return {
    score: clamp(bestDegree?.score ?? 0, 0, 25),
    explanation: bestDegree
      ? {
          bestDegreeLevel: bestDegree.degree.degreeLevel,
          bestDegreeCourseName: bestDegree.degree.courseName,
          bestDegreeArea: bestDegree.degree.area ?? null,
          bestDegreeSubarea: bestDegree.degree.subarea ?? null,
          matchedBy: bestDegree.relationship.level,
          matchedCandidate: bestDegree.relationship.candidate || null,
          matchedReference: bestDegree.relationship.reference || null,
        }
      : {
          bestDegreeLevel: null,
          matchedBy: "none",
          note: "Professor sem formacao academica cadastrada para o algoritmo.",
        },
  };
}

function calculateAreaScore(input: TeacherSubjectCompatibilityCalculationInput) {
  const teacherAreas = Array.from(
    new Set(
      [
        ...input.degrees.flatMap((degree) => [degree.area, degree.subarea]),
        ...input.professionalExperiences.flatMap((experience) => [experience.area, experience.subarea]),
      ].filter((value): value is string => Boolean(normalizeText(value))),
    ),
  );

  const areaRelationship = bestRelationship(teacherAreas, [input.subjectArea]);
  const subareaRelationship = bestRelationship(teacherAreas, [input.subjectSubarea]);

  const areaScore =
    areaRelationship.level === "exact"
      ? 12
      : areaRelationship.level === "close"
        ? 8
        : areaRelationship.level === "weak"
          ? 4
          : 0;

  const subareaScore =
    subareaRelationship.level === "exact"
      ? 8
      : subareaRelationship.level === "close"
        ? 5
        : subareaRelationship.level === "weak"
          ? 2
          : 0;

  return {
    score: clamp(areaScore + subareaScore, 0, 20),
    explanation: {
      subjectArea: input.subjectArea ?? null,
      subjectSubarea: input.subjectSubarea ?? null,
      matchedTeacherAreas: teacherAreas,
      areaMatch: areaRelationship.level,
      subareaMatch: subareaRelationship.level,
      areaMatchedCandidate: areaRelationship.candidate || null,
      subareaMatchedCandidate: subareaRelationship.candidate || null,
      note:
        !input.subjectArea && !input.subjectSubarea
          ? "Materia sem area/subarea cadastrada; criterio perdeu poder discriminatorio."
          : undefined,
    },
  };
}

function calculateSubjectTagCoverage(
  subjectCompetencies: CompatibilityTag[],
  effectiveTeacherEvidence: Map<string, { evidence: number; sources: string[] }>,
) {
  const totalWeight = subjectCompetencies.reduce((sum, tag) => sum + tag.weight, 0);
  if (totalWeight <= 0) {
    return {
      score: 0,
      explanation: {
        matchedTags: [],
        missingTags: [],
        coverage: 0,
        note: "Materia sem competencias/tags cadastradas.",
      },
    };
  }

  let coveredWeight = 0;
  const matchedTags: Array<Record<string, unknown>> = [];
  const missingTags: string[] = [];

  for (const tag of subjectCompetencies) {
    const evidence = effectiveTeacherEvidence.get(tag.key);
    const factor = evidence?.evidence ?? 0;
    coveredWeight += tag.weight * factor;

    if (factor > 0) {
      matchedTags.push({
        key: tag.key,
        label: tag.label,
        subjectWeight: tag.weight,
        evidence: Number(factor.toFixed(2)),
        sources: evidence?.sources ?? [],
      });
    } else {
      missingTags.push(tag.label);
    }
  }

  const coverage = coveredWeight / totalWeight;
  return {
    score: clamp(roundScore(coverage * 20), 0, 20),
    explanation: {
      matchedTags,
      missingTags,
      coverage: Number(coverage.toFixed(3)),
      totalSubjectWeight: totalWeight,
    },
  };
}

function calculateSubjectRelatedness(
  target: Pick<TeacherSubjectCompatibilityCalculationInput, "subjectName" | "subjectArea" | "subjectSubarea" | "subjectCompetencies">,
  comparedSubject: Pick<CompatibilityHistoryEntry, "subjectName" | "area" | "subarea" | "competencies">,
) {
  const areaRelationship = describeRelationship(comparedSubject.area, target.subjectArea);
  const subareaRelationship = describeRelationship(comparedSubject.subarea, target.subjectSubarea);
  const nameRelationship = describeRelationship(comparedSubject.subjectName, target.subjectName);

  const targetTagWeights = new Map(target.subjectCompetencies.map((tag) => [tag.key, tag.weight]));
  const comparedKeys = new Set(comparedSubject.competencies.map((tag) => tag.key));
  const targetWeightTotal = Array.from(targetTagWeights.values()).reduce((sum, value) => sum + value, 0);
  const overlapWeight = Array.from(targetTagWeights.entries()).reduce(
    (sum, [key, weight]) => sum + (comparedKeys.has(key) ? weight : 0),
    0,
  );
  const competencyCoverage = targetWeightTotal > 0 ? overlapWeight / targetWeightTotal : 0;

  return Number(
    (
      areaRelationship.factor * 0.4 +
      subareaRelationship.factor * 0.2 +
      competencyCoverage * 0.3 +
      nameRelationship.factor * 0.1
    ).toFixed(3),
  );
}

function buildEffectiveTeacherCompetencies(input: TeacherSubjectCompatibilityCalculationInput) {
  const evidence = new Map<string, { evidence: number; sources: string[] }>();

  const pushEvidence = (tag: CompatibilityTag, source: string, factor: number) => {
    const existing = evidence.get(tag.key);
    const nextEvidence = Math.max(existing?.evidence ?? 0, clamp(factor, 0, 1));
    const nextSources = Array.from(new Set([...(existing?.sources ?? []), source]));
    evidence.set(tag.key, { evidence: nextEvidence, sources: nextSources });
  };

  for (const tag of input.teacherCompetencies) {
    pushEvidence(tag, "manual_competency", clamp(tag.weight / 5, 0.2, 1));
  }

  const now = new Date();
  for (const history of input.teachingHistory) {
    const monthsSince = monthsBetween(history.taughtAt, now);
    const recencyFactor = monthsSince <= 12 ? 0.7 : monthsSince <= 36 ? 0.55 : monthsSince <= 60 ? 0.4 : 0.25;
    for (const tag of history.competencies) {
      pushEvidence(tag, `teaching_history:${history.subjectName}`, recencyFactor);
    }
  }

  for (const experience of input.professionalExperiences) {
    const durationMonths = experience.isCurrent
      ? Math.max(12, monthsBetween(experience.startsAt ?? now, now))
      : experience.startsAt && experience.endsAt
        ? monthsBetween(experience.startsAt, experience.endsAt)
        : 0;
    const durationFactor = durationMonths >= 48 ? 0.7 : durationMonths >= 24 ? 0.6 : durationMonths >= 12 ? 0.5 : 0.35;
    for (const tag of experience.competencies) {
      pushEvidence(tag, `professional_experience:${experience.roleName}@${experience.companyName}`, durationFactor);
    }
  }

  return evidence;
}

function calculateTeachingHistoryScore(input: TeacherSubjectCompatibilityCalculationInput) {
  const exactHistory = input.teachingHistory.filter((entry) => entry.subjectId === input.subjectId);
  const now = new Date();

  if (exactHistory.length > 0) {
    const mostRecentExact = exactHistory
      .map((entry) => entry.taughtAt)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const monthsSince = monthsBetween(mostRecentExact, now);
    const recencyBonus = monthsSince <= 12 ? 3 : monthsSince <= 36 ? 2 : monthsSince <= 60 ? 1 : 0;
    const frequencyBonus = Math.min(5, Math.max(0, exactHistory.length - 1) * 2);
    const score = clamp(12 + frequencyBonus + recencyBonus, 0, 20);

    return {
      score,
      explanation: {
        exactSubjectCount: exactHistory.length,
        mostRecentExactTeachingAt: mostRecentExact,
        contributingSubjects: exactHistory.map((entry) => ({
          subjectName: entry.subjectName,
          taughtAt: entry.taughtAt,
          academicTermCode: entry.academicTermCode ?? null,
          classSectionName: entry.classSectionName ?? null,
        })),
        mode: "exact",
      },
    };
  }

  const similarHistory = input.teachingHistory
    .map((entry) => ({
      entry,
      relatedness: calculateSubjectRelatedness(input, entry),
    }))
    .filter((item) => item.relatedness >= 0.35)
    .sort((left, right) => right.relatedness - left.relatedness);

  if (similarHistory.length === 0) {
    return {
      score: 0,
      explanation: {
        mode: "none",
        note: "Professor sem historico docente relevante para a materia.",
      },
    };
  }

  const mostRecentSimilar = similarHistory
    .map((item) => item.entry.taughtAt)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const recencyBonus = monthsBetween(mostRecentSimilar, now) <= 24 ? 2 : 1;
  const frequencyBonus = Math.min(6, similarHistory.length * 2);
  const similarityBonus = Math.min(8, roundScore(similarHistory[0].relatedness * 8));
  const score = clamp(4 + frequencyBonus + recencyBonus + similarityBonus, 0, 20);

  return {
    score,
    explanation: {
      mode: "similar",
      similarSubjectCount: similarHistory.length,
      bestRelatedness: similarHistory[0].relatedness,
      contributingSubjects: similarHistory.slice(0, 5).map((item) => ({
        subjectName: item.entry.subjectName,
        relatedness: item.relatedness,
        taughtAt: item.entry.taughtAt,
      })),
    },
  };
}

function calculateProfessionalExperienceScore(input: TeacherSubjectCompatibilityCalculationInput) {
  const subjectTagWeightTotal = input.subjectCompetencies.reduce((sum, tag) => sum + tag.weight, 0);
  const evaluated = input.professionalExperiences.map((experience) => {
    const areaRelationship = describeRelationship(experience.area, input.subjectArea);
    const subareaRelationship = describeRelationship(experience.subarea, input.subjectSubarea);

    const coveredTagWeight = input.subjectCompetencies.reduce((sum, tag) => {
      return sum + (experience.competencies.some((experienceTag) => experienceTag.key === tag.key) ? tag.weight : 0);
    }, 0);
    const tagCoverage = subjectTagWeightTotal > 0 ? coveredTagWeight / subjectTagWeightTotal : 0;

    const durationMonths = experience.isCurrent
      ? Math.max(12, monthsBetween(experience.startsAt ?? new Date(), new Date()))
      : experience.startsAt && experience.endsAt
        ? monthsBetween(experience.startsAt, experience.endsAt)
        : 0;
    const durationScore = durationMonths >= 48 ? 1 : durationMonths >= 24 ? 0.7 : durationMonths >= 12 ? 0.4 : 0.2;

    const score = clamp(
      roundScore(
        (areaRelationship.level === "exact"
          ? 4
          : areaRelationship.level === "close"
            ? 3
            : areaRelationship.level === "weak"
              ? 1.5
              : 0) +
          (subareaRelationship.level === "exact"
            ? 2
            : subareaRelationship.level === "close"
              ? 1
              : subareaRelationship.level === "weak"
                ? 0.5
                : 0) +
          tagCoverage * 3 +
          durationScore,
      ),
      0,
      10,
    );

    return {
      experience,
      score,
      areaRelationship,
      subareaRelationship,
      tagCoverage: Number(tagCoverage.toFixed(3)),
      durationMonths: Number(durationMonths.toFixed(1)),
    };
  });

  const best = evaluated.sort((left, right) => right.score - left.score)[0];
  return {
    score: best?.score ?? 0,
    explanation: best
      ? {
          bestExperience: {
            companyName: best.experience.companyName,
            roleName: best.experience.roleName,
            area: best.experience.area ?? null,
            subarea: best.experience.subarea ?? null,
            isCurrent: best.experience.isCurrent,
            durationMonths: best.durationMonths,
          },
          areaMatch: best.areaRelationship.level,
          subareaMatch: best.subareaRelationship.level,
          tagCoverage: best.tagCoverage,
        }
      : {
          bestExperience: null,
          note: "Professor sem experiencia profissional aderente cadastrada.",
        },
  };
}

function applyManualAdjustment(
  baseScore: number,
  manualOverride?: CompatibilityManualOverride,
): {
  finalScore: number;
  scoreManualAdjustment: number;
  blocked: boolean;
  explanation: Record<string, unknown>;
} {
  if (!manualOverride) {
    return {
      finalScore: baseScore,
      scoreManualAdjustment: 0,
      blocked: false,
      explanation: {
        applied: false,
      },
    };
  }

  if (manualOverride.action === "block") {
    return {
      finalScore: 0,
      scoreManualAdjustment: 0,
      blocked: true,
      explanation: {
        applied: true,
        action: manualOverride.action,
        reason: manualOverride.reason,
        overrideId: manualOverride.id,
        createdAt: manualOverride.createdAt,
      },
    };
  }

  if (manualOverride.action === "force_eligible") {
    const finalScore = baseScore <= 0 ? 1 : baseScore;
    return {
      finalScore,
      scoreManualAdjustment: finalScore - baseScore,
      blocked: false,
      explanation: {
        applied: true,
        action: manualOverride.action,
        reason: manualOverride.reason,
        overrideId: manualOverride.id,
        createdAt: manualOverride.createdAt,
      },
    };
  }

  const boundedValue = clamp(manualOverride.value, 0, 5);
  const scoreManualAdjustment = manualOverride.action === "boost" ? boundedValue : -boundedValue;
  return {
    finalScore: clamp(baseScore + scoreManualAdjustment, 0, 100),
    scoreManualAdjustment,
    blocked: false,
    explanation: {
      applied: true,
      action: manualOverride.action,
      value: boundedValue,
      reason: manualOverride.reason,
      overrideId: manualOverride.id,
      createdAt: manualOverride.createdAt,
    },
  };
}

export function calculateTeacherSubjectCompatibility(
  input: TeacherSubjectCompatibilityCalculationInput,
): TeacherSubjectCompatibilityResult {
  const degree = calculateDegreeScore(input);
  const area = calculateAreaScore(input);
  const effectiveCompetencies = buildEffectiveTeacherCompetencies(input);
  const competency = calculateSubjectTagCoverage(input.subjectCompetencies, effectiveCompetencies);
  const teachingHistory = calculateTeachingHistoryScore(input);
  const professionalExperience = calculateProfessionalExperienceScore(input);

  const baseScore = clamp(
    degree.score + area.score + competency.score + teachingHistory.score + professionalExperience.score,
    0,
    100,
  );

  const manualAdjustment = applyManualAdjustment(baseScore, input.manualOverride);
  const finalScore = clamp(manualAdjustment.finalScore, 0, 100);
  const compatibilityBand = getCompatibilityBand(finalScore, manualAdjustment.blocked);

  return {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    finalScore,
    compatibilityBand,
    scoreDegree: degree.score,
    scoreArea: area.score,
    scoreCompetency: competency.score,
    scoreTeachingHistory: teachingHistory.score,
    scoreProfessionalExperience: professionalExperience.score,
    scoreManualAdjustment: manualAdjustment.scoreManualAdjustment,
    algorithmVersion: TEACHER_SUBJECT_COMPATIBILITY_ALGORITHM_VERSION,
    blocked: manualAdjustment.blocked,
    explanation: {
      degree: degree.explanation,
      area: area.explanation,
      competency: competency.explanation,
      teachingHistory: teachingHistory.explanation,
      professionalExperience: professionalExperience.explanation,
      manualOverride: manualAdjustment.explanation,
      scoreSummary: {
        baseScore,
        finalScore,
        compatibilityBand,
      },
    },
    calculatedAt: new Date(),
  };
}

function ensureTeacherExistsOrThrow(teacher: { id: number; role: string; name: string } | undefined) {
  if (!teacher) {
    throw new Error("Professor nao encontrado");
  }

  if (teacher.role !== "teacher") {
    throw new Error("Professor invalido");
  }
}

function ensureSubjectExistsOrThrow(subject: { id: number; name: string } | undefined) {
  if (!subject) {
    throw new Error("Materia nao encontrada");
  }
}

export class TeacherSubjectCompatibilityService {
  async calculateForPair(params: {
    teacherId: number;
    subjectId: number;
    persist?: boolean;
    calculatedByUserId?: number;
  }): Promise<TeacherSubjectCompatibilityResult> {
    const [teacher, subject] = await Promise.all([
      db
        .select({
          id: users.id,
          role: users.role,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, params.teacherId))
        .then((rows) => rows[0]),
      db
        .select({
          id: subjects.id,
          name: subjects.name,
          description: subjects.description,
          area: subjects.area,
          subarea: subjects.subarea,
        })
        .from(subjects)
        .where(eq(subjects.id, params.subjectId))
        .then((rows) => rows[0]),
    ]);

    ensureTeacherExistsOrThrow(teacher);
    ensureSubjectExistsOrThrow(subject);

    const [degreeRows, subjectTagRows, teacherTagRows, historyRows, experienceRows, activeOverride] =
      await Promise.all([
        db
          .select({
            id: teacherAcademicDegrees.id,
            degreeLevel: teacherAcademicDegrees.degreeLevel,
            courseName: teacherAcademicDegrees.courseName,
            institution: teacherAcademicDegrees.institution,
            area: teacherAcademicDegrees.area,
            subarea: teacherAcademicDegrees.subarea,
            completedAt: teacherAcademicDegrees.completedAt,
          })
          .from(teacherAcademicDegrees)
          .where(eq(teacherAcademicDegrees.teacherId, params.teacherId))
          .orderBy(desc(teacherAcademicDegrees.completedAt), desc(teacherAcademicDegrees.id)),
        db
          .select({
            tagId: subjectCompetencies.tagId,
            key: competencyTags.key,
            label: competencyTags.label,
            area: competencyTags.area,
            subarea: competencyTags.subarea,
            weight: subjectCompetencies.weight,
          })
          .from(subjectCompetencies)
          .innerJoin(competencyTags, eq(competencyTags.id, subjectCompetencies.tagId))
          .where(eq(subjectCompetencies.subjectId, params.subjectId))
          .orderBy(desc(subjectCompetencies.weight), competencyTags.label),
        db
          .select({
            tagId: teacherCompetencies.tagId,
            key: competencyTags.key,
            label: competencyTags.label,
            area: competencyTags.area,
            subarea: competencyTags.subarea,
            weight: teacherCompetencies.weight,
          })
          .from(teacherCompetencies)
          .innerJoin(competencyTags, eq(competencyTags.id, teacherCompetencies.tagId))
          .where(eq(teacherCompetencies.teacherId, params.teacherId))
          .orderBy(desc(teacherCompetencies.weight), competencyTags.label),
        db
          .select({
            id: teacherSubjectHistory.id,
            subjectId: teacherSubjectHistory.subjectId,
            subjectName: subjects.name,
            area: subjects.area,
            subarea: subjects.subarea,
            taughtAt: teacherSubjectHistory.taughtAt,
            academicTermCode: academicTerms.code,
            classSectionName: classSections.name,
          })
          .from(teacherSubjectHistory)
          .innerJoin(subjects, eq(subjects.id, teacherSubjectHistory.subjectId))
          .leftJoin(academicTerms, eq(academicTerms.id, teacherSubjectHistory.academicTermId))
          .leftJoin(classSections, eq(classSections.id, teacherSubjectHistory.classSectionId))
          .where(eq(teacherSubjectHistory.teacherId, params.teacherId))
          .orderBy(desc(teacherSubjectHistory.taughtAt)),
        db
          .select({
            id: teacherProfessionalExperiences.id,
            companyName: teacherProfessionalExperiences.companyName,
            roleName: teacherProfessionalExperiences.roleName,
            description: teacherProfessionalExperiences.description,
            area: teacherProfessionalExperiences.area,
            subarea: teacherProfessionalExperiences.subarea,
            startsAt: teacherProfessionalExperiences.startsAt,
            endsAt: teacherProfessionalExperiences.endsAt,
            isCurrent: teacherProfessionalExperiences.isCurrent,
          })
          .from(teacherProfessionalExperiences)
          .where(eq(teacherProfessionalExperiences.teacherId, params.teacherId))
          .orderBy(desc(teacherProfessionalExperiences.isCurrent), desc(teacherProfessionalExperiences.endsAt)),
        db
          .select()
          .from(teacherSubjectManualOverrides)
          .where(
            and(
              eq(teacherSubjectManualOverrides.teacherId, params.teacherId),
              eq(teacherSubjectManualOverrides.subjectId, params.subjectId),
              isNull(teacherSubjectManualOverrides.revokedAt),
            ),
          )
          .orderBy(desc(teacherSubjectManualOverrides.createdAt), desc(teacherSubjectManualOverrides.id))
          .then((rows) => rows[0]),
      ]);

    const historySubjectIds = Array.from(new Set(historyRows.map((row) => row.subjectId)));
    const experienceIds = experienceRows.map((row) => row.id);

    const [historySubjectTagRows, experienceTagRows] = await Promise.all([
      historySubjectIds.length > 0
        ? db
            .select({
              subjectId: subjectCompetencies.subjectId,
              tagId: subjectCompetencies.tagId,
              key: competencyTags.key,
              label: competencyTags.label,
              area: competencyTags.area,
              subarea: competencyTags.subarea,
              weight: subjectCompetencies.weight,
            })
            .from(subjectCompetencies)
            .innerJoin(competencyTags, eq(competencyTags.id, subjectCompetencies.tagId))
            .where(inArray(subjectCompetencies.subjectId, historySubjectIds))
        : Promise.resolve([]),
      experienceIds.length > 0
        ? db
            .select({
              experienceId: teacherProfessionalExperienceCompetencies.experienceId,
              tagId: teacherProfessionalExperienceCompetencies.tagId,
              key: competencyTags.key,
              label: competencyTags.label,
              area: competencyTags.area,
              subarea: competencyTags.subarea,
            })
            .from(teacherProfessionalExperienceCompetencies)
            .innerJoin(
              competencyTags,
              eq(competencyTags.id, teacherProfessionalExperienceCompetencies.tagId),
            )
            .where(inArray(teacherProfessionalExperienceCompetencies.experienceId, experienceIds))
        : Promise.resolve([]),
    ]);

    const historyTagsBySubject = new Map<number, CompatibilityTag[]>();
    for (const row of historySubjectTagRows) {
      const tags = historyTagsBySubject.get(row.subjectId) ?? [];
      tags.push({
        tagId: row.tagId,
        key: row.key,
        label: row.label,
        area: row.area,
        subarea: row.subarea,
        weight: row.weight,
      });
      historyTagsBySubject.set(row.subjectId, tags);
    }

    const experienceTagsByExperience = new Map<number, CompatibilityTag[]>();
    for (const row of experienceTagRows) {
      const tags = experienceTagsByExperience.get(row.experienceId) ?? [];
      tags.push({
        tagId: row.tagId,
        key: row.key,
        label: row.label,
        area: row.area,
        subarea: row.subarea,
        weight: 1,
      });
      experienceTagsByExperience.set(row.experienceId, tags);
    }

    const result = calculateTeacherSubjectCompatibility({
      teacherId: teacher.id,
      teacherName: teacher.name,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectDescription: subject.description,
      subjectArea: subject.area,
      subjectSubarea: subject.subarea,
      subjectCompetencies: subjectTagRows.map((row) => ({
        tagId: row.tagId,
        key: row.key,
        label: row.label,
        area: row.area,
        subarea: row.subarea,
        weight: row.weight,
      })),
      degrees: degreeRows.map((row) => ({
        id: row.id,
        degreeLevel: row.degreeLevel,
        courseName: row.courseName,
        institution: row.institution,
        area: row.area,
        subarea: row.subarea,
        completedAt: row.completedAt,
      })),
      teacherCompetencies: teacherTagRows.map((row) => ({
        tagId: row.tagId,
        key: row.key,
        label: row.label,
        area: row.area,
        subarea: row.subarea,
        weight: row.weight,
      })),
      teachingHistory: historyRows.map((row) => ({
        id: row.id,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        area: row.area,
        subarea: row.subarea,
        taughtAt: row.taughtAt,
        academicTermCode: row.academicTermCode,
        classSectionName: row.classSectionName,
        competencies: historyTagsBySubject.get(row.subjectId) ?? [],
      })),
      professionalExperiences: experienceRows.map((row) => ({
        id: row.id,
        companyName: row.companyName,
        roleName: row.roleName,
        description: row.description,
        area: row.area,
        subarea: row.subarea,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        isCurrent: row.isCurrent,
        competencies: experienceTagsByExperience.get(row.id) ?? [],
      })),
      manualOverride: activeOverride
        ? {
            id: activeOverride.id,
            action: activeOverride.action,
            value: activeOverride.value,
            reason: activeOverride.reason,
            createdAt: activeOverride.createdAt,
            createdByUserId: activeOverride.createdByUserId,
          }
        : undefined,
    });

    if (!params.persist) {
      return result;
    }

    const [persisted] = await db
      .insert(teacherSubjectMatchScores)
      .values({
        teacherId: result.teacherId,
        subjectId: result.subjectId,
        finalScore: result.finalScore,
        compatibilityBand: result.compatibilityBand,
        scoreDegree: result.scoreDegree,
        scoreArea: result.scoreArea,
        scoreCompetency: result.scoreCompetency,
        scoreTeachingHistory: result.scoreTeachingHistory,
        scoreProfessionalExperience: result.scoreProfessionalExperience,
        scoreManualAdjustment: result.scoreManualAdjustment,
        algorithmVersion: result.algorithmVersion,
        manualOverrideId: activeOverride?.id ?? null,
        explanation: result.explanation,
        calculatedByUserId: params.calculatedByUserId ?? null,
      })
      .onConflictDoUpdate({
        target: [
          teacherSubjectMatchScores.teacherId,
          teacherSubjectMatchScores.subjectId,
          teacherSubjectMatchScores.algorithmVersion,
        ],
        set: {
          finalScore: result.finalScore,
          compatibilityBand: result.compatibilityBand,
          scoreDegree: result.scoreDegree,
          scoreArea: result.scoreArea,
          scoreCompetency: result.scoreCompetency,
          scoreTeachingHistory: result.scoreTeachingHistory,
          scoreProfessionalExperience: result.scoreProfessionalExperience,
          scoreManualAdjustment: result.scoreManualAdjustment,
          manualOverrideId: activeOverride?.id ?? null,
          explanation: result.explanation,
          calculatedByUserId: params.calculatedByUserId ?? null,
          calculatedAt: new Date(),
        },
      })
      .returning({
        calculatedAt: teacherSubjectMatchScores.calculatedAt,
      });

    return {
      ...result,
      calculatedAt: persisted.calculatedAt,
    };
  }

  async createManualOverride(input: {
    teacherId: number;
    subjectId: number;
    action: ManualOverrideAction;
    value?: number;
    reason: string;
    createdByUserId: number;
  }) {
    const [teacher, subject] = await Promise.all([
      db
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(eq(users.id, input.teacherId))
        .then((rows) => rows[0]),
      db
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.id, input.subjectId))
        .then((rows) => rows[0]),
    ]);

    ensureTeacherExistsOrThrow(teacher);
    ensureSubjectExistsOrThrow(subject);

    const normalizedValue =
      input.action === "boost" || input.action === "penalty" ? clamp(input.value ?? 0, 0, 5) : 0;

    const [created] = await db
      .insert(teacherSubjectManualOverrides)
      .values({
        teacherId: input.teacherId,
        subjectId: input.subjectId,
        action: input.action,
        value: normalizedValue,
        reason: input.reason,
        createdByUserId: input.createdByUserId,
      })
      .returning();

    return created;
  }

  async revokeManualOverride(input: { overrideId: number; revokedByUserId: number }) {
    const [existing] = await db
      .select()
      .from(teacherSubjectManualOverrides)
      .where(eq(teacherSubjectManualOverrides.id, input.overrideId));

    if (!existing) {
      throw new Error("Override nao encontrado");
    }

    if (existing.revokedAt) {
      return existing;
    }

    const [updated] = await db
      .update(teacherSubjectManualOverrides)
      .set({
        revokedAt: new Date(),
        revokedByUserId: input.revokedByUserId,
      })
      .where(eq(teacherSubjectManualOverrides.id, input.overrideId))
      .returning();

    return updated;
  }
}

export const teacherSubjectCompatibilityService = new TeacherSubjectCompatibilityService();
