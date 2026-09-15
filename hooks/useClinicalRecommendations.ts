import { useState, useEffect, useCallback } from "react";
import { useClinicalContext } from "./useClinicalContext";
import { clinicalRecommendationsService, ClinicalRecommendation } from "../services/ClinicalRecommendationsService";
import { aiReportService } from "../services/aiReportService";

/**
 * useClinicalRecommendations
 *
 * Secretario clínico IA app-first: genera insights accionables a partir del
 * contexto clínico real del paciente activo y reacciona a alertas/sugerencias.
 *
 * - recommendations: reglas deterministas (inactividad, datos faltantes, signals).
 * - narrative: redacción en lenguaje natural (Groq → fallback Gemini).
 *
 * La mascota y el GlobalAssistant consumen este hook como única fuente de
 * recomendaciones: NO inventa, se basa en datos de la DB vía ClinicalContextManager.
 */
export const useClinicalRecommendations = () => {
  const { context, ...ctxApi } = useClinicalContext();
  const [recommendations, setRecommendations] = useState<ClinicalRecommendation[]>([]);
  const [narrative, setNarrative] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Días de inactividad por paciente — se calcula a partir del store React Query
  // (inyectado vía dependencia opcional; aquí se asume que el contexto expone
  // el historial de sesiones del paciente activo).
  const buildDeps = useCallback(() => {
    const summary = context.activePatientSummary;
    const patients = [];
    // El store global no expone todos los pacientes; la mascota los obtiene del
    // GlobalAssistant/store. Aquí usamos el paciente activo como foco.
    return { patients };
  }, [context]);

  const refresh = useCallback(async () => {
    const ctxPacket = clinicalContextManagerSnapshot(context);
    const health = context.followUpHealth;
    const signals = context.proactiveClinicalSuggestions;

    const recs = clinicalRecommendationsService.generate({
      ctx: context,
      deps: buildDeps(),
      health,
      signals,
    });
    setRecommendations(recs);

    // Redacción IA de la recomendación principal (solo si hay alguna)
    if (recs.length > 0 && !isGenerating) {
      const top = recs[0];
      setIsGenerating(true);
      try {
        const n = await aiReportService.askAI(
          `Generá un mensaje breve (máximo 2 frases, tono cálido y profesional, español rioplatense) que exprese la alerta/recomendación: "${top.title}" - "${top.message}" y proponga: "${top.action}".`,
          `Sos una asistente clínica de FonoAudio-Pro. Hablabas en primera persona y con voz cálida. No revelés que sos una IA. Usá "vos" y "vosotros" según corresponda.`,
          { tone: "familiar", maxLength: 160 }
        );
        setNarrative(n);
      } catch {
        setNarrative(recs[0].message);
      } finally {
        setIsGenerating(false);
      }
    } else {
      setNarrative("");
    }
  }, [context, isGenerating, buildDeps]);

  useEffect(() => {
    const timer = setTimeout(refresh, 800); // pequeño debounce para datos frescos
    return () => clearTimeout(timer);
  }, [refresh]);

  /** Dispone el cache de deduplicación (ej: al cambiar de día) */
  const resetCache = useCallback(() => {
    clinicalRecommendationsService.clearCache();
  }, []);

  return {
    context,
    recommendations,
    narrative,
    isGenerating,
    resetCache,
    ...ctxApi,
  };
};

/** Helper: extrae un snapshot serializable del contexto para logging */
function clinicalContextManagerSnapshot(ctx: any): string {
  if (!ctx) return "";
  try {
    return ctx.activePatientSummary
      ? `Paciente: ${ctx.activePatientSummary.name}${ctx.activePatientSummary.age ? ` (${ctx.activePatientSummary.age})` : ""}`
      : "Sin paciente activo";
  } catch {
    return "";
  }
}

export default useClinicalRecommendations;
