import { Material, Patient } from '../types';

export const getSuggestedMaterials = (patient: Patient, materials: Material[]): Material[] => {
    const diagnosis = patient.diagnosis?.toLowerCase() || '';
    const interests = patient.interests?.map(i => i.toLowerCase()) || [];
    
    // Simple scoring system
    return materials.map(material => {
        let score = 0;

        // 1. Clinical Area Match
        if (material.clinical_area && diagnosis.includes(material.clinical_area.toLowerCase())) {
            score += 10;
        }

        // 2. Tags Match
        if (material.tags) {
            material.tags.forEach(tag => {
                if (diagnosis.includes(tag.toLowerCase())) score += 5;
                if (interests.includes(tag.toLowerCase())) score += 3;
            });
        }

        // 3. Target Skill Match (if we can extract from diagnosis/notes)
        // This is a bit more advanced, let's keep it simple for now.

        return { ...material, _score: score };
    })
    .filter(m => (m as any)._score > 0)
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .slice(0, 5) as unknown as Material[];
};
