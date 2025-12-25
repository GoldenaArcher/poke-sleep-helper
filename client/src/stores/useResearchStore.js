import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useResearchStore = create((set) => ({
  researchAreas: [],
  berries: [],
  loadResearch: async () => {
    const [areasData, berriesData] = await Promise.all([
      apiFetch("/api/research-areas"),
      apiFetch("/api/berries")
    ]);
    set({ researchAreas: areasData, berries: berriesData });
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
  }
}));

export default useResearchStore;
