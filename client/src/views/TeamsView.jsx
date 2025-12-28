import { useEffect, useMemo, useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import useDishesStore from "../stores/useDishesStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useResearchStore from "../stores/useResearchStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import { apiFetch } from "../utils/api.js";
import { pickTeam, scoreAll } from "../utils/teamScoring.ts";

// Feature flag: set to true to use backend recommendation endpoint
const USE_BACKEND_RECOMMENDATION = true;
const PAGE_SIZE = 5;

const TeamsView = () => {
  const { dishes } = useDishesStore();
  const { pokemonBox } = usePokemonBoxStore();
  const { researchAreas, berries } = useResearchStore();
  const { settings } = useSettingsStore();
  const [speciesMap, setSpeciesMap] = useState({});
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [backendScores, setBackendScores] = useState(null);
  const [backendDebug, setBackendDebug] = useState(null);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);


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

  useEffect(() => {
    if (!USE_BACKEND_RECOMMENDATION) {
      return;
    }
    setPageOffset(0);
    setBackendScores(null);
  }, [
    settings.version,
    settings.preference,
    settings.eventTypes,
    settings.selectedDishIds
  ]);

  // Fetch recommendations from backend when enabled
  useEffect(() => {
    if (!USE_BACKEND_RECOMMENDATION) {
      return;
    }
    let isMounted = true;
    const fetchRecommendations = async () => {
      setIsLoadingBackend(true);
      try {
        const debug =
          new URLSearchParams(window.location.search).get("debug") === "1";
        const query = new URLSearchParams();
        query.set("limit", String(PAGE_SIZE));
        query.set("offset", String(pageOffset));
        if (debug) {
          query.set("debug", "1");
        }
        const response = await apiFetch(
          `/api/teams/recommendation?${query.toString()}`,
          { method: "POST" }
        );
        if (!isMounted) {
          return;
        }
        const items = response.items || response.allScores || [];
        setBackendScores((prev) =>
          pageOffset === 0 ? items : [...(prev || []), ...items]
        );
        setHasMore(Boolean(response.hasMore));
        if (debug && response.debug) {
          setBackendDebug(response.debug);
          console.log("Backend recommendation debug:", response.debug);
        }
      } catch (error) {
        console.error("Failed to fetch backend recommendations:", error);
      } finally {
        if (isMounted) {
          setIsLoadingBackend(false);
        }
      }
    };
    fetchRecommendations();
    return () => {
      isMounted = false;
    };
  }, [
    pageOffset,
    pokemonBox.length,
    settings.version,
    settings.preference,
    settings.eventTypes,
    settings.selectedDishIds
  ]);

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
          mainSkillName: variant.mainSkills?.[0]?.name || "",
          mainSkillEffectType: variant.mainSkills?.[0]?.effectType || ""
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

  const entriesWithTypes = useMemo(
    () =>
      pokemonBox.map((entry) => {
        const species = speciesMap[entry.species_id];
        if (!species) {
          return entry;
        }
        return {
          ...entry,
          primary_type: species.primary_type || entry.primary_type,
          secondary_type: species.secondary_type || entry.secondary_type
        };
      }),
    [pokemonBox, speciesMap]
  );

  const scores = useMemo(() => {
    // Use backend scores if available and enabled
    if (USE_BACKEND_RECOMMENDATION && backendScores) {
      return backendScores;
    }
    
    // Fallback to frontend scoring
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
      entriesWithTypes,
      variantById,
      scoringSettings,
      berryMap,
      ingredientDemand
    );
  }, [
    backendScores,
    entriesWithTypes,
    variantById,
    settings.eventTypes,
    settings.eventBuffs,
    settings.selectedDishIds,
    settings.weights,
    settings.preference,
    berryMap,
    ingredientDemand,
    highlightBerryNames
  ]);

  const recommendedTeam = useMemo(
    () => (USE_BACKEND_RECOMMENDATION ? scores : pickTeam(scores)),
    [scores]
  );

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
        {backendDebug && (
          <div style={{ 
            marginTop: "1rem", 
            padding: "0.75rem", 
            background: "#f0f9ff", 
            border: "1px solid #0ea5e9",
            borderRadius: "4px",
            fontSize: "0.875rem"
          }}>
            <strong>🔧 Debug Mode:</strong> {backendDebug.algorithm_version}
            <br />
            <strong>Settings:</strong> {backendDebug.effectiveSettings.preference || "default"} 
            {" • "}Event Types: {backendDebug.effectiveSettings.eventTypes.join(", ") || "none"}
            {" • "}Pokémon: {backendDebug.pokemonCount}
            <br />
            <strong>Weights:</strong> {JSON.stringify(backendDebug.effectiveSettings.weights)}
          </div>
        )}
        {USE_BACKEND_RECOMMENDATION && !backendDebug && (
          <p style={{ fontSize: "0.875rem", marginTop: "0.5rem", color: "#666" }}>
            ⚙️ Using backend recommendation engine
          </p>
        )}
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
                  {row.entry.variant_image_path || row.entry.species_image_path ? (
                    <img
                      src={
                        row.entry.is_shiny
                          ? row.entry.variant_shiny_image_path ||
                            row.entry.variant_image_path ||
                            row.entry.species_image_path ||
                            ""
                          : row.entry.variant_image_path ||
                            row.entry.species_image_path ||
                            ""
                      }
                      alt={row.entry.variant_name || row.entry.species_name}
                    />
                  ) : (
                    <div className="img-placeholder" aria-hidden="true" />
                  )}
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
                  {(row.breakdown.totalScoreNormalized ?? row.breakdown.totalScore).toFixed(3)}
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
                      • Triggers/day:{" "}
                      {row.breakdown.details.expectedTriggers.toFixed(1)}{" "}
                      • Berry EV: {row.breakdown.details.berryEV.toFixed(1)} •{" "}
                      Ingredient EV:{" "}
                      {row.breakdown.details.ingredientEV.toFixed(1)} • Skill EV:{" "}
                      {row.breakdown.details.skillEV.toFixed(1)} • Cooking EV:{" "}
                      {row.breakdown.details.cookingEV.toFixed(1)} • Skill value:{" "}
                      {row.breakdown.details.skillValueUsed.toFixed(1)} • Raw total:{" "}
                      {row.breakdown.totalScore.toFixed(1)} • Normalized:{" "}
                      {row.breakdown.totalScoreNormalized?.toFixed?.(3) || "0.000"}
                      {row.breakdown.details.typesUsed.length ? (
                        <>
                          {" "}
                          • Types: {row.breakdown.details.typesUsed.join(" / ")}{" "}
                          • Buffed:{" "}
                          {row.breakdown.details.isBuffedType ? "yes" : "no"} •
                          Trigger mult:{" "}
                          {row.breakdown.details.triggerMultiplierApplied.toFixed(2)}
                        </>
                      ) : null}
                      {row.breakdown.details.deltaP > 0 ? (
                        <>
                          {" "}
                          • Extra Tasty ΔP:{" "}
                          {(row.breakdown.details.deltaP * 100).toFixed(1)}% • Trigger
                          rate: {row.breakdown.details.triggerRateUsed.toFixed(2)} •
                          Trigger mult:{" "}
                          {row.breakdown.details.triggerMultiplierUsed.toFixed(2)} •
                          Base dish:{" "}
                          {row.breakdown.details.baseDishStrengthUsed.toFixed(1)} •
                          Extra Tasty EV:{" "}
                          {row.breakdown.details.extraTastyEVPerDay.toFixed(1)} •
                          Extra Tasty meals:{" "}
                          {row.breakdown.details.expectedExtraTastyMealsPerDay?.toFixed?.(
                            2
                          ) || "0.00"}
                          {" • "}pUsed:{" "}
                          {(row.breakdown.details.pUsed * 100).toFixed(1)}% •
                          Mult/meal:{" "}
                          {row.breakdown.details.expectedMultiplierPerMeal?.toFixed?.(
                            2
                          ) || "0.00"}
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {USE_BACKEND_RECOMMENDATION && hasMore ? (
          <div style={{ marginTop: "1rem" }}>
            <button
              className="button"
              type="button"
              disabled={isLoadingBackend}
              onClick={() => setPageOffset((prev) => prev + PAGE_SIZE)}
            >
              {isLoadingBackend ? "Loading..." : "Load next 5"}
            </button>
          </div>
        ) : null}
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
                <p className="meta">
                  Unlocked:{" "}
                  {selectedRow.entry.unlocked_ingredients?.length
                    ? selectedRow.entry.unlocked_ingredients
                        .map(
                          (item) =>
                            `${item.name} (Lv ${item.unlock_level || item.unlockLevel || "?"})`
                        )
                        .join(", ")
                    : "—"}
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
                <p className="meta">
                  Skill value:{" "}
                  {selectedRow.breakdown.details.skillValueUsed.toFixed(1)}
                </p>
                <p className="meta">
                  Triggers/day:{" "}
                  {selectedRow.breakdown.details.expectedTriggers.toFixed(1)}
                </p>
                <p className="meta">
                  Types: {selectedRow.breakdown.details.typesUsed.join(" / ") || "—"} •
                  Buffed: {selectedRow.breakdown.details.isBuffedType ? "yes" : "no"} •
                  Trigger mult:{" "}
                  {selectedRow.breakdown.details.triggerMultiplierApplied.toFixed(2)}
                </p>
                {selectedRow.breakdown.details.deltaP > 0 ? (
                  <p className="meta">
                    Extra Tasty ΔP:{" "}
                    {(selectedRow.breakdown.details.deltaP * 100).toFixed(1)}% •
                    Trigger rate:{" "}
                    {selectedRow.breakdown.details.triggerRateUsed.toFixed(2)} •
                    Trigger mult:{" "}
                    {selectedRow.breakdown.details.triggerMultiplierUsed.toFixed(2)}
                  </p>
                ) : null}
                <p className="meta">
                  Weekly dish: {selectedRow.breakdown.details.weekDishType || "—"} •
                  Pot size: {selectedRow.breakdown.details.potSize || "—"} •
                  Area bonus: {selectedRow.breakdown.details.areaBonus || "—"} •
                  Day: {selectedRow.breakdown.details.dayOfWeek || "—"}
                </p>
                <p className="meta">
                  Best dish: {selectedRow.breakdown.details.bestDishName || "—"} •
                  Meals/day: {selectedRow.breakdown.details.mealsPerDay || "—"} •
                  Base dish:{" "}
                  {selectedRow.breakdown.details.baseDishStrengthUsed.toFixed(1)} •
                  Dish level:{" "}
                  {selectedRow.breakdown.details.dishLevelUsed || "—"} •
                  Dish value:{" "}
                  {selectedRow.breakdown.details.dishLevelValueUsed.toFixed(1)} •
                  Extra Tasty EV:{" "}
                  {selectedRow.breakdown.details.extraTastyEVPerDay.toFixed(1)}
                </p>
                <p className="meta">
                  Extras: {selectedRow.breakdown.details.extraSlotsUsed || 0} /{" "}
                  {selectedRow.breakdown.details.recipeRequiredCount || 0} •
                  Extra base sum:{" "}
                  {selectedRow.breakdown.details.extraBaseStrengthSum.toFixed(1)} •
                  After area:{" "}
                  {selectedRow.breakdown.details.afterArea.toFixed(1)} •
                  Per-day:{" "}
                  {selectedRow.breakdown.details.expectedDishStrengthPerDay.toFixed(
                    1
                  )}
                </p>
                <p className="meta">
                  Extra Tasty meals:{" "}
                  {selectedRow.breakdown.details.expectedExtraTastyMealsPerDay?.toFixed?.(
                    2
                  ) || "0.00"}{" "}
                  • Mult/meal:{" "}
                  {selectedRow.breakdown.details.expectedMultiplierPerMeal?.toFixed?.(
                    2
                  ) || "0.00"}{" "}
                  • Mult/day:{" "}
                  {selectedRow.breakdown.details.expectedMultiplierSum?.toFixed?.(
                    2
                  ) || "0.00"}{" "}
                  • Tasty mult:{" "}
                  {selectedRow.breakdown.details.tastyMultiplierUsed || "—"}{" "}
                  ({selectedRow.breakdown.details.tastyMultiplierSource || "—"})
                </p>
                <p className="meta">
                  ΔP/trigger:{" "}
                  {(selectedRow.breakdown.details.deltaPPerTrigger * 100).toFixed(1)}% •
                  ΔP/meal:{" "}
                  {(selectedRow.breakdown.details.deltaPPerMeal * 100).toFixed(2)}% •
                  Base chance:{" "}
                  {(selectedRow.breakdown.details.baseChanceUsed * 100).toFixed(1)}% •
                  Cap:{" "}
                  {(selectedRow.breakdown.details.capUsed * 100).toFixed(0)}%
                </p>
                {selectedRow.breakdown.reasons.map((reason, index) => (
                  <p key={`detail-reason-${index}`} className="meta">
                    {reason}
                  </p>
                ))}
              </div>
              <div>
                <h4>Pokemon</h4>
                <p className="meta">
                  Level: {selectedRow.entry.level} • Nature:{" "}
                  {selectedRow.entry.nature_name || "—"}
                </p>
                <p className="meta">
                  Types:{" "}
                  {selectedRow.breakdown.details.typesUsed.join(" / ") || "—"} •
                  Event variant:{" "}
                  {selectedRow.entry.is_event_variant ? "yes" : "no"}
                </p>
                <p className="meta">
                  Carry limit: {selectedRow.entry.carry_limit ?? "—"}
                </p>
                <p className="meta">
                  Main skill: {selectedRow.entry.main_skill_name || "—"}{" "}
                  {selectedRow.entry.main_skill_effect_type
                    ? `(${selectedRow.entry.main_skill_effect_type})`
                    : ""}
                </p>
                <p className="meta">
                  Skill level: {selectedRow.breakdown.details.baseMainSkillLevel} →{" "}
                  {selectedRow.breakdown.details.effectiveMainSkillLevel} (max{" "}
                  {selectedRow.breakdown.details.maxMainSkillLevel}) • Mode:{" "}
                  {selectedRow.breakdown.details.skillValueMode} • Branch:{" "}
                  {selectedRow.breakdown.details.skillBranchUsed || "default"}
                </p>
                <p className="meta">
                  Trigger rate:{" "}
                  {Number.isFinite(selectedRow.entry.main_skill_trigger_rate)
                    ? selectedRow.entry.main_skill_trigger_rate.toFixed(2)
                    : "—"}
                </p>
                <p className="meta">
                  Berries:{" "}
                  {selectedRow.entry.berries?.length
                    ? selectedRow.entry.berries
                        .map((item) => `${item.name} x ${item.quantity || 1}`)
                        .join(", ")
                    : "—"}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default TeamsView;
