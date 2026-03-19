process.env.DATABASE_URL ??= "postgres://compatibility:compatibility@localhost:5432/compatibility";

type CompatibilityBand = "high" | "medium" | "low" | "ineligible";

type Scenario = {
  name: string;
  expectedBand: CompatibilityBand;
  expectedMinScore?: number;
  expectedMaxScore?: number;
  input: any;
};

const now = new Date("2026-03-19T12:00:00.000Z");

function monthsAgo(months: number) {
  const date = new Date(now);
  date.setMonth(date.getMonth() - months);
  return date;
}

async function main() {
  const { calculateTeacherSubjectCompatibility } = await import("../server/teacher-subject-compatibility");

  const baseSubject = {
    subjectId: 101,
    subjectName: "Calculo Diferencial",
    subjectDescription: "Derivadas, limites e aplicacoes em modelagem quantitativa.",
    subjectArea: "Matematica",
    subjectSubarea: "Calculo",
    subjectCompetencies: [
      { key: "derivadas", label: "Derivadas", weight: 5 },
      { key: "limites", label: "Limites", weight: 4 },
      { key: "modelagem", label: "Modelagem Quantitativa", weight: 3 },
    ],
  };

  const scenarios: Scenario[] = [
    {
      name: "alta compatibilidade",
      expectedBand: "high",
      expectedMinScore: 75,
      input: {
        teacherId: 1,
        teacherName: "Prof. Ana Matos",
        ...baseSubject,
        degrees: [
          {
            id: 1,
            degreeLevel: "doctorate",
            courseName: "Doutorado em Calculo Aplicado",
            area: "Matematica",
            subarea: "Calculo",
            completedAt: monthsAgo(24),
          },
        ],
        teacherCompetencies: [
          { key: "derivadas", label: "Derivadas", weight: 5 },
          { key: "limites", label: "Limites", weight: 5 },
          { key: "modelagem", label: "Modelagem Quantitativa", weight: 4 },
        ],
        teachingHistory: [
          {
            id: 1,
            subjectId: 101,
            subjectName: "Calculo Diferencial",
            area: "Matematica",
            subarea: "Calculo",
            taughtAt: monthsAgo(8),
            academicTermCode: "2025.2",
            classSectionName: "Turma A",
            competencies: baseSubject.subjectCompetencies,
          },
          {
            id: 2,
            subjectId: 101,
            subjectName: "Calculo Diferencial",
            area: "Matematica",
            subarea: "Calculo",
            taughtAt: monthsAgo(20),
            academicTermCode: "2024.2",
            classSectionName: "Turma B",
            competencies: baseSubject.subjectCompetencies,
          },
        ],
        professionalExperiences: [
          {
            id: 1,
            companyName: "Instituto de Pesquisa Numerica",
            roleName: "Pesquisadora",
            area: "Matematica",
            subarea: "Calculo",
            startsAt: monthsAgo(72),
            endsAt: monthsAgo(12),
            isCurrent: false,
            competencies: [
              { key: "modelagem", label: "Modelagem Quantitativa", weight: 1 },
              { key: "limites", label: "Limites", weight: 1 },
            ],
          },
        ],
      },
    },
    {
      name: "media compatibilidade",
      expectedBand: "medium",
      expectedMinScore: 40,
      expectedMaxScore: 74,
      input: {
        teacherId: 2,
        teacherName: "Prof. Bruno Reis",
        ...baseSubject,
        degrees: [
          {
            id: 2,
            degreeLevel: "master",
            courseName: "Mestrado em Estatistica Aplicada",
            area: "Matematica",
            subarea: "Estatistica",
            completedAt: monthsAgo(30),
          },
        ],
        teacherCompetencies: [{ key: "modelagem", label: "Modelagem Quantitativa", weight: 4 }],
        teachingHistory: [
          {
            id: 3,
            subjectId: 202,
            subjectName: "Probabilidade",
            area: "Matematica",
            subarea: "Estatistica",
            taughtAt: monthsAgo(10),
            academicTermCode: "2025.2",
            classSectionName: "Turma A",
            competencies: [{ key: "modelagem", label: "Modelagem Quantitativa", weight: 3 }],
          },
        ],
        professionalExperiences: [
          {
            id: 2,
            companyName: "DataLab",
            roleName: "Analista Quantitativo",
            description: "Modelagem e simulacao.",
            area: "Matematica",
            subarea: "Analise Quantitativa",
            startsAt: monthsAgo(48),
            endsAt: null,
            isCurrent: true,
            competencies: [{ key: "modelagem", label: "Modelagem Quantitativa", weight: 1 }],
          },
        ],
      },
    },
    {
      name: "baixa compatibilidade",
      expectedBand: "low",
      expectedMinScore: 1,
      expectedMaxScore: 39,
      input: {
        teacherId: 3,
        teacherName: "Prof. Carla Lima",
        ...baseSubject,
        degrees: [
          {
            id: 3,
            degreeLevel: "specialization",
            courseName: "Especializacao em Gestao Escolar",
            area: "Educacao",
            subarea: "Gestao",
            completedAt: monthsAgo(18),
          },
        ],
        teacherCompetencies: [],
        teachingHistory: [],
        professionalExperiences: [
          {
            id: 3,
            companyName: "Colegio Central",
            roleName: "Coordenadora",
            area: "Educacao",
            subarea: "Gestao",
            startsAt: monthsAgo(36),
            endsAt: null,
            isCurrent: true,
            competencies: [],
          },
        ],
      },
    },
    {
      name: "inapta por bloqueio manual",
      expectedBand: "ineligible",
      expectedMinScore: 0,
      expectedMaxScore: 0,
      input: {
        teacherId: 4,
        teacherName: "Prof. Diego Silva",
        ...baseSubject,
        degrees: [
          {
            id: 4,
            degreeLevel: "doctorate",
            courseName: "Doutorado em Calculo",
            area: "Matematica",
            subarea: "Calculo",
            completedAt: monthsAgo(12),
          },
        ],
        teacherCompetencies: baseSubject.subjectCompetencies,
        teachingHistory: [],
        professionalExperiences: [],
        manualOverride: {
          id: 10,
          action: "block",
          value: 0,
          reason: "Restricao institucional registrada pela coordenacao.",
          createdAt: now,
        },
      },
    },
    {
      name: "materia sem tags suficientes",
      expectedBand: "medium",
      expectedMinScore: 40,
      input: {
        teacherId: 5,
        teacherName: "Prof. Elisa Souza",
        subjectId: 303,
        subjectName: "Historia da Matematica",
        subjectDescription: "Panorama historico da evolucao da matematica.",
        subjectArea: "Matematica",
        subjectSubarea: "Historia da Matematica",
        subjectCompetencies: [],
        degrees: [
          {
            id: 5,
            degreeLevel: "master",
            courseName: "Mestrado em Historia da Ciencia",
            area: "Matematica",
            subarea: "Historia da Matematica",
            completedAt: monthsAgo(20),
          },
        ],
        teacherCompetencies: [],
        teachingHistory: [
          {
            id: 5,
            subjectId: 304,
            subjectName: "Topicos de Historia da Ciencia",
            area: "Matematica",
            subarea: "Historia da Matematica",
            taughtAt: monthsAgo(6),
            academicTermCode: "2025.2",
            classSectionName: "Turma C",
            competencies: [],
          },
        ],
        professionalExperiences: [],
      },
    },
    {
      name: "professor com pouca informacao",
      expectedBand: "ineligible",
      expectedMinScore: 0,
      expectedMaxScore: 0,
      input: {
        teacherId: 6,
        teacherName: "Prof. Fabio Rocha",
        ...baseSubject,
        degrees: [],
        teacherCompetencies: [],
        teachingHistory: [],
        professionalExperiences: [],
      },
    },
  ];

  const assertScenario = (resultBand: CompatibilityBand, resultScore: number, scenario: Scenario) => {
    if (resultBand !== scenario.expectedBand) {
      throw new Error(
        `Cenario "${scenario.name}" falhou: faixa ${resultBand} recebida, esperado ${scenario.expectedBand}.`,
      );
    }

    if (scenario.expectedMinScore !== undefined && resultScore < scenario.expectedMinScore) {
      throw new Error(
        `Cenario "${scenario.name}" falhou: score ${resultScore} menor que o minimo ${scenario.expectedMinScore}.`,
      );
    }

    if (scenario.expectedMaxScore !== undefined && resultScore > scenario.expectedMaxScore) {
      throw new Error(
        `Cenario "${scenario.name}" falhou: score ${resultScore} maior que o maximo ${scenario.expectedMaxScore}.`,
      );
    }
  };

  for (const scenario of scenarios) {
    const result = calculateTeacherSubjectCompatibility(scenario.input);
    assertScenario(result.compatibilityBand, result.finalScore, scenario);
    console.log(
      `${scenario.name}: OK -> score=${result.finalScore}, faixa=${result.compatibilityBand}, ajuste=${result.scoreManualAdjustment}`,
    );
  }

  console.log(`Validacao concluida: ${scenarios.length} cenarios passaram.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
