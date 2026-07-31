# Language Analysis Module (Gold Standard)

## Overview
The Language Module identifies expressive and receptive language disorders by analyzing clinical signs and standardized test scores. It prioritizes the detection of acute neurological events (e.g., Stroke/ACV).

## Clinical Logic
- **Signs vs Measures**: Distinguishes between qualitative clinical signs (e.g., anomia) and quantitative scores (e.g., Boston Naming Test).
- **Acute Events**: Combination of anomia, paraphasias, and agrammatism triggers an 'emergency' action level due to suspected acute stroke.
- **Receptive Deficits**: Significant comprehension difficulties trigger 'urgent' referral for neuropsychological evaluation.

## Operational Thresholds
**IMPORTANT**: Thresholds used in the rules (e.g., `Boston Score < 15`) are **operational rules** of the system designed to trigger clinical alerts. They are NOT universal medical cut-off points and must be validated by the professional's clinical judgment.

## Governance Rule
Objective measures are designed to reinforce or modulate clinical severity. They must NOT, on their own, trigger high-interruptive alerts (e.g., 'critical' or 'emergency') without complementary qualitative clinical signs and specific professional validation.

## Lifecycle
1. **Analysis**: `LanguageService.analyze()` processes `ClinicalFact` entities.
2. **Persistence**: Every analysis generates a snapshot in `analysis_history` for longitudinal tracking.
3. **Resolution**: Facts can be marked as resolved, removing them from active analysis.
4. **Acknowledgement**: UI allows resolving red flags for traceability.

## Constraints
- **No Diagnosis**: The module identifies patterns (e.g., "Sugerente de déficit expresivo") but NEVER provides a final medical diagnosis.
- **Prudent Wording**: Summaries use descriptive, cautious language.
