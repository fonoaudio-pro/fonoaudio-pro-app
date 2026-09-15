# Audiology Analysis Module (Gold Standard)

## Overview
The Audiology Module is designed to detect hearing impairments and vestibular dysfunction by analyzing clinical signs and objective audiometric measures. It prioritizes the detection of acute hearing loss and vestibular emergencies.

## Clinical Logic
- **Signs vs Measures**: Distinguishes between patient-reported signs (e.g., tinnitus, vertigo) and objective measures (e.g., audiometry thresholds, tympanometry).
- **Acute Loss**: Sudden onset of hearing loss associated with tinnitus is treated as a 'critical' emergency (SSHL).
- **Vestibular Dysfunction**: The combination of vertigo and hearing loss triggers a high-risk alert for further neurological and otological evaluation.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the rules (e.g., `discrimination_score < 50%`) are **operational rules** of the system designed to trigger clinical alerts for the professional. They are NOT universal medical cut-off points and should be interpreted as triggers for further clinical investigation, not as standalone diagnoses.

## Governance Rule
Objective measures are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-interruptive alerts (e.g., 'critical' or 'emergency') without complementary qualitative clinical signs and specific professional validation.

## Lifecycle
1. **Analysis**: `AudiologyService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis automatically generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Marked resolved facts are excluded from current triage analysis.
4. **Acknowledgement**: The UI implements a common `resolve`/`acknowledge` pattern.

## Referral & Assessment Criteria
- **ORL/Neurology Referral**: Suggested automatically for any `high` or `critical` risk level or active Red Flag.
- **Instrumental Assessment**: Advised for patients with reported hearing loss or otalgia to confirm the site of the lesion.

## Constraints
- **No Diagnosis**: The module suggests "Potential conductive loss" or "Vestibular imbalance" but NEVER provides a final medical diagnosis.
- **Prudent Wording**: All communication utilizes tentative and descriptive language.
