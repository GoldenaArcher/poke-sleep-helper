import { useEffect, useMemo, useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import SearchSelect from "./SearchSelect.jsx";
import { findByName } from "../utils/text.js";

const ResearchAreasModal = ({
  researchAreas,
  berries,
  pokemonTypes,
  subSkills,
  dishes,
  settings,
  updateSettings,
  currentAreaName,
  setCurrentAreaName,
  setDefaultArea,
  updateAreaFavorites,
  onClose
}) => {
  const [dishSearch, setDishSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [goalPreset, setGoalPreset] = useState(
    settings.preference || "custom"
  );
  const selectedDishIds = settings.selectedDishIds || [];
  const eventTypes = settings.eventTypes || [];
  const eventBuffs = settings.eventBuffs || {};
  const eventSubSkillIds = settings.eventSubSkillIds || [];
  const eventSubSkillMultiplier = settings.eventSubSkillMultiplier || 2;
  const useCustomEventMultipliers =
    Boolean(settings.eventUseCustomMultipliers);
  const eventSkillTriggerRateMultiplier =
    settings.eventSkillTriggerRateMultiplier ?? 1;
  const eventIngredientMultiplier = settings.eventIngredientMultiplier ?? 1;
  const eventSkillStrengthMultiplier = settings.eventSkillStrengthMultiplier ?? 1;
  const eventSkillLevelPlusOneOnTrigger =
    Boolean(settings.eventSkillLevelPlusOneOnTrigger);
  const areaBonus = settings.areaBonus ?? 1;
  const selectedDishes = useMemo(
    () => dishes.filter((dish) => selectedDishIds.includes(dish.id)),
    [dishes, selectedDishIds]
  );
  const selectedTypes = useMemo(
    () =>
      pokemonTypes.filter((type) => eventTypes.includes(type.name)),
    [pokemonTypes, eventTypes]
  );
  const selectedSubSkills = useMemo(
    () => subSkills.filter((skill) => eventSubSkillIds.includes(skill.id)),
    [subSkills, eventSubSkillIds]
  );

  const addDish = () => {
    const match = findByName(dishes, dishSearch);
    if (!match || selectedDishIds.includes(match.id)) {
      return;
    }
    updateSettings({
      selectedDishIds: [...selectedDishIds, match.id]
    });
    setDishSearch("");
  };

  const addType = () => {
    const match = findByName(pokemonTypes, typeSearch);
    if (!match || eventTypes.includes(match.name)) {
      return;
    }
    updateSettings({
      eventTypes: [...eventTypes, match.name]
    });
    setTypeSearch("");
  };

  const [subSkillSearch, setSubSkillSearch] = useState("");
  const addSubSkill = () => {
    const match = findByName(subSkills, subSkillSearch);
    if (!match || eventSubSkillIds.includes(match.id)) {
      return;
    }
    updateSettings({
      eventSubSkillIds: [...eventSubSkillIds, match.id]
    });
    setSubSkillSearch("");
  };

  const goalPresets = {
    balanced: { berry: 0.45, ingredient: 0.35, cooking: 0.15, dreamShard: 0.05 },
    growth: { berry: 0.65, ingredient: 0.2, cooking: 0.1, dreamShard: 0.05 },
    ingredient: { berry: 0.25, ingredient: 0.55, cooking: 0.15, dreamShard: 0.05 },
    cooking: { berry: 0.35, ingredient: 0.25, cooking: 0.35, dreamShard: 0.05 }
  };
  const applyEventDefaults = (nextBuffs) => {
    if (useCustomEventMultipliers) {
      return;
    }
    updateSettings({
      eventSkillTriggerRateMultiplier: nextBuffs.skillTriggerBonus ? 1.25 : 1,
      eventIngredientMultiplier: nextBuffs.ingredientBonus ? 1.1 : 1,
      eventSkillStrengthMultiplier: nextBuffs.skillStrengthBonus ? 3 : 1
    });
  };

  useEffect(() => {
    setGoalPreset(settings.preference || "custom");
  }, [settings.preference]);

  return (
    <div className="bag-modal">
      <section className="card">
        <header className="section-header bag-header">
          <div>
            <h2>Research Setup</h2>
            <p className="meta">
              Configure your island, highlight berries, and event focus.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close research setup"
          >
            <IoCloseOutline size={20} />
          </button>
        </header>
        <div className="research-grid">
          <div className="area-row">
            <div className="highlight-title">Preference / Goal</div>
            <label>
              <select
                value={goalPreset}
                onChange={(event) => {
                  const value = event.target.value;
                  setGoalPreset(value);
                  const preset = goalPresets[value];
                  if (preset) {
                    updateSettings({ preference: value, weights: preset });
                  } else {
                    updateSettings({ preference: "custom" });
                  }
                }}
              >
                <option value="balanced">Balanced</option>
                <option value="growth">Growth Focus</option>
                <option value="ingredient">Ingredient Focus</option>
                <option value="cooking">Cooking Focus</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>
          <div className="area-row">
            <div className="highlight-title">Current research area</div>
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
              <label className="inline-field">
                <span className="meta">Area bonus</span>
                <input
                  type="number"
                  step="0.05"
                  value={areaBonus}
                  onChange={(event) =>
                    updateSettings({
                      areaBonus: Number(event.target.value || 1)
                    })
                  }
                />
              </label>
            </div>
          </div>
          <div className="area-row">
            <div className="highlight-title">Event types</div>
            <div className="dish-select">
              <SearchSelect
                value={typeSearch}
                placeholder="Select buffed type"
                options={pokemonTypes.map((type) => type.name)}
                listId="event-type-options"
                onChange={(event) => setTypeSearch(event.target.value)}
              />
              <button className="button ghost" type="button" onClick={addType}>
                Add type
              </button>
            </div>
            {selectedTypes.length === 0 ? (
              <p className="meta">No event types selected.</p>
            ) : (
              <div className="chip-group">
                {selectedTypes.map((type) => (
                  <button
                    key={type.id}
                    className="chip removable"
                    type="button"
                    onClick={() =>
                      updateSettings({
                        eventTypes: eventTypes.filter(
                          (name) => name !== type.name
                        )
                      })
                    }
                  >
                    {type.image_path ? (
                      <img src={type.image_path} alt={type.name} />
                    ) : null}
                    {type.name}
                    <span className="chip-remove">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="area-row span-2 highlight">
            <div className="highlight-title">Highlight berries</div>
            <div className="berry-selects">
              {[1, 2, 3].map((slot) => {
                const currentArea = researchAreas.find(
                  (area) => area.is_default
                );
                const favorite =
                  currentArea?.favorites?.find((entry) => entry.slot === slot)
                    ?.berry_id || null;
                const favoriteBerry =
                  berries.find((berry) => berry.id === favorite) || null;
                const favoriteName = favoriteBerry?.name || "";
                return (
                  <label key={slot}>
                    Fav {slot}
                    <div className="berry-picker">
                      <div className="berry-preview">
                        {favoriteBerry?.image_path ? (
                          <img
                            src={favoriteBerry.image_path}
                            alt={favoriteBerry.name}
                          />
                        ) : (
                          <span className="meta">No image</span>
                        )}
                      </div>
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
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="area-row">
            <div className="highlight-title">Event buffs</div>
            <div className="event-buffs">
              <label className="checkbox-field">
                Extra ingredient per help
                <input
                  type="checkbox"
                  checked={Boolean(eventBuffs.ingredientBonus)}
                  onChange={(event) =>
                    (() => {
                      const nextBuffs = {
                        ...eventBuffs,
                        ingredientBonus: event.target.checked
                      };
                      updateSettings({ eventBuffs: nextBuffs });
                      applyEventDefaults(nextBuffs);
                    })()
                  }
                />
              </label>
              <label className="checkbox-field">
                Skill trigger rate x1.25
                <input
                  type="checkbox"
                  checked={Boolean(eventBuffs.skillTriggerBonus)}
                  onChange={(event) =>
                    (() => {
                      const nextBuffs = {
                        ...eventBuffs,
                        skillTriggerBonus: event.target.checked
                      };
                      updateSettings({ eventBuffs: nextBuffs });
                      applyEventDefaults(nextBuffs);
                    })()
                  }
                />
              </label>
              <label className="checkbox-field">
                Skill strength x3
                <input
                  type="checkbox"
                  checked={Boolean(eventBuffs.skillStrengthBonus)}
                  onChange={(event) =>
                    (() => {
                      const nextBuffs = {
                        ...eventBuffs,
                        skillStrengthBonus: event.target.checked
                      };
                      updateSettings({ eventBuffs: nextBuffs });
                      applyEventDefaults(nextBuffs);
                    })()
                  }
                />
              </label>
              <label className="checkbox-field">
                Dream Shard Magnet x2
                <input
                  type="checkbox"
                  checked={Boolean(eventBuffs.dreamShardMagnetBonus)}
                  onChange={(event) =>
                    updateSettings({
                      eventBuffs: {
                        ...eventBuffs,
                        dreamShardMagnetBonus: event.target.checked
                      }
                    })
                  }
                />
              </label>
              <label className="checkbox-field">
                Main skill level +1 on trigger
                <input
                  type="checkbox"
                  checked={eventSkillLevelPlusOneOnTrigger}
                  onChange={(event) =>
                    updateSettings({
                      eventSkillLevelPlusOneOnTrigger: event.target.checked
                    })
                  }
                />
              </label>
            </div>
            <div className="event-subskills">
              <label className="checkbox-field">
                Use custom event multipliers
                <input
                  type="checkbox"
                  checked={useCustomEventMultipliers}
                  onChange={(event) =>
                    (() => {
                      const nextValue = event.target.checked;
                      updateSettings({
                        eventUseCustomMultipliers: nextValue
                      });
                      if (!nextValue) {
                        applyEventDefaults(eventBuffs);
                      }
                    })()
                  }
                />
              </label>
              {useCustomEventMultipliers ? (
                <div className="inline-fields compact">
                  <label className="inline-field">
                    <span className="meta">Skill trigger mult</span>
                    <input
                      type="number"
                      step="0.05"
                      value={eventSkillTriggerRateMultiplier}
                      onChange={(event) =>
                        updateSettings({
                          eventSkillTriggerRateMultiplier: Number(
                            event.target.value || 1
                          )
                        })
                      }
                    />
                  </label>
                  <label className="inline-field">
                    <span className="meta">Ingredient mult</span>
                    <input
                      type="number"
                      step="0.05"
                      value={eventIngredientMultiplier}
                      onChange={(event) =>
                        updateSettings({
                          eventIngredientMultiplier: Number(
                            event.target.value || 1
                          )
                        })
                      }
                    />
                  </label>
                  <label className="inline-field">
                    <span className="meta">Skill strength mult</span>
                    <input
                      type="number"
                      step="0.1"
                      value={eventSkillStrengthMultiplier}
                      onChange={(event) =>
                        updateSettings({
                          eventSkillStrengthMultiplier: Number(
                            event.target.value || 1
                          )
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>
            <div className="event-subskills">
              <div className="subskill-controls">
                <SearchSelect
                  value={subSkillSearch}
                  placeholder="Select boosted sub skill"
                  options={subSkills.map((skill) => skill.name)}
                  listId="event-sub-skill-options"
                  onChange={(event) => setSubSkillSearch(event.target.value)}
                />
                <button
                  className="button ghost"
                  type="button"
                  onClick={addSubSkill}
                >
                  Add sub skill
                </button>
              </div>
              {selectedSubSkills.length === 0 ? (
                <p className="meta">No sub skills selected.</p>
              ) : (
                <div className="chip-group">
                  {selectedSubSkills.map((skill) => (
                    <button
                      key={skill.id}
                      className="chip removable"
                      type="button"
                      onClick={() =>
                        updateSettings({
                          eventSubSkillIds: eventSubSkillIds.filter(
                            (id) => id !== skill.id
                          )
                        })
                      }
                    >
                      {skill.name}
                      <span className="chip-remove">×</span>
                    </button>
                  ))}
                </div>
              )}
              <label className="inline-field">
                <span className="meta">Sub skill multiplier</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={eventSubSkillMultiplier}
                  onChange={(event) =>
                    updateSettings({
                      eventSubSkillMultiplier: Number(event.target.value || 1)
                    })
                  }
                />
              </label>
            </div>
          </div>
          <div className="area-row">
            <div className="highlight-title">Dish focus</div>
            <div className="dish-select">
              <SearchSelect
                value={dishSearch}
                placeholder="Search dishes to focus"
                options={dishes.map((dish) => dish.name)}
                listId="dish-options"
                onChange={(event) => setDishSearch(event.target.value)}
              />
              <button className="button ghost" type="button" onClick={addDish}>
                Add dish
              </button>
            </div>
            {selectedDishes.length === 0 ? (
              <p className="meta">No dishes selected yet.</p>
            ) : (
              <div className="chip-group">
                {selectedDishes.map((dish) => (
                  <button
                    key={dish.id}
                    className="chip removable"
                    type="button"
                    onClick={() =>
                      updateSettings({
                        selectedDishIds: selectedDishIds.filter(
                          (id) => id !== dish.id
                        )
                      })
                    }
                  >
                    {dish.name}
                    <span className="chip-remove">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResearchAreasModal;
