import { useEffect, useState } from "react";
import ResearchAreasModal from "./ResearchAreasModal.jsx";
import useResearchStore from "../stores/useResearchStore.js";

const ResearchAreasModalContainer = ({ onClose }) => {
  const researchAreas = useResearchStore((state) => state.researchAreas);
  const berries = useResearchStore((state) => state.berries);
  const setDefaultArea = useResearchStore((state) => state.setDefaultArea);
  const updateAreaFavorites = useResearchStore(
    (state) => state.updateAreaFavorites
  );
  const [currentAreaName, setCurrentAreaName] = useState("");

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
      currentAreaName={currentAreaName}
      setCurrentAreaName={setCurrentAreaName}
      setDefaultArea={setDefaultArea}
      updateAreaFavorites={updateAreaFavorites}
      onClose={onClose}
    />
  );
};

export default ResearchAreasModalContainer;
