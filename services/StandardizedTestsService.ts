export interface TestQuestion {
    id: string;
    stimulus: string;
    expectedResponse: string;
    alternatives?: string[];
    ageRange?: string;
}

export interface TestDefinition {
    id: string;
    name: string;
    acronym: string;
    area: 'lenguaje_expresivo' | 'lenguaje_comprension' | 'habla' | 'voz' | 'fluidez' | 'deglucion' | 'cognicion';
    subtests: TestSubtest[];
    ageRange: { min: number; max: number };
    applicationTime: string;
    description: string;
    percentileTable: PercentileRow[];
}

export interface TestSubtest {
    id: string;
    name: string;
    maxScore: number;
    questions: TestQuestion[];
}

export interface PercentileRow {
    ageRange: string;
    rawScore: number;
    percentile: number;
    classification: 'Muy bajo' | 'Bajo' | 'Medio bajo' | 'Medio' | 'Medio alto' | 'Alto' | 'Muy alto';
}

export interface TestResult {
    testId: string;
    testName: string;
    subtestId: string;
    subtestName: string;
    rawScore: number;
    maxScore: number;
    percentage: number;
    percentile: number;
    classification: string;
    ageRange: string;
}

export interface TestSession {
    id: string;
    patientId: string;
    testId: string;
    date: string;
    ageAtApplication: number;
    results: TestResult[];
    observations: string;
    clinicianNotes: string;
}

const BOSTON_BNT_PERCENTILES: PercentileRow[] = [
    { ageRange: '3:0-3:5', rawScore: 10, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '3:0-3:5', rawScore: 15, percentile: 5, classification: 'Bajo' },
    { ageRange: '3:0-3:5', rawScore: 20, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '3:0-3:5', rawScore: 25, percentile: 50, classification: 'Medio' },
    { ageRange: '3:0-3:5', rawScore: 30, percentile: 84, classification: 'Medio alto' },
    { ageRange: '3:0-3:5', rawScore: 35, percentile: 95, classification: 'Alto' },
    { ageRange: '3:0-3:5', rawScore: 40, percentile: 99, classification: 'Muy alto' },
    { ageRange: '4:0-4:5', rawScore: 15, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '4:0-4:5', rawScore: 22, percentile: 5, classification: 'Bajo' },
    { ageRange: '4:0-4:5', rawScore: 28, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '4:0-4:5', rawScore: 34, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:5', rawScore: 40, percentile: 84, classification: 'Medio alto' },
    { ageRange: '4:0-4:5', rawScore: 45, percentile: 95, classification: 'Alto' },
    { ageRange: '4:0-4:5', rawScore: 50, percentile: 99, classification: 'Muy alto' },
    { ageRange: '5:0-5:11', rawScore: 20, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 28, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 35, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 42, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 48, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 53, percentile: 95, classification: 'Alto' },
    { ageRange: '5:0-5:11', rawScore: 58, percentile: 99, classification: 'Muy alto' },
    { ageRange: '6:0-6:11', rawScore: 30, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-6:11', rawScore: 38, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-6:11', rawScore: 44, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-6:11', rawScore: 50, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-6:11', rawScore: 55, percentile: 84, classification: 'Medio alto' },
    { ageRange: '6:0-6:11', rawScore: 58, percentile: 95, classification: 'Alto' },
    { ageRange: '6:0-6:11', rawScore: 60, percentile: 99, classification: 'Muy alto' },
    { ageRange: '7:0-7:11', rawScore: 38, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '7:0-7:11', rawScore: 45, percentile: 5, classification: 'Bajo' },
    { ageRange: '7:0-7:11', rawScore: 50, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '7:0-7:11', rawScore: 55, percentile: 50, classification: 'Medio' },
    { ageRange: '7:0-7:11', rawScore: 58, percentile: 84, classification: 'Medio alto' },
    { ageRange: '7:0-7:11', rawScore: 60, percentile: 95, classification: 'Alto' },
    { ageRange: '8:0-8:11', rawScore: 45, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '8:0-8:11', rawScore: 50, percentile: 5, classification: 'Bajo' },
    { ageRange: '8:0-8:11', rawScore: 54, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '8:0-8:11', rawScore: 57, percentile: 50, classification: 'Medio' },
    { ageRange: '8:0-8:11', rawScore: 59, percentile: 84, classification: 'Medio alto' },
    { ageRange: '8:0-8:11', rawScore: 60, percentile: 95, classification: 'Alto' },
    { ageRange: '9:0-12:11', rawScore: 50, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '9:0-12:11', rawScore: 54, percentile: 5, classification: 'Bajo' },
    { ageRange: '9:0-12:11', rawScore: 56, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '9:0-12:11', rawScore: 58, percentile: 50, classification: 'Medio' },
    { ageRange: '9:0-12:11', rawScore: 60, percentile: 84, classification: 'Medio alto' },
];

const TBDA_PERCENTILES: PercentileRow[] = [
    { ageRange: '4:0-4:11', rawScore: 5, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '4:0-4:11', rawScore: 8, percentile: 5, classification: 'Bajo' },
    { ageRange: '4:0-4:11', rawScore: 12, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '4:0-4:11', rawScore: 16, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:11', rawScore: 20, percentile: 84, classification: 'Medio alto' },
    { ageRange: '4:0-4:11', rawScore: 23, percentile: 95, classification: 'Alto' },
    { ageRange: '5:0-5:11', rawScore: 10, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 14, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 18, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 22, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 26, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 28, percentile: 95, classification: 'Alto' },
    { ageRange: '6:0-6:11', rawScore: 14, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-6:11', rawScore: 18, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-6:11', rawScore: 22, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-6:11', rawScore: 26, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-6:11', rawScore: 28, percentile: 84, classification: 'Medio alto' },
    { ageRange: '7:0-7:11', rawScore: 18, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '7:0-7:11', rawScore: 22, percentile: 5, classification: 'Bajo' },
    { ageRange: '7:0-7:11', rawScore: 25, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '7:0-7:11', rawScore: 28, percentile: 50, classification: 'Medio' },
    { ageRange: '7:0-7:11', rawScore: 29, percentile: 84, classification: 'Medio alto' },
];

const TOKEN_TEST_PERCENTILES: PercentileRow[] = [
    { ageRange: '3:0-3:11', rawScore: 3, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '3:0-3:11', rawScore: 5, percentile: 5, classification: 'Bajo' },
    { ageRange: '3:0-3:11', rawScore: 8, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '3:0-3:11', rawScore: 12, percentile: 50, classification: 'Medio' },
    { ageRange: '3:0-3:11', rawScore: 16, percentile: 84, classification: 'Medio alto' },
    { ageRange: '3:0-3:11', rawScore: 18, percentile: 95, classification: 'Alto' },
    { ageRange: '4:0-4:11', rawScore: 8, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '4:0-4:11', rawScore: 12, percentile: 5, classification: 'Bajo' },
    { ageRange: '4:0-4:11', rawScore: 16, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '4:0-4:11', rawScore: 20, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:11', rawScore: 24, percentile: 84, classification: 'Medio alto' },
    { ageRange: '4:0-4:11', rawScore: 26, percentile: 95, classification: 'Alto' },
    { ageRange: '5:0-5:11', rawScore: 14, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 18, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 22, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 26, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 28, percentile: 84, classification: 'Medio alto' },
    { ageRange: '6:0-10:11', rawScore: 20, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-10:11', rawScore: 24, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-10:11', rawScore: 27, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-10:11', rawScore: 29, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-10:11', rawScore: 30, percentile: 84, classification: 'Medio alto' },
];

const CELF5_EXPRESSIVE_PERCENTILES: PercentileRow[] = [
    { ageRange: '5:0-5:11', rawScore: 5, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 10, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 15, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 20, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 25, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 28, percentile: 95, classification: 'Alto' },
    { ageRange: '6:0-7:11', rawScore: 8, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-7:11', rawScore: 14, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-7:11', rawScore: 18, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-7:11', rawScore: 23, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-7:11', rawScore: 27, percentile: 84, classification: 'Medio alto' },
    { ageRange: '6:0-7:11', rawScore: 29, percentile: 95, classification: 'Alto' },
    { ageRange: '8:0-12:11', rawScore: 12, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '8:0-12:11', rawScore: 18, percentile: 5, classification: 'Bajo' },
    { ageRange: '8:0-12:11', rawScore: 22, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '8:0-12:11', rawScore: 26, percentile: 50, classification: 'Medio' },
    { ageRange: '8:0-12:11', rawScore: 29, percentile: 84, classification: 'Medio alto' },
];

const CELF5_COMPRENSION_PERCENTILES: PercentileRow[] = [
    { ageRange: '5:0-5:11', rawScore: 6, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 11, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 16, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 21, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 26, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 29, percentile: 95, classification: 'Alto' },
    { ageRange: '6:0-7:11', rawScore: 10, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-7:11', rawScore: 15, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-7:11', rawScore: 19, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-7:11', rawScore: 24, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-7:11', rawScore: 28, percentile: 84, classification: 'Medio alto' },
    { ageRange: '6:0-7:11', rawScore: 30, percentile: 95, classification: 'Alto' },
    { ageRange: '8:0-12:11', rawScore: 14, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '8:0-12:11', rawScore: 19, percentile: 5, classification: 'Bajo' },
    { ageRange: '8:0-12:11', rawScore: 23, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '8:0-12:11', rawScore: 27, percentile: 50, classification: 'Medio' },
    { ageRange: '8:0-12:11', rawScore: 30, percentile: 84, classification: 'Medio alto' },
];

const FLUENCY_PERCENTILES: PercentileRow[] = [
    { ageRange: '3:0-3:11', rawScore: 0, percentile: 50, classification: 'Medio' },
    { ageRange: '3:0-3:11', rawScore: 3, percentile: 84, classification: 'Medio alto' },
    { ageRange: '3:0-3:11', rawScore: 5, percentile: 95, classification: 'Alto' },
    { ageRange: '4:0-4:11', rawScore: 0, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:11', rawScore: 2, percentile: 84, classification: 'Medio alto' },
    { ageRange: '4:0-4:11', rawScore: 4, percentile: 95, classification: 'Alto' },
    { ageRange: '5:0-5:11', rawScore: 0, percentile: 50, classification: 'Medio' },
    { ageRange: '5:0-5:11', rawScore: 1, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 3, percentile: 95, classification: 'Alto' },
    { ageRange: '6:0-10:11', rawScore: 0, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-10:11', rawScore: 1, percentile: 84, classification: 'Medio alto' },
    { ageRange: '6:0-10:11', rawScore: 2, percentile: 95, classification: 'Alto' },
];

const ONESAME_PERCENTILES: PercentileRow[] = [
    { ageRange: '3:0-3:11', rawScore: 5, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '3:0-3:11', rawScore: 10, percentile: 5, classification: 'Bajo' },
    { ageRange: '3:0-3:11', rawScore: 15, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '3:0-3:11', rawScore: 20, percentile: 50, classification: 'Medio' },
    { ageRange: '3:0-3:11', rawScore: 24, percentile: 84, classification: 'Medio alto' },
    { ageRange: '3:0-3:11', rawScore: 25, percentile: 95, classification: 'Alto' },
    { ageRange: '4:0-4:11', rawScore: 10, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '4:0-4:11', rawScore: 15, percentile: 5, classification: 'Bajo' },
    { ageRange: '4:0-4:11', rawScore: 20, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '4:0-4:11', rawScore: 24, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:11', rawScore: 25, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 15, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 20, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 23, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 25, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-10:11', rawScore: 20, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-10:11', rawScore: 23, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-10:11', rawScore: 25, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-10:11', rawScore: 25, percentile: 50, classification: 'Medio' },
];

const MINIMOS_PARES_PERCENTILES: PercentileRow[] = [
    { ageRange: '3:0-3:11', rawScore: 4, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '3:0-3:11', rawScore: 7, percentile: 5, classification: 'Bajo' },
    { ageRange: '3:0-3:11', rawScore: 10, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '3:0-3:11', rawScore: 14, percentile: 50, classification: 'Medio' },
    { ageRange: '3:0-3:11', rawScore: 17, percentile: 84, classification: 'Medio alto' },
    { ageRange: '3:0-3:11', rawScore: 20, percentile: 95, classification: 'Alto' },
    { ageRange: '4:0-4:11', rawScore: 8, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '4:0-4:11', rawScore: 12, percentile: 5, classification: 'Bajo' },
    { ageRange: '4:0-4:11', rawScore: 15, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '4:0-4:11', rawScore: 18, percentile: 50, classification: 'Medio' },
    { ageRange: '4:0-4:11', rawScore: 20, percentile: 84, classification: 'Medio alto' },
    { ageRange: '5:0-5:11', rawScore: 12, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '5:0-5:11', rawScore: 15, percentile: 5, classification: 'Bajo' },
    { ageRange: '5:0-5:11', rawScore: 18, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '5:0-5:11', rawScore: 20, percentile: 50, classification: 'Medio' },
    { ageRange: '6:0-10:11', rawScore: 16, percentile: 1, classification: 'Muy bajo' },
    { ageRange: '6:0-10:11', rawScore: 18, percentile: 5, classification: 'Bajo' },
    { ageRange: '6:0-10:11', rawScore: 19, percentile: 16, classification: 'Medio bajo' },
    { ageRange: '6:0-10:11', rawScore: 20, percentile: 50, classification: 'Medio' },
];

export const TEST_DEFINITIONS: Record<string, TestDefinition> = {
    boston_bnt: {
        id: 'boston_bnt',
        name: 'Boston Naming Test',
        acronym: 'BNT',
        area: 'lenguaje_expresivo',
        ageRange: { min: 3, max: 12 },
        applicationTime: '15-20 min',
        description: 'Evalúa la capacidad de denominación de imágenes. Mide acceso al léxico y recuperación fonológica.',
        subtests: [
            {
                id: 'boston_bnt_main',
                name: 'Denominación de Imágenes',
                maxScore: 60,
                questions: Array.from({ length: 60 }, (_, i) => ({
                    id: `bnt_${i + 1}`,
                    stimulus: `Imagen ${i + 1}`,
                    expectedResponse: `[Respuesta esperada ${i + 1}]`,
                })),
            },
        ],
        percentileTable: BOSTON_BNT_PERCENTILES,
    },
    tbda: {
        id: 'tbda',
        name: 'Test de Battería de Evaluación del Desarrollo del Lenguaje',
        acronym: 'TBDA',
        area: 'lenguaje_expresivo',
        ageRange: { min: 4, max: 7 },
        applicationTime: '30-40 min',
        description: 'Evalúa diferentes componentes del lenguaje expresivo: vocabulario, morfosintaxis y narrativa.',
        subtests: [
            {
                id: 'tbda_vocabulario',
                name: 'Vocabulario Expresivo',
                maxScore: 30,
                questions: Array.from({ length: 30 }, (_, i) => ({
                    id: `tbda_v_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Respuesta ${i + 1}]`,
                })),
            },
            {
                id: 'tbda_morfosintaxis',
                name: 'Morfosintaxis',
                maxScore: 20,
                questions: Array.from({ length: 20 }, (_, i) => ({
                    id: `tbda_m_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Respuesta ${i + 1}]`,
                })),
            },
            {
                id: 'tbda_narrativa',
                name: 'Narrativa',
                maxScore: 10,
                questions: Array.from({ length: 10 }, (_, i) => ({
                    id: `tbda_n_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Respuesta ${i + 1}]`,
                })),
            },
        ],
        percentileTable: TBDA_PERCENTILES,
    },
    token_test: {
        id: 'token_test',
        name: 'Token Test',
        acronym: 'TT',
        area: 'lenguaje_comprension',
        ageRange: { min: 3, max: 10 },
        applicationTime: '15-20 min',
        description: 'Evalúa la comprensión de órdenes orales de complejidad creciente.',
        subtests: [
            {
                id: 'token_nivel1',
                name: 'Nivel 1 (Órdenes simples)',
                maxScore: 10,
                questions: Array.from({ length: 10 }, (_, i) => ({
                    id: `token_1_${i + 1}`,
                    stimulus: `Orden simple ${i + 1}`,
                    expectedResponse: `[Acción ${i + 1}]`,
                })),
            },
            {
                id: 'token_nivel2',
                name: 'Nivel 2 (Órdenes con modificadores)',
                maxScore: 10,
                questions: Array.from({ length: 10 }, (_, i) => ({
                    id: `token_2_${i + 1}`,
                    stimulus: `Orden ${i + 1}`,
                    expectedResponse: `[Acción ${i + 1}]`,
                })),
            },
            {
                id: 'token_nivel3',
                name: 'Nivel 3 (Órdenes complejas)',
                maxScore: 10,
                questions: Array.from({ length: 10 }, (_, i) => ({
                    id: `token_3_${i + 1}`,
                    stimulus: `Orden ${i + 1}`,
                    expectedResponse: `[Acción ${i + 1}]`,
                })),
            },
        ],
        percentileTable: TOKEN_TEST_PERCENTILES,
    },
    celf5_expressivo: {
        id: 'celf5_expressivo',
        name: 'CELF-5 Índice de Lenguaje Expresivo',
        acronym: 'CLE',
        area: 'lenguaje_expresivo',
        ageRange: { min: 5, max: 12 },
        applicationTime: '25-30 min',
        description: 'Índice compuesto del CELF-5 que mide habilidades expresivas del lenguaje.',
        subtests: [
            {
                id: 'celf_sentencias',
                name: 'Formulación de Oraciones',
                maxScore: 16,
                questions: Array.from({ length: 16 }, (_, i) => ({
                    id: `celf_s_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Oración ${i + 1}]`,
                })),
            },
            {
                id: 'celf.vocabulario',
                name: 'Vocabulario Receptivo y Expresivo',
                maxScore: 16,
                questions: Array.from({ length: 16 }, (_, i) => ({
                    id: `celf_v_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Respuesta ${i + 1}]`,
                })),
            },
        ],
        percentileTable: CELF5_EXPRESSIVE_PERCENTILES,
    },
    celf5_comprension: {
        id: 'celf5_comprension',
        name: 'CELF-5 Índice de Lenguaje Comprensivo',
        acronym: 'CLC',
        area: 'lenguaje_comprension',
        ageRange: { min: 5, max: 12 },
        applicationTime: '25-30 min',
        description: 'Índice compuesto del CELF-5 que mide habilidades comprensivas del lenguaje.',
        subtests: [
            {
                id: 'celf_comp_instrucciones',
                name: 'Seguidor de Instrucciones',
                maxScore: 16,
                questions: Array.from({ length: 16 }, (_, i) => ({
                    id: `celf_ci_${i + 1}`,
                    stimulus: `Instrucción ${i + 1}`,
                    expectedResponse: `[Acción ${i + 1}]`,
                })),
            },
            {
                id: 'celf_comp_eorias',
                name: 'Conceptos y Relaciones',
                maxScore: 16,
                questions: Array.from({ length: 16 }, (_, i) => ({
                    id: `celf_cr_${i + 1}`,
                    stimulus: `Pregunta ${i + 1}`,
                    expectedResponse: `[Respuesta ${i + 1}]`,
                })),
            },
        ],
        percentileTable: CELF5_COMPRENSION_PERCENTILES,
    },
    fluidez_fonologica: {
        id: 'fluidez_fonologica',
        name: 'Fluidez Fonológica',
        acronym: 'FF',
        area: 'fluidez',
        ageRange: { min: 3, max: 10 },
        applicationTime: '5-10 min',
        description: 'Mide la cantidad de palabras producidas en 60 segundos para una letra específica.',
        subtests: [
            {
                id: 'ff_letra_p',
                name: 'Letra P (1 min)',
                maxScore: 999,
                questions: [{ id: 'ff_p', stimulus: 'Decí todas las palabras que puedas que empiecen con la letra P', expectedResponse: '...' }],
            },
            {
                id: 'ff_letra_m',
                name: 'Letra M (1 min)',
                maxScore: 999,
                questions: [{ id: 'ff_m', stimulus: 'Decí todas las palabras que puedas que empiecen con la letra M', expectedResponse: '...' }],
            },
            {
                id: 'ff_seminas',
                name: 'Animales (1 min)',
                maxScore: 999,
                questions: [{ id: 'ff_a', stimulus: 'Decí todos los nombres de animales que puedas', expectedResponse: '...' }],
            },
        ],
        percentileTable: FLUENCY_PERCENTILES,
    },
    oneword: {
        id: 'oneword',
        name: 'One Word Picture Vocabulary Test',
        acronym: 'OWPV',
        area: 'lenguaje_expresivo',
        ageRange: { min: 3, max: 10 },
        applicationTime: '10-15 min',
        description: 'Evalúa vocabulario expresivo mediante denominación de una sola palabra.',
        subtests: [
            {
                id: 'owpv_main',
                name: 'Denominación de Una Palabra',
                maxScore: 25,
                questions: Array.from({ length: 25 }, (_, i) => ({
                    id: `owp_${i + 1}`,
                    stimulus: `Imagen ${i + 1}`,
                    expectedResponse: `[Palabra ${i + 1}]`,
                })),
            },
        ],
        percentileTable: ONESAME_PERCENTILES,
    },
    pares_minimos: {
        id: 'pares_minimos',
        name: 'Test de Pares Mínimos',
        acronym: 'PM',
        area: 'habla',
        ageRange: { min: 3, max: 8 },
        applicationTime: '15-20 min',
        description: 'Evalúa discriminación auditiva de pares de palabras que difieren en un solo fonema.',
        subtests: [
            {
                id: 'pm_auditivo',
                name: 'Discriminación Auditiva',
                maxScore: 20,
                questions: Array.from({ length: 20 }, (_, i) => ({
                    id: `pm_${i + 1}`,
                    stimulus: `Par ${i + 1}`,
                    expectedResponse: `[Selección ${i + 1}]`,
                })),
            },
            {
                id: 'pm_expresivo',
                name: 'Producción de Pares Mínimos',
                maxScore: 20,
                questions: Array.from({ length: 20 }, (_, i) => ({
                    id: `pme_${i + 1}`,
                    stimulus: `Estímulo ${i + 1}`,
                    expectedResponse: `[Producción ${i + 1}]`,
                })),
            },
        ],
        percentileTable: MINIMOS_PARES_PERCENTILES,
    },
};

function getAgeRangeLabel(years: number, months: number): string {
    const totalMonths = years * 12 + months;
    if (totalMonths < 36) return '2:0-2:11';
    if (totalMonths < 42) return '3:0-3:5';
    if (totalMonths < 48) return '3:6-3:11';
    if (totalMonths < 54) return '4:0-4:5';
    if (totalMonths < 60) return '4:6-4:11';
    if (totalMonths < 66) return '5:0-5:5';
    if (totalMonths < 72) return '5:6-5:11';
    if (totalMonths < 84) return '6:0-6:11';
    if (totalMonths < 96) return '7:0-7:11';
    if (totalMonths < 108) return '8:0-8:11';
    if (totalMonths < 120) return '9:0-9:11';
    if (totalMonths < 132) return '10:0-10:11';
    if (totalMonths < 144) return '11:0-11:11';
    return '12:0-12:11';
}

export function calculatePercentile(testId: string, rawScore: number, ageYears: number, ageMonths: number): { percentile: number; classification: string } {
    const test = TEST_DEFINITIONS[testId];
    if (!test) return { percentile: 0, classification: 'Desconocido' };

    const ageLabel = getAgeRangeLabel(ageYears, ageMonths);
    const entries = test.percentileTable.filter(r => r.ageRange === ageLabel);

    if (entries.length === 0) {
        const fallback = test.percentileTable.filter(r => {
            const [minStr] = r.ageRange.split('-');
            const minMonths = parseAgeToMonths(minStr);
            const patientMonths = ageYears * 12 + ageMonths;
            return Math.abs(minMonths - patientMonths) <= 12;
        });
        if (fallback.length === 0) return { percentile: 0, classification: 'Sin tabla' };
        return findPercentile(fallback, rawScore);
    }

    return findPercentile(entries, rawScore);
}

function parseAgeToMonths(ageStr: string): number {
    const parts = ageStr.trim().split(':');
    return parseInt(parts[0]) * 12 + parseInt(parts[1] || '0');
}

function findPercentile(entries: PercentileRow[], rawScore: number): { percentile: number; classification: string } {
    let best = entries[0];
    for (const entry of entries) {
        if (rawScore >= entry.rawScore) best = entry;
    }
    return { percentile: best.percentile, classification: best.classification };
}

export function evaluateTest(testId: string, scores: Record<string, number>, patientAge: number): TestResult[] {
    const test = TEST_DEFINITIONS[testId];
    if (!test) return [];

    const results: TestResult[] = [];

    for (const subtest of test.subtests) {
        const rawScore = scores[subtest.id] || 0;
        const percentage = subtest.maxScore > 0 ? Math.round((rawScore / subtest.maxScore) * 100) : 0;
        const ageYears = Math.floor(patientAge);
        const ageMonths = Math.round((patientAge - ageYears) * 12);
        const { percentile, classification } = calculatePercentile(testId, rawScore, ageYears, ageMonths);

        results.push({
            testId,
            testName: test.name,
            subtestId: subtest.id,
            subtestName: subtest.name,
            rawScore,
            maxScore: subtest.maxScore,
            percentage,
            percentile,
            classification,
            ageRange: getAgeRangeLabel(ageYears, ageMonths),
        });
    }

    return results;
}

export function generateScoringSummary(results: TestResult[]): string {
    if (results.length === 0) return 'Sin resultados registrados.';

    const test = TEST_DEFINITIONS[results[0].testId];
    const patientName = '';
    const avgPercentile = Math.round(results.reduce((sum, r) => sum + r.percentile, 0) / results.length);

    let summary = `<p><strong>Resumen de ${test?.name || 'Test'}:</strong></p>`;
    summary += `<ul>`;
    for (const r of results) {
        const emoji = r.percentile >= 84 ? '✓' : r.percentile >= 16 ? '~' : '!';
        summary += `<li>${r.subtestName}: ${r.rawScore}/${r.maxScore} (${r.percentage}%) — Percentil ${r.percentile} (${r.classification}) ${emoji}</li>`;
    }
    summary += `</ul>`;
    summary += `<p><strong>Percentil promedio: ${avgPercentile}</strong> — ${
        avgPercentile >= 84 ? 'Rendimiento dentro de lo esperado.' :
        avgPercentile >= 16 ? 'Rendimiento dentro del rango esperado, con áreas a reforzar.' :
        'Se recomienda profundizar la evaluación y considerar tratamiento.'
    }</p>`;

    return summary;
}
