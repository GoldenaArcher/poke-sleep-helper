import { useEffect, useState } from "react";
import ResearchAreasModal from "./ResearchAreasModal.jsx";
import useDishesStore from "../stores/useDishesStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import useResearchStore from "../stores/useResearchStore.js";

const ResearchAreasModalContainer = ({ onClose }) => {
  const researchAreas = useResearchStore((state) => state.researchAreas);
  const berries = useResearchStore((state) => state.berries);
  const pokemonTypes = useResearchStore((state) => state.pokemonTypes);
  const subSkills = useResearchStore((state) => state.subSkills);
  const dishes = useDishesStore((state) => state.dishes);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const setDefaultArea = useResearchStore((state) => state.setDefaultArea);
  const updateAreaFavorites = useResearchStore(
    (state) => state.updateAreaFavorites
  );  const updateAreaBonus = useResearchStore((state) => state.updateAreaBonus);  const [currentAreaName, setCurrentAreaName] = useState("");

  useEffect(() => {
    const current = researchAreas.find((area) => area.is_default);
    if (current) {
      setCurrentAreaName(current.name);
    }
  }, [researchAreas]);

  return (
    <ResearchAreasModal
      researchAreas={researchAreas}
      berries={berries}
      pokemonTypes={pokemonTypes}
      subSkills={subSkills}
      dishes={dishes}
      settings={settings}
      updateSettings={updateSettings}
      currentAreaName={currentAreaName}
      setCurrentAreaName={setCurrentAreaName}
      setDefaultArea={setDefaultArea}
      updateAreaFavorites={updateAreaFavorites}
      updateAreaBonus={updateAreaBonus}
      onClose={onClose}
    />
  );
};

export default ResearchAreasModalContainer;
