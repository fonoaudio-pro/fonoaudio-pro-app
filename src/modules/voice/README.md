# Voice Analysis Module (Gold Standard)

## Overview
The Voice Module is designed to identify organic and functional vocal disorders by analyzing clinical facts and signs. It prioritizes the detection of "Red Flags" that require urgent ENT (ORL) referral.

## Clinical Logic
- **Signs vs Measures**: The module distinguishes between qualitative signs (e.g., stridor) and quantitative measures (e.g., jitter).
- **Red Flags**: High-priority indicators such as sudden voice change, weight loss, or hemoptisis trigger an immediate 'critical' risk level and 'emergency' action level.
- **Persistence**: Dysphonia persisting over time increases the risk level and triggers a recommendation for instrumental assessment (laryngoscopy).
- **Objective Measures**: The system incorporates acoustic measures (like Jitter and Shimmer) as complementary evidence.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the rules (e.g., `jitter > 1.04%`) are **operational rules** of the system designed to trigger clinical alerts for the professional. They are NOT universal medical cut-off points and should be interpreted as triggers for further clinical investigation, not as standalone diagnoses.

## Governance Rule
Objective measures are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-interruptive alerts (e.g., 'critical' or 'emergency') without complementary qualitative clinical signs and specific professional validation.

## Lifecycle
1. **Analysis**: `VoiceService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Facts can be marked as resolved, which removes them from the current analysis.
4. **Acknowledgement**: The UI provides a mechanism to resolve red flags, maintaining traceability.

## Referral Criteria
- **ORL Referral**: Triggered by high/critical risk or any detected Red Flag.
- **Instrumental Assessment**: Triggered by persistent dysphonia or high organic risk.

## Constraints
- **No Diagnosis**: The module suggests "Possible organic risk" or "Functional disorder" but NEVER provides a final medical diagnosis.
- **Prudent Wording**: All summaries use descriptive and cautious language.

