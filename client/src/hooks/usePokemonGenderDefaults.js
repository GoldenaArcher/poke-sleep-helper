import { useCallback } from "react";

const LATIAS_DEX_NO = 380;

const normalizeDexNo = (speciesDexNo) => {
  const parsed = Number(speciesDexNo);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function usePokemonGenderDefaults() {
  const getDefaultGender = useCallback(
    (speciesDexNo, currentGender = "unknown") => {
      const normalizedDexNo = normalizeDexNo(speciesDexNo);
      if (
        normalizedDexNo === LATIAS_DEX_NO &&
        (!currentGender || currentGender === "unknown")
      ) {
        return "female";
      }
      return currentGender || "unknown";
    },
    []
  );

  return { getDefaultGender };
}
