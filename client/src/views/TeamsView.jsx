import { useEffect, useMemo, useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import useDishesStore from "../stores/useDishesStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useResearchStore from "../stores/useResearchStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import { apiFetch } from "../utils/api.js";
import { pickTeam, scoreAll } from "../utils/teamScoring.ts";

const TeamsView = () => {
  const { dishes } = useDishesStore();
  const { pokemonBox } = usePokemonBoxStore();
  const { researchAreas, berries } = useResearchStore();
  const { settings } = useSettingsStore();
  const [detailMap, setDetailMap] = useState({});
  const [speciesMap, setSpeciesMap] = useState({});
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      const missing = pokemonBox.filter((entry) => !detailMap[entry.id]);
      if (missing.length === 0) {
        return;
      }
      const results = await Promise.all(
        missing.map((entry) =>
          apiFetch(`/api/pokemon-box/${entry.id}/details`).catch(
            () => null
          )
        )
      );
      if (!isMounted) {
        return;
      }
      const next = { ...detailMap };
      results.forEach((detail) => {
        if (detail?.entry?.id) {
          next[detail.entry.id] = detail;
        }
      });
      setDetailMap(next);
    };
    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [pokemonBox, detailMap]);

  useEffect(() => {
    let isMounted = true;
    const fetchSpecies = async () => {
      const ids = Array.from(
        new Set(pokemonBox.map((entry) => entry.species_id))
      );
      const missing = ids.filter((id) => !speciesMap[id]);
      if (missing.length === 0) {
        return;
      }
      const results = await Promise.all(
        missing.map((id) =>
          apiFetch(`/api/pokedex/${id}`).catch(() => null)
        )
      );
      if (!isMounted) {
        return;
      }
      const next = { ...speciesMap };
      results.forEach((species) => {
        if (species?.id) {
          next[species.id] = species;
        }
      });
      setSpeciesMap(next);
    };
    fetchSpecies();
    return () => {
      isMounted = false;
    };
  }, [pokemonBox, speciesMap]);

  const highlightBerryNames = useMemo(() => {
    const currentArea = researchAreas.find((area) => area.is_default);
    if (!currentArea) {
      return [];
    }
    const berryNameMap = new Map(
      berries.map((berry) => [berry.id, berry.name])
    );
    return (currentArea.favorites || [])
      .map((entry) => berryNameMap.get(entry.berry_id))
      .filter(Boolean);
  }, [researchAreas, berries]);

  const ingredientDemand = useMemo(() => {
    const selected = settings.selectedDishIds || [];
    if (!selected.length) {
      return new Map();
    }
    const map = new Map();
    dishes
      .filter((dish) => selected.includes(dish.id))
      .forEach((dish) => {
        (dish.ingredients || []).forEach((ingredient) => {
          const key = ingredient.name.toLowerCase();
          map.set(key, (map.get(key) || 0) + ingredient.quantity);
        });
      });
    return map;
  }, [dishes, settings.selectedDishIds]);

  const variantById = useMemo(() => {
    const map = new Map();
    Object.values(speciesMap).forEach((species) => {
      (species.variants || []).forEach((variant) => {
        map.set(variant.id, {
          ...variant,
          mainSkillName: variant.mainSkills?.[0]?.name || ""
        });
      });
    });
    return map;
  }, [speciesMap]);

  const berryMap = useMemo(() => {
    return new Map(
      berries.map((berry) => [berry.name.toLowerCase(), berry])
    );
  }, [berries]);

  const scores = useMemo(() => {
    const scoringSettings = {
      favoriteBerries: highlightBerryNames,
      eventTypes: settings.eventTypes || [],
      eventBuffs: settings.eventBuffs || {
        ingredientBonus: true,
        skillTriggerBonus: true,
        skillStrengthBonus: true,
        dreamShardMagnetBonus: true
      },
      selectedDishIds: settings.selectedDishIds || [],
      weights: settings.weights
    };
    return scoreAll(
      pokemonBox,
      variantById,
      scoringSettings,
      berryMap,
      ingredientDemand
    );
  }, [
    pokemonBox,
    variantById,
    settings.eventTypes,
    settings.eventBuffs,
    settings.selectedDishIds,
    settings.weights,
    berryMap,
    ingredientDemand,
    highlightBerryNames
  ]);

  const recommendedTeam = useMemo(() => pickTeam(scores), [scores]);

  const selectedRow = scores.find(
    (row) => row.entry.id === selectedEntryId
  );

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Team Builder</p>
        <h2>Recommendation</h2>
        <p className="subhead">
          Ranked by growth, ingredient focus, and dream shard impact.
        </p>
      </header>
      <section className="card">
        {recommendedTeam.length === 0 ? (
          <p className="empty">No Pokemon in the box yet.</p>
        ) : (
          <div className="team-table">
            <div className="team-row header">
              <div>Pokemon</div>
              <div>Berry</div>
              <div>Ingredients</div>
              <div>Skill</div>
              <div>Cooking</div>
              <div>Total</div>
              <div>Why?</div>
            </div>
            {recommendedTeam.map((row) => (
              <div key={row.entry.id}>
                <div className="team-row">
                <div className="team-preview">
                  {row.entry.variant_image_path ? (
                    <img
                      src={
                        row.entry.is_shiny
                          ? row.entry.variant_shiny_image_path ||
                            row.entry.variant_image_path.replace(
                              /\.png$/i,
                              "-shiny.png"
                            )
                          : row.entry.variant_image_path
                      }
                      alt={row.entry.variant_name || row.entry.species_name}
                    />
                  ) : null}
                  <div>
                    <strong>
                      {row.entry.nickname || row.entry.species_name}
                    </strong>
                    <p className="meta">
                      {row.entry.variant_name || row.entry.species_name}
                    </p>
                  </div>
                </div>
                <div>{row.breakdown.berryScore.toFixed(1)}</div>
                <div>{row.breakdown.ingredientScore.toFixed(1)}</div>
                <div>{row.breakdown.skillScore.toFixed(1)}</div>
                <div>{row.breakdown.cookingScore.toFixed(1)}</div>
                <div className="team-total">
                  {row.breakdown.totalScore.toFixed(1)}
                </div>
                <div>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => ({
                        ...prev,
                        [row.entry.id]: !prev[row.entry.id]
                      }))
                    }
                  >
                    {expandedIds[row.entry.id] ? "Hide" : "Why?"}
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setSelectedEntryId(row.entry.id)}
                  >
                    Details
                  </button>
                </div>
                </div>
                {expandedIds[row.entry.id] ? (
                  <div className="team-row-detail">
                    <div>
                      {row.breakdown.reasons.length === 0 ? (
                        <p className="meta">No reasons yet.</p>
                      ) : (
                        row.breakdown.reasons.map((reason, index) => (
                          <p key={`${row.entry.id}-reason-${index}`} className="meta">
                            {reason}
                          </p>
                        ))
                      )}
                    </div>
                    <div className="meta">
                      Helps/day: {row.breakdown.details.expectedHelps.toFixed(1)}{" "}
                      • Berry EV: {row.breakdown.details.berryEV.toFixed(1)} •{" "}
                      Ingredient EV:{" "}
                      {row.breakdown.details.ingredientEV.toFixed(1)} • Skill EV:{" "}
                      {row.breakdown.details.skillEV.toFixed(1)} • Cooking EV:{" "}
                      {row.breakdown.details.cookingEV.toFixed(1)}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      {selectedRow ? (
        <div className="bag-modal">
          <section className="card">
            <header className="section-header bag-header">
              <div>
                <h2>
                  {selectedRow.entry.nickname ||
                    selectedRow.entry.species_name}
                </h2>
                <p className="meta">
                  {selectedRow.entry.variant_name ||
                    selectedRow.entry.species_name}
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedEntryId(null)}
                aria-label="Close details"
              >
                <IoCloseOutline size={20} />
              </button>
            </header>
            <div className="team-detail-grid">
              <div>
                <h4>Berry</h4>
                <p className="meta">
                  Score: {selectedRow.breakdown.berryScore.toFixed(1)}
                </p>
                <p className="meta">
                  Berry EV: {selectedRow.breakdown.details.berryEV.toFixed(1)}
                </p>
                <p className="meta">
                  Helps/day:{" "}
                  {selectedRow.breakdown.details.expectedHelps.toFixed(1)}
                </p>
              </div>
              <div>
                <h4>Ingredients</h4>
                <p className="meta">
                  Score:{" "}
                  {selectedRow.breakdown.ingredientScore.toFixed(1)}
                </p>
                <p className="meta">
                  Ingredient EV:{" "}
                  {selectedRow.breakdown.details.ingredientEV.toFixed(1)}
                </p>
              </div>
              <div>
                <h4>Skills + Cooking</h4>
                <p className="meta">
                  Skill score:{" "}
                  {selectedRow.breakdown.skillScore.toFixed(1)}
                </p>
                <p className="meta">
                  Cooking score:{" "}
                  {selectedRow.breakdown.cookingScore.toFixed(1)}
                </p>
                {selectedRow.breakdown.reasons.map((reason, index) => (
                  <p key={`detail-reason-${index}`} className="meta">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default TeamsView;
