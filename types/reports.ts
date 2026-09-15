import { Patient } from "../types";

export const TREATMENT_PLAN_TEMPLATE = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1e293b;">
  <h2 style="text-align: center; color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px; margin-bottom: 24px;">
    Plan de Tratamiento Fonoaudiológico
  </h2>
  <div style="background: #f0f9ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px;">
    <strong>Paciente:</strong> [Nombre] &nbsp;&nbsp; <strong>Fecha:</strong> [Fecha] &nbsp;&nbsp; <strong>Profesional:</strong> [Profesional]
  </div>
  <section style="margin-bottom: 18px;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">1. Objetivo General</h3>
    <p style="padding: 10px; background: #fafafa; border-radius: 6px; border-left: 3px solid #0891b2;">Describí el objetivo principal del tratamiento...</p>
  </section>
  <section style="margin-bottom: 18px;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">2. Objetivos Específicos</h3>
    <ul style="padding-left: 20px; background: #fafafa; border-radius: 6px; padding: 12px 12px 12px 32px;">
      <li style="margin-bottom: 6px;">Objetivo específico 1</li>
      <li style="margin-bottom: 6px;">Objetivo específico 2</li>
      <li style="margin-bottom: 6px;">Objetivo específico 3</li>
    </ul>
  </section>
  <section style="margin-bottom: 18px;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">3. Estrategias y Metodología</h3>
    <p style="padding: 10px; background: #fafafa; border-radius: 6px; border-left: 3px solid #0891b2;">Describí las estrategias a utilizar...</p>
  </section>
  <section style="margin-bottom: 18px;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">4. Frecuencia de Sesiones</h3>
    <p style="padding: 10px; background: #fafafa; border-radius: 6px;">1 vez por semana / 2 veces por semana</p>
  </section>
  <section style="margin-bottom: 18px;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">5. Notas para el Hogar</h3>
    <p style="padding: 10px; background: #fafafa; border-radius: 6px; border-left: 3px solid #0891b2;">Actividades o pautas para reforzar en casa...</p>
  </section>
  <section style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
    <h3 style="color: #0891b2; margin-bottom: 6px; font-size: 15px;">6. Cronograma de Avance</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead><tr style="background: #0891b2; color: white;"><th style="padding: 8px; text-align: left;">Fecha</th><th style="padding: 8px; text-align: left;">Sesión</th><th style="padding: 8px; text-align: left;">Avance / Observaciones</th></tr></thead>
      <tbody>
        <tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">[Fecha]</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">1°</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">...</td></tr>
      </tbody>
    </table>
  </section>
</div>`;
