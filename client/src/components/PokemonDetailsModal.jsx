import { useEffect, useState } from "react";
import { IoCloseOutline, IoMale, IoFemale } from "react-icons/io5";
import useNaturesStore from "../stores/useNaturesStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";

const ingredientSlotLevels = [1, 30, 60];
const subSkillSlotLevels = [10, 25, 50, 75, 100];

const formatMainSkillNotes = (mainSkill) => {
  if (!mainSkill?.notes) {
    return "";
  }
  if (typeof mainSkill.value_min !== "number") {
    return mainSkill.notes;
  }
  const valueText =
    mainSkill.value_unit === "percent"
      ? `${mainSkill.value_min}%`
      : `${mainSkill.value_min}`;
  return mainSkill.notes.replace(/\?\?%|\?\?/g, valueText);
};

const PokemonDetailsModal = ({ mode = "edit" }) => {
  const { natures } = useNaturesStore();
  const {
    boxDetail,
    closeBoxDetail,
    openBoxDetail,
    updateBoxEntry,
    updateBoxIngredients,
    evolvePokemon
  } = usePokemonBoxStore();
  const [boxDetailDraft, setBoxDetailDraft] = useState(null);
  const [allowLockedEdit, setAllowLockedEdit] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const isAddMode = mode === "add";
  const detailLevel = Number(boxDetailDraft?.level || 1);

  useEffect(() => {
    if (!boxDetail) {
      setBoxDetailDraft(null);
      setAllowLockedEdit(false);
      return;
    }
    const ingredientSlotMap = new Map(
      (boxDetail.ingredientSelections || boxDetail.ingredients || []).map(
        (slot) => [slot.slot_level, slot]
      )
    );
    const subSkillSlotMap = new Map(
      (boxDetail.subSkills || []).map((slot) => [slot.slot_level, slot])
    );
    setBoxDetailDraft({
      id: boxDetail.entry.id,
      natureId: boxDetail.entry.nature_id || "",
      nickname: boxDetail.entry.nickname || "",
      level: boxDetail.entry.level,
      mainSkillLevel: boxDetail.entry.main_skill_level,
      mainSkillTriggerRate:
        typeof boxDetail.entry.main_skill_trigger_rate === "number"
          ? boxDetail.entry.main_skill_trigger_rate
          : 0.1,
      mainSkillValue:
        typeof boxDetail.entry.main_skill_value === "number"
          ? boxDetail.entry.main_skill_value
          : "",
      mainSkillOverride:
        typeof boxDetail.entry.main_skill_value === "number",
      isShiny: Boolean(boxDetail.entry.is_shiny),
      gender: boxDetail.entry.gender || "unknown",
      ingredientSlots: ingredientSlotLevels.map((slotLevel) => {
        const slot = ingredientSlotMap.get(slotLevel);
        const rawQuantity = Number(slot?.quantity);
        const normalizedQuantity =
          Number.isFinite(rawQuantity) && rawQuantity > 0
            ? rawQuantity
            : slot?.ingredient_id
              ? 1
              : 0;
        return {
          slotLevel,
          ingredientId: slot?.ingredient_id || "",
          quantity: normalizedQuantity
        };
      }),
      subSkillSlots: subSkillSlotLevels.map((slotLevel) => {
        const slot = subSkillSlotMap.get(slotLevel);
        return {
          slotLevel,
          subSkillId: slot?.sub_skill_id || ""
        };
      })
    });
    setAllowLockedEdit(false);
  }, [boxDetail]);

  const saveBoxDetail = async () => {
    if (!boxDetail || !boxDetailDraft) {
      return;
    }
    await updateBoxEntry(boxDetail.entry.id, {
      natureId: boxDetailDraft.natureId
        ? Number(boxDetailDraft.natureId)
        : null,
      nickname: boxDetailDraft.nickname || null,
      level: Number(boxDetailDraft.level) || 1,
      mainSkillLevel: Number(boxDetailDraft.mainSkillLevel) || 1,
      mainSkillTriggerRate:
        boxDetailDraft.mainSkillTriggerRate === ""
          ? null
          : Number(boxDetailDraft.mainSkillTriggerRate),
      mainSkillValue:
        boxDetailDraft.mainSkillOverride &&
        boxDetailDraft.mainSkillValue !== ""
          ? Number(boxDetailDraft.mainSkillValue)
          : null,
      isShiny: boxDetailDraft.isShiny,
      gender: boxDetailDraft.gender,
      subSkills: boxDetailDraft.subSkillSlots.map((slot) => ({
        slotLevel: slot.slotLevel,
        subSkillId: slot.subSkillId ? Number(slot.subSkillId) : null
      }))
    });
    await updateBoxIngredients(
      boxDetail.entry.id,
      boxDetailDraft.ingredientSlots.map((slot) => ({
        unlockLevel: slot.slotLevel,
        ingredientId: slot.ingredientId ? Number(slot.ingredientId) : null,
        quantity: (() => {
          const raw =
            slot.quantity === "" || slot.quantity === null
              ? null
              : Number(slot.quantity);
          if (slot.ingredientId && (!Number.isFinite(raw) || raw < 1)) {
            return 1;
          }
          return raw;
        })()
      })),
      allowLockedEdit
    );
    await openBoxDetail(boxDetail.entry.id);
  };

  const handleEvolve = async () => {
    if (!boxDetail || isEvolving) return;
    
    const levelRequiredRaw = Number(boxDetail.entry.evolution_level_required);
    const levelRequired = Number.isFinite(levelRequiredRaw)
      ? levelRequiredRaw
      : 0;
    const currentLevel = boxDetail.entry.level;
    
    if (currentLevel < levelRequired) {
      alert(`This Pokemon must be level ${levelRequired} to evolve`);
      return;
    }
    
    if (!confirm(`Evolve ${boxDetail.entry.nickname || boxDetail.entry.species_name} to ${boxDetail.entry.evolves_to_name}?`)) {
      return;
    }
    
    setIsEvolving(true);
    try {
      await evolvePokemon(boxDetail.entry.id);
    } catch (error) {
      alert(error.message || "Failed to evolve Pokemon");
    } finally {
      setIsEvolving(false);
    }
  };

  if (!boxDetail) {
    return null;
  }

  const canEvolve = boxDetail.entry.can_evolve && boxDetail.entry.evolves_to_dex_no;
  const evolutionLevelRequiredRaw = Number(
    boxDetail.entry.evolution_level_required
  );
  const evolutionLevelRequired = Number.isFinite(evolutionLevelRequiredRaw)
    ? evolutionLevelRequiredRaw
    : 0;
  const meetsLevelRequirement = boxDetail.entry.level >= evolutionLevelRequired;
  const evolutionItems = boxDetail.entry.evolution_items || [];

  // Build evolution requirement text
  const evolutionRequirements = [];
  if (evolutionLevelRequired > 0) {
    evolutionRequirements.push(`Lv ${evolutionLevelRequired}`);
  }
  if (evolutionItems.length > 0) {
    const itemNames = evolutionItems.map(item => 
      typeof item === 'string' ? item : item.name
    ).join(" + ");
    evolutionRequirements.push(itemNames);
  }
  const evolutionRequirementText = evolutionRequirements.length > 0 
    ? evolutionRequirements.join(" + ") 
    : "";

  return (
    <div className="bag-modal">
      <section className="card">
        <header className="section-header bag-header">
          <div>
            <h2>
              {boxDetail.entry.nickname || boxDetail.entry.species_name}
            </h2>
            <p className="meta">
              {boxDetail.entry.species_name} •{" "}
              {boxDetail.entry.variant_name} • Level{" "}
              {boxDetail.entry.level}
            </p>
            <div className="type-row">
              {boxDetail.entry.primary_type ? (
                <span className="type-chip">
                  {boxDetail.entry.primary_type_image ? (
                    <img
                      src={boxDetail.entry.primary_type_image}
                      alt={boxDetail.entry.primary_type}
                    />
                  ) : null}
                  <span>{boxDetail.entry.primary_type}</span>
                </span>
              ) : null}
              {boxDetail.entry.secondary_type ? (
                <span className="type-chip">
                  {boxDetail.entry.secondary_type_image ? (
                    <img
                      src={boxDetail.entry.secondary_type_image}
                      alt={boxDetail.entry.secondary_type}
                    />
                  ) : null}
                  <span>{boxDetail.entry.secondary_type}</span>
                </span>
              ) : null}
              <span className="type-specialty">
                {boxDetail.entry.specialty || "—"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            {canEvolve && (
              <button
                className="button primary"
                onClick={handleEvolve}
                disabled={!meetsLevelRequirement || isEvolving}
                title={
                  meetsLevelRequirement
                    ? evolutionRequirementText
                      ? `Evolve to ${boxDetail.entry.evolves_to_name} (${evolutionRequirementText})`
                      : `Evolve to ${boxDetail.entry.evolves_to_name}`
                    : `Requires ${evolutionRequirementText || `level ${evolutionLevelRequired}`}`
                }
              >
                {isEvolving ? "Evolving..." : `→ ${boxDetail.entry.evolves_to_name}`}
              </button>
            )}
            <button
              className="icon-button"
              onClick={closeBoxDetail}
              aria-label="Close details"
            >
              <IoCloseOutline size={20} />
            </button>
          </div>
        </header>
        {boxDetailDraft && (
          <div className="box-detail-form">
            <label>
              Nickname
              <input
                type="text"
                value={boxDetailDraft.nickname}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    nickname: event.target.value
                  }))
                }
                placeholder="Optional"
              />
            </label>
            <label>
              Nature
              <select
                value={boxDetailDraft.natureId}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    natureId: event.target.value
                  }))
                }
              >
                <option value="">None</option>
                {natures.map((nature) => (
                  <option key={nature.id} value={nature.id}>
                    {nature.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gender
              <select
                value={boxDetailDraft.gender}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    gender: event.target.value
                  }))
                }
                style={{
                  color: boxDetailDraft.gender === "male" ? "#3b82f6" : boxDetailDraft.gender === "female" ? "#ef4444" : "inherit"
                }}
              >
                <option value="unknown">⚲ Unknown</option>
                <option value="male" style={{ color: "#3b82f6" }}>♂ Male</option>
                <option value="female" style={{ color: "#ef4444" }}>♀ Female</option>
              </select>
            </label>
            <label>
              Level
              <input
                type="number"
                min="1"
                value={boxDetailDraft.level}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    level: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Main Skill Level
              <input
                type="number"
                min="1"
                value={boxDetailDraft.mainSkillLevel}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    mainSkillLevel: event.target.value
                  }))
                }
              />
            </label>
            <label className="checkbox-field">
              Shiny
              <input
                type="checkbox"
                checked={boxDetailDraft.isShiny}
                disabled={!boxDetail.entry.variant_shiny_image_path}
                onChange={(event) =>
                  setBoxDetailDraft((prev) => ({
                    ...prev,
                    isShiny: event.target.checked
                  }))
                }
              />
            </label>
            <div className="box-detail-grid">
              <div>
                <h4>Ingredient Unlocks</h4>
                {!isAddMode && (
                  <label className="checkbox-field">
                    Edit locked slots
                    <input
                      type="checkbox"
                      checked={allowLockedEdit}
                      onChange={(event) =>
                        setAllowLockedEdit(event.target.checked)
                      }
                    />
                  </label>
                )}
                <div className="slot-list">
                  {boxDetailDraft.ingredientSlots.map((slot) => {
                    const locked = !isAddMode && slot.slotLevel > detailLevel;
                    const isEditable = isAddMode || !locked || allowLockedEdit;
                    const options =
                      boxDetail.ingredientOptionsBySlot?.[
                        String(slot.slotLevel)
                      ] || [];
                    return (
                      <div
                        key={slot.slotLevel}
                        className={`slot-row ${locked ? "locked" : ""}`}
                      >
                        <div className="meta">
                          <span>Lv {slot.slotLevel}</span>
                          {locked && (
                            <span className="lock-note">
                              Locked until Lv {slot.slotLevel}
                            </span>
                          )}
                        </div>
                        <select
                          value={slot.ingredientId}
                          disabled={!isEditable}
                          onChange={(event) =>
                            setBoxDetailDraft((prev) => ({
                              ...prev,
                              ingredientSlots: prev.ingredientSlots.map(
                                (entry) =>
                                  entry.slotLevel === slot.slotLevel
                                    ? (() => {
                                        const nextIngredientId =
                                          event.target.value;
                                        const currentQty = Number(entry.quantity);
                                        const nextQty =
                                          nextIngredientId &&
                                          (!Number.isFinite(currentQty) ||
                                            currentQty < 1)
                                            ? 1
                                            : entry.quantity;
                                        return {
                                          ...entry,
                                          ingredientId: nextIngredientId,
                                          quantity: nextQty
                                        };
                                      })()
                                    : entry
                              )
                            }))
                          }
                        >
                          <option value="">Select ingredient</option>
                          {options.map((ingredient) => (
                            <option
                              key={ingredient.id}
                              value={ingredient.id}
                            >
                              {ingredient.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={slot.quantity}
                          disabled={!isEditable}
                          onChange={(event) =>
                            setBoxDetailDraft((prev) => ({
                              ...prev,
                              ingredientSlots: prev.ingredientSlots.map(
                                (entry) =>
                                  entry.slotLevel === slot.slotLevel
                                    ? {
                                        ...entry,
                                        quantity: event.target.value
                                      }
                                    : entry
                              )
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4>Sub Skills</h4>
                <div className="slot-list">
                  {boxDetailDraft.subSkillSlots.map((slot) => (
                    <div key={slot.slotLevel} className="slot-row two-col">
                      <span className="meta">Lv {slot.slotLevel}</span>
                      <select
                        value={slot.subSkillId}
                        disabled={slot.slotLevel > detailLevel}
                        onChange={(event) =>
                          setBoxDetailDraft((prev) => ({
                            ...prev,
                            subSkillSlots: prev.subSkillSlots.map((entry) =>
                              entry.slotLevel === slot.slotLevel
                                ? {
                                    ...entry,
                                    subSkillId: event.target.value
                                  }
                                : entry
                            )
                          }))
                        }
                      >
                        <option value="">Select sub skill</option>
                        {boxDetail.subSkillCatalog?.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="box-detail-actions">
              <button className="button" onClick={saveBoxDetail}>
                Save changes
              </button>
            </div>
          </div>
        )}
        <div className="detail-grid">
          <div>
            <h4>Main Skill</h4>
            {boxDetail.mainSkill ? (
              <div>
                <strong>{boxDetail.mainSkill.name}</strong>
                <p className="meta">
                  {formatMainSkillNotes(boxDetail.mainSkill)}
                </p>
                <p className="meta">
                  Skill Lv {boxDetail.entry.main_skill_level}
                </p>
                <label className="inline-field">
                  <span className="meta">Trigger rate</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={boxDetailDraft?.mainSkillTriggerRate ?? ""}
                    onChange={(event) =>
                      setBoxDetailDraft((prev) => ({
                        ...prev,
                        mainSkillTriggerRate: event.target.value
                      }))
                    }
                    placeholder="0.1"
                  />
                </label>
                <label className="checkbox-field">
                  Override skill value
                  <input
                    type="checkbox"
                    checked={Boolean(boxDetailDraft?.mainSkillOverride)}
                    onChange={(event) =>
                      setBoxDetailDraft((prev) => ({
                        ...prev,
                        mainSkillOverride: event.target.checked,
                        mainSkillValue: event.target.checked
                          ? prev.mainSkillValue
                          : ""
                      }))
                    }
                  />
                </label>
                {boxDetailDraft?.mainSkillOverride ? (
                  <label className="inline-field">
                    <span className="meta">Override value</span>
                    <input
                      type="number"
                      min="0"
                      value={boxDetailDraft?.mainSkillValue ?? ""}
                      onChange={(event) =>
                        setBoxDetailDraft((prev) => ({
                          ...prev,
                          mainSkillValue: event.target.value
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                ) : null}
                {typeof boxDetail.mainSkill.value_min === "number" ? (
                  <p className="meta">
                    Base value: {boxDetail.mainSkill.value_min}
                    {typeof boxDetail.mainSkill.value_max === "number" &&
                    boxDetail.mainSkill.value_max !==
                      boxDetail.mainSkill.value_min
                      ? `–${boxDetail.mainSkill.value_max}`
                      : ""}
                    {boxDetail.mainSkill.value_unit === "percent"
                      ? "%"
                      : ""}
                  </p>
                ) : null}
                {typeof boxDetailDraft?.mainSkillValue !== "undefined" &&
                  boxDetailDraft.mainSkillValue !== "" && (
                    <p className="meta">
                      Override value: {boxDetailDraft.mainSkillValue}
                    </p>
                  )}
                {typeof boxDetailDraft?.mainSkillValue === "undefined" &&
                  typeof boxDetail.entry.main_skill_value === "number" && (
                    <p className="meta">
                      Value: {boxDetail.entry.main_skill_value}
                    </p>
                  )}
              </div>
            ) : (
              <p className="meta">No main skill set.</p>
            )}
          </div>
          <div>
            <h4>Unlocked Ingredients</h4>
            {boxDetail.ingredientSelections?.length ? (
              (() => {
                const uniqueIngredients = boxDetail.ingredientSelections
                  .filter(
                    (ingredient) =>
                      ingredient.name &&
                      boxDetail.unlockedSlots?.includes(ingredient.slot_level)
                  )
                  .reduce((acc, ingredient) => {
                    if (!acc.find((item) => item.name === ingredient.name)) {
                      acc.push(ingredient);
                    }
                    return acc;
                  }, []);
                
                return uniqueIngredients.map((ingredient) => (
                  <div
                    key={ingredient.name}
                    className="ingredient-preview-row"
                  >
                    {ingredient.image_path ? (
                      <img src={ingredient.image_path} alt={ingredient.name} />
                    ) : null}
                    <span>{ingredient.name}</span>
                  </div>
                ));
              })()
            ) : (
              <p className="meta">No ingredients set.</p>
            )}
          </div>
          <div>
            <h4>Sub Skills</h4>
            {boxDetail.subSkills.length ? (
              boxDetail.subSkills
                .filter(
                  (skill) =>
                    skill.name && skill.slot_level <= boxDetail.entry.level
                )
                .map((skill) => (
                  <div key={`${skill.name}-${skill.slot_level}`}>
                    <strong>{skill.name}</strong>
                    <p className="meta">{skill.rarity || "—"}</p>
                  </div>
                ))
            ) : (
              <p className="meta">No sub skills set.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PokemonDetailsModal;
