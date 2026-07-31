# Swallowing Analysis Module (Gold Standard)

## Overview
The Swallowing Module is designed to identify oral, pharyngeal, and aspirative risk patterns during food and liquid intake. It prioritizes the safety and security of the patient's airway, highlighting "Red Flags" that require immediate intervention.

## Clinical Logic
- **Signs vs Measures**: The module distinguishes between qualitative clinical observations (e.g., coughing after swallow, wet voice) and quantitative screening measures (e.g., FOIS score, pulse oximetry desaturation).
- **Aspiration Red Flags**: Direct signs of laryngeal penetration or aspiration (coughing, gurgling/wet quality of voice, respiratory distress) are treated as critical indicators.
- **Airway Security**: Active respiratory distress during ingestion triggers the highest level of emergency action.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the clinical rules (e.g., `fois_score < 5` or `desaturacion_oxigeno_porcentaje > 3%`) are **operational rule parameters** of the system. They are designed to trigger clinical suggestions and alerts to assist the logopedist/speech therapist. They are NOT universal medical cut-off points and must always be interpreted under the professional's clinical judgment and validation.

## Governance Rule
Objective measures (such as pulse oximetry desaturation and screening scores) are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-priority or interruptive alerts (such as `high` or `critical` risk, or `urgent` or `emergency` actions) without corresponding qualitative clinical signs or specific professional confirmation.

## Lifecycle
1. **Analysis**: `SwallowingService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis automatically generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Marked resolved facts are excluded from current triage analysis, allowing tracking of recovery.
4. **Acknowledgement**: The UI implements a common `resolve`/`acknowledge` pattern for seamless workflow.

## Referral & Assessment Criteria
- **ORL / Medical Referral**: Suggested automatically for any `high` or `critical` risk level or active Red Flag.
- **Instrumental Assessment**: Advised if the patient presents with direct signs of aspiration (`tos_post_ingesta`, `voz_humeda`) or if risk levels are high/critical.

## Constraints
- **No Diagnosis**: The module suggests "Potential aspirative risk" or "Oral phase inefficiency" but NEVER provides a definitive medical diagnosis.
- **Prudent Wording**: All family and professional communications utilize tentative and descriptive language.
