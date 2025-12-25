import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useNaturesStore = create((set) => ({
  natures: [],
  loadNatures: async () => {
    const naturesData = await apiFetch("/api/natures");
    set({ natures: naturesData });
  }
}));

export default useNaturesStore;
