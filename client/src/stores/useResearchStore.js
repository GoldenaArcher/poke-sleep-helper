import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useResearchStore = create((set) => ({
  researchAreas: [],
  berries: [],
  pokemonTypes: [],
  subSkills: [],
  loadResearch: async () => {
    const [areasData, berriesData, typesData, subSkillsData] = await Promise.all([
      apiFetch("/api/research-areas"),
      apiFetch("/api/berries"),
      apiFetch("/api/pokemon-types"),
      apiFetch("/api/sub-skills")
    ]);
    set({
      researchAreas: areasData,
      berries: berriesData,
      pokemonTypes: typesData,
      subSkills: subSkillsData
    });
  },
  setDefaultArea: async (areaId) => {
    const updated = await apiFetch(`/api/research-areas/${areaId}/default`, {
      method: "PUT"
    });
    set({ researchAreas: updated });
  },
  updateAreaFavorites: async (areaId, favorites) => {
    const updated = await apiFetch(
      `/api/research-areas/${areaId}/favorites`,
      {
        method: "PUT",
        body: JSON.stringify({ favorites })
      }
    );
    set((state) => ({
      researchAreas: state.researchAreas.map((area) =>
        area.id === areaId ? { ...area, favorites: updated } : area
      )
    }));
  },
  updateAreaBonus: async (areaId, areaBonus) => {
    const updated = await apiFetch(
      `/api/research-areas/${areaId}/area-bonus`,
      {
        method: "PUT",
        body: JSON.stringify({ areaBonus })
      }
    );
    set((state) => ({
      researchAreas: state.researchAreas.map((area) =>
        area.id === areaId ? { ...area, area_bonus: updated.area_bonus } : area
      )
    }));
  }
}));

export default useResearchStore;
