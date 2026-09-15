# Motricity Analysis Module (Gold Standard)

## Overview
The Motricity Module is designed to identify dysfunction in the muscles and coordination of the orofacial system. It focuses on muscle tone, functional patterns, and structural risks that may affect speaking, eating, and breathing.

## Clinical Logic
- **Signs vs Measures**: Distinguishes between qualitative observations (e.g., lip hypotonia, facial asymmetry) and quantitative metrics (e.g., tongue mobility score, facial symmetry index).
- **Red Flags**: Acute loss of facial muscle tone or sudden asymmetry triggers an 'emergency' action level due to suspected neurological events (e.g., Acute Facial Palsy).
- **Functional Patterns**: Combination of mouth breathing and lip hypotonia is identified as a functional risk requiring multidisciplinary intervention.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the rules (e.g., `tongue_mobility_score < 40`) are **operational rules** of the system designed to trigger clinical alerts for the professional. They are NOT universal medical cut-off points and should be interpreted as triggers for further clinical investigation, not as standalone diagnoses.

## Governance Rule
Objective measures are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-interruptive alerts (e.g., 'critical' or 'emergency') without complementary qualitative clinical signs and specific professional validation.

## Lifecycle
1. **Analysis**: `MotricityService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis automatically generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Marked resolved facts are excluded from current triage analysis.
4. **Acknowledgement**: The UI implements a common `resolve`/`acknowledge` pattern.

## Referral & Assessment Criteria
- **Neurological Referral**: Suggested automatically for any `high` or `critical` risk level or active Red Flag related to facial tone.
- **Interdisciplinary Assessment**: Advised for functional patterns involving mouth breathing or masticatory dysfunction.

## Constraints
- **No Diagnosis**: The module suggests "Potential muscle hypotonia" or "Functional imbalance" but NEVER provides a final medical diagnosis.
- **Prudent Wording**: All communication utilizes tentative and descriptive language.
