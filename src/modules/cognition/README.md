# Cognition Analysis Module (Gold Standard)

## Overview
The Cognition Module is designed to identify deficits in higher-order cognitive processes that affect communication and autonomy. It prioritizes the detection of acute cognitive changes (Delirium) and severe executive dysfunction.

## Clinical Logic
- **Signs vs Measures**: Distinguishes between clinical manifestations of cognitive failure (e.g., disorientation, anosognosia) and quantitative screening scores (e.g., MoCA, MMSE).
- **Acute Events**: The combination of temporal and spatial disorientation with attentional deficit triggers an 'emergency' action level due to suspected acute confusional state.
- **Executive Dysfunction**: Severe failures in planning and organization are marked as high risk, requiring specialized neuropsychological evaluation.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the rules (e.g., `moca_score < 26`) are **operational rules** of the system designed to trigger clinical alerts for the professional. They are NOT universal medical cut-off points and should be interpreted as triggers for further clinical investigation, not as standalone diagnoses.

## Governance Rule
Objective measures are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-interruptive alerts (e.g., 'critical' or 'emergency') without complementary qualitative clinical signs and specific professional validation.

## Lifecycle
1. **Analysis**: `CognitionService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis automatically generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Marked resolved facts are excluded from current triage analysis.
4. **Acknowledgement**: The UI implements a common `resolve`/`acknowledge` pattern.

## Referral & Assessment Criteria
- **Neurological/Psychiatric Referral**: Suggested automatically for any `high` or `critical` risk level or active Red Flag.
- **Neuropsychological Assessment**: Advised for patients with executive dysfunction or significant memory deficits to establish a cognitive baseline.

## Constraints
- **No Diagnosis**: The module suggests "Potential cognitive impairment" or "Acute confusional state" but NEVER provides a final medical diagnosis (e.g., Dementia).
- **Prudent Wording**: All communication utilizes tentative and descriptive language.
