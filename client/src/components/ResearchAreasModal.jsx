import { IoCloseOutline } from "react-icons/io5";
import SearchSelect from "./SearchSelect.jsx";
import { findByName } from "../utils/text.js";

const ResearchAreasModal = ({
  researchAreas,
  berries,
  currentAreaName,
  setCurrentAreaName,
  setDefaultArea,
  updateAreaFavorites,
  onClose
}) => (
  <div className="bag-modal">
    <section className="card">
      <header className="section-header bag-header">
        <div>
          <h2>Research Areas</h2>
          <p className="meta">Select a default island.</p>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close areas"
        >
          <IoCloseOutline size={20} />
        </button>
      </header>
      <div className="area-controls">
        <label>
          Current research area
          <div className="inline-fields compact">
            <SearchSelect
              value={currentAreaName}
              placeholder="Select an area"
              options={researchAreas.map((area) => area.name)}
              listId="area-options"
              onChange={(event) => {
                const nextValue = event.target.value;
                setCurrentAreaName(nextValue);
                const match = findByName(researchAreas, nextValue);
                if (match && !match.is_default) {
                  setDefaultArea(match.id);
                }
              }}
              onBlur={() => {
                const match = findByName(researchAreas, currentAreaName);
                if (match && !match.is_default) {
                  setDefaultArea(match.id);
                }
              }}
            />
          </div>
        </label>
      </div>
      <div className="area-row highlight">
        <div className="highlight-title">Highlight berries</div>
        <div className="berry-selects">
          {[1, 2, 3].map((slot) => {
            const currentArea = researchAreas.find(
              (area) => area.is_default
            );
            const favorite =
              currentArea?.favorites?.find((entry) => entry.slot === slot)
                ?.berry_id || null;
            const favoriteName =
              berries.find((berry) => berry.id === favorite)?.name || "";
            return (
              <label key={slot}>
                Fav {slot}
                <SearchSelect
                  defaultValue={favoriteName}
                  placeholder="Select berry"
                  options={berries.map((berry) => berry.name)}
                  listId={`berry-options-${slot}`}
                  onBlur={(event) => {
                    if (!currentArea) {
                      return;
                    }
                    const match = findByName(berries, event.target.value);
                    const current =
                      currentArea.favorites?.map(
                        (entry) => entry.berry_id || null
                      ) || [null, null, null];
                    const next = [...current];
                    next[slot - 1] = match ? match.id : null;
                    updateAreaFavorites(currentArea.id, next);
                  }}
                />
              </label>
            );
          })}
        </div>
      </div>
    </section>
  </div>
);

export default ResearchAreasModal;
