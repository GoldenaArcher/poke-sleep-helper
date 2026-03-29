import { useMemo, useRef, useState, useEffect } from "react";
import { IoArrowUp, IoArrowDown } from "react-icons/io5";
import usePokedexStore from "../stores/usePokedexStore.js";
import useResearchStore from "../stores/useResearchStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";

const TypeChip = ({ name, image }) => (
  <span className="type-chip">
    {image ? <img src={image} alt={name} /> : null}
    <span>{name}</span>
  </span>
);

const BerriesView = () => {
  const berries = useResearchStore((state) => state.berries);
  const pokemonTypes = useResearchStore((state) => state.pokemonTypes);
  const pokedex = usePokedexStore((state) => state.pokedex);
  const { settings, updateSettings } = useSettingsStore();
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && settings && settings.version) {
      initializedRef.current = true;
      if (settings.berrySortBy !== undefined) {
        setSortBy(settings.berrySortBy);
      }
      if (settings.berrySortDirection !== undefined) {
        setSortDirection(settings.berrySortDirection);
      }
    }
  }, [settings]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    const timeoutId = setTimeout(async () => {
      await updateSettings({
        berrySortBy: sortBy,
        berrySortDirection: sortDirection
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [sortBy, sortDirection, updateSettings]);

  const berryStats = useMemo(() => {
    const pokemonCountByName = new Map();

    pokedex.forEach((species) => {
      const seenBerryNames = new Set();
      (species.variants || []).forEach((variant) => {
        (variant.berries || []).forEach((berry) => {
          if (!berry?.name || seenBerryNames.has(berry.name)) {
            return;
          }
          seenBerryNames.add(berry.name);
          pokemonCountByName.set(
            berry.name,
            (pokemonCountByName.get(berry.name) || 0) + 1
          );
        });
      });
    });

    return berries.map((berry) => ({
      ...berry,
      pokemonCount: pokemonCountByName.get(berry.name) || 0
    }));
  }, [berries, pokedex]);

  const typeImageByName = useMemo(
    () =>
      new Map(
        pokemonTypes.map((type) => [type.name, type.image_path || null])
      ),
    [pokemonTypes]
  );

  const sortedBerries = useMemo(() => {
    return [...berryStats].sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case "pokemon":
          compareValue = a.pokemonCount - b.pokemonCount;
          break;
        case "name":
        default:
          compareValue = a.name.localeCompare(b.name);
          break;
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });
  }, [berryStats, sortBy, sortDirection]);

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Berries</p>
        <h2>Catalog</h2>
        <p className="subhead">{berryStats.length} berries</p>
      </header>
      <section className="card">
        <div className="section-header">
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="box-sort" style={{ position: "relative" }}>
              <button
                className="box-sort-button button ghost"
                onClick={() => setShowSortMenu(!showSortMenu)}
              >
                Sort: {sortBy === "name" ? "Name" : "Pokemon"}
              </button>
              {showSortMenu && (
                <div className="box-sort-menu">
                  {[
                    { label: "Name", value: "name" },
                    { label: "Pokemon", value: "pokemon" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      className="box-sort-option"
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="box-sort-direction icon-button"
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              {sortDirection === "asc" ? <IoArrowUp /> : <IoArrowDown />}
            </button>
          </div>
        </div>
        <div className="ingredient-table">
          <div className="ingredient-row header">
            <div>Name</div>
            <div>Type</div>
            <div>Pokemon</div>
          </div>
          {sortedBerries.map((berry) => (
            <div key={berry.id} className="ingredient-row">
              <div className="ingredient-name">
                <img
                  className="ingredient-preview"
                  src={
                    berry.image_path ||
                    `/uploads/berries/${berry.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "")}.png`
                  }
                  alt={berry.name}
                />
                <span className="ingredient-link">{berry.name}</span>
              </div>
              <div>
                {berry.type ? (
                  <TypeChip
                    name={berry.type}
                    image={typeImageByName.get(berry.type) || null}
                  />
                ) : (
                  <span className="meta">—</span>
                )}
              </div>
              <div>{berry.pokemonCount}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default BerriesView;
