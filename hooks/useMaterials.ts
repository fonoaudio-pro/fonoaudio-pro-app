import { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { Material } from "../types";

export interface MaterialsState {
  materials: Material[];
  materialsError: boolean;
  isLoadingMaterials: boolean;
  fetchMaterials: () => Promise<void>;
}

export function useMaterials(): MaterialsState {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsError, setMaterialsError] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

  const fetchMaterials = async () => {
    try {
      setMaterialsError(false);
      setIsLoadingMaterials(true);
      const { data, error } = await supabase.from('materials').select('*');
      if (error) {
        console.error("Error fetching materials:", error.message);
        setMaterialsError(true);
      } else if (data) {
        setMaterials(data);
      }
    } catch (e) {
      console.error("Error fetching materials:", e);
      setMaterialsError(true);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  return { materials, materialsError, isLoadingMaterials, fetchMaterials };
}
