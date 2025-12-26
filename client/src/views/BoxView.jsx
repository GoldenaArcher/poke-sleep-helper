import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoCloseOutline,
  IoInformationCircleOutline,
  IoAddOutline,
  IoSwapVerticalOutline,
  IoTrashOutline
} from "react-icons/io5";
import SearchSelect from "../components/SearchSelect.jsx";
import useBagStore from "../stores/useBagStore.js";
import useNaturesStore from "../stores/useNaturesStore.js";
import usePokedexStore from "../stores/usePokedexStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";

const BoxView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientDetails);
  const { natures } = useNaturesStore();
  const { pokedex } = usePokedexStore();
  const { settings } = useSettingsStore();
  const {
    pokemonBox,
    addToBox,
    openBoxDetail,
    removeFromBox,
    updateBoxEntry,
    boxDetail,
    closeBoxDetail
  } = usePokemonBoxStore();
  const [newBoxEntry, setNewBoxEntry] = useState({
    speciesId: "",
    variantId: "",
    natureId: "",
    nickname: "",
    level: "1",
    mainSkillLevel: "1",
    isShiny: false
  });
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [sortMode, setSortMode] = useState("dex");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const [boxDetailDraft, setBoxDetailDraft] = useState(null);
  const ingredientSlotLevels = [1, 30, 60];
  const subSkillSlotLevels = [10, 25, 50, 75, 100];
  const detailLevel = Number(boxDetailDraft?.level || 1);

  useEffect(() => {
    if (!boxDetail) {
      setBoxDetailDraft(null);
      return;
    }
    const ingredientSlotMap = new Map(
      (boxDetail.ingredients || []).map((slot) => [
        slot.slot_level,
        slot
      ])
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
      isShiny: Boolean(boxDetail.entry.is_shiny),
      ingredientSlots: ingredientSlotLevels.map((slotLevel, i) => {
        const slot = ingredientSlotMap.get(slotLevel);
        return {
          slotLevel,
          ingredientId: slot?.ingredient_id || i,
          quantity:
            typeof slot?.quantity === "number" ? slot.quantity : 0
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
  }, [boxDetail]);

  const selectedSpecies = pokedex.find(
    (species) => String(species.id) === String(newBoxEntry.speciesId)
  );
  const availableVariants = selectedSpecies?.variants || [];
  const speciesOptions = pokedex.map((species) => ({
    id: species.id,
    label: `#${String(species.dex_no).padStart(3, "0")} ${species.name}`,
    variants: species.variants || []
  }));
  const sortedPokemonBox = useMemo(() => {
    const entries = [...pokemonBox];
    const getDisplayName = (entry) =>
      (entry.nickname || entry.species_name || "").trim().toLowerCase();
    if (sortMode === "name") {
      entries.sort((a, b) => {
        const nameA = getDisplayName(a);
        const nameB = getDisplayName(b);
        if (nameA !== nameB) {
          return nameA.localeCompare(nameB);
        }
        if (a.dex_no !== b.dex_no) {
          return (a.dex_no || 0) - (b.dex_no || 0);
        }
        return a.id - b.id;
      });
      return entries;
    }
    if (sortMode === "level") {
      entries.sort((a, b) => {
        if (a.level !== b.level) {
          return (b.level || 0) - (a.level || 0);
        }
        return (a.dex_no || 0) - (b.dex_no || 0);
      });
      return entries;
    }
    entries.sort((a, b) => {
      if (a.dex_no !== b.dex_no) {
        return (a.dex_no || 0) - (b.dex_no || 0);
      }
      return a.id - b.id;
    });
    return entries;
  }, [pokemonBox, sortMode]);

  const handleSpeciesChange = (event) => {
    const nextValue = event.target.value;
    setSpeciesSearch(nextValue);
    const matched = speciesOptions.find(
      (option) => option.label === nextValue
    );
    if (!matched) {
      setNewBoxEntry((prev) => ({
        ...prev,
        speciesId: "",
        variantId: ""
      }));
      return;
    }
    const defaultVariant = matched.variants.find(
      (variant) => variant.is_default
    );
    setNewBoxEntry((prev) => ({
      ...prev,
      speciesId: String(matched.id),
      variantId: defaultVariant?.id || ""
    }));
  };

  const sortLabels = {
    dex: "Dex no",
    name: "Name",
    level: "Level"
  };
  const sortOrder = ["dex", "name", "level"];
  useEffect(() => {
    if (!isSortOpen) {
      return;
    }
    const handleClick = (event) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target)
      ) {
        setIsSortOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isSortOpen]);

  const handleRemove = async (entryId) => {
    const confirmed = window.confirm(
      "Remove this Pokemon from your box?"
    );
    if (!confirmed) {
      return;
    }
    await removeFromBox(entryId);
  };

  const handleAddToBox = async () => {
    if (!newBoxEntry.speciesId || !newBoxEntry.variantId) {
      return;
    }
    await addToBox({
      speciesId: Number(newBoxEntry.speciesId),
      variantId: Number(newBoxEntry.variantId),
      natureId: newBoxEntry.natureId ? Number(newBoxEntry.natureId) : null,
      nickname: newBoxEntry.nickname || null,
      level: Number(newBoxEntry.level) || 1,
      mainSkillLevel: Number(newBoxEntry.mainSkillLevel) || 1,
      isShiny: newBoxEntry.isShiny
    });
    setNewBoxEntry({
      speciesId: "",
      variantId: "",
      natureId: "",
      nickname: "",
      level: "1",
      mainSkillLevel: "1",
      isShiny: false
    });
    setSpeciesSearch("");
    setIsAddOpen(false);
  };

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
        boxDetailDraft.mainSkillValue === ""
          ? null
          : Number(boxDetailDraft.mainSkillValue),
      isShiny: boxDetailDraft.isShiny,
      ingredients: boxDetailDraft.ingredientSlots.map((slot) => ({
        slotLevel: slot.slotLevel,
        ingredientId: slot.ingredientId ? Number(slot.ingredientId) : null,
        quantity: Number(slot.quantity) || 0
      })),
      subSkills: boxDetailDraft.subSkillSlots.map((slot) => ({
        slotLevel: slot.slotLevel,
        subSkillId: slot.subSkillId ? Number(slot.subSkillId) : null
      }))
    });
    await openBoxDetail(boxDetail.entry.id);
  };

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Pokemon Box</p>
        <h2>Collection</h2>
        <p className="subhead">
          {pokemonBox.length} / {settings.pokemonBoxLimit || 80} stored
        </p>
      </header>
      <section className="card">
        <div className="box-table">
          <div className="box-table-controls">
            <button
              className="button box-add-button"
              onClick={() => setIsAddOpen(true)}
            >
              <IoAddOutline />
              Add Pokemon
            </button>
            <div className="box-sort" ref={sortMenuRef}>
              <button
                className="button ghost box-sort-button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                aria-expanded={isSortOpen}
              >
                <IoSwapVerticalOutline />
                {sortLabels[sortMode]}
              </button>
              {isSortOpen && (
                <div className="box-sort-menu">
                  {sortOrder.map((mode) => (
                    <button
                      key={mode}
                      className="box-sort-option"
                      onClick={() => {
                        setSortMode(mode);
                        setIsSortOpen(false);
                      }}
                      type="button"
                    >
                      {sortLabels[mode]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="box-row header">
            <div>Pokemon</div>
            <div>Nickname</div>
            <div>Actions</div>
          </div>
          {pokemonBox.length === 0 && (
            <p className="empty">No Pokemon in the box yet.</p>
          )}
          {sortedPokemonBox.map((entry) => (
            <div key={entry.id} className="box-row">
              <div className="box-preview">
                {entry.variant_image_path ? (
                  <img
                    className="box-preview-img"
                    src={
                      entry.is_shiny
                        ? entry.variant_shiny_image_path ||
                          entry.variant_image_path.replace(
                            /\.png$/i,
                            "-shiny.png"
                          )
                        : entry.variant_image_path
                    }
                    alt={entry.variant_name || entry.species_name}
                  />
                ) : null}
                <div>
                  <div className="box-title">
                    <strong>
                      {entry.variant_name || entry.species_name}
                    </strong>
                    <span className="level-badge">Lv {entry.level}</span>
                  </div>
                  <p className="meta">{entry.species_name}</p>
                  <div className="type-row">
                    {entry.primary_type ? (
                      <span className="type-chip">
                        {entry.primary_type_image ? (
                          <img
                            src={entry.primary_type_image}
                            alt={entry.primary_type}
                          />
                        ) : null}
                        <span>{entry.primary_type}</span>
                      </span>
                    ) : null}
                    {entry.secondary_type ? (
                      <span className="type-chip">
                        {entry.secondary_type_image ? (
                          <img
                            src={entry.secondary_type_image}
                            alt={entry.secondary_type}
                          />
                        ) : null}
                        <span>{entry.secondary_type}</span>
                      </span>
                    ) : null}
                    <span className="type-specialty">
                      {entry.specialty || "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div>{entry.nickname || "—"}</div>
              <div className="box-actions">
                <button
                  className="box-icon-button"
                  onClick={() => openBoxDetail(entry.id)}
                  aria-label="View details"
                  title="Details"
                >
                  <IoInformationCircleOutline size={18} />
                </button>
                <button
                  className="box-icon-button"
                  onClick={() => handleRemove(entry.id)}
                  aria-label="Remove Pokemon"
                  title="Remove"
                >
                  <IoTrashOutline size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {isAddOpen && (
        <div className="bag-modal">
          <section className="card">
            <header className="section-header bag-header">
              <div>
                <h2>Add Pokemon</h2>
                <p className="meta">
                  Choose a species and set its starting details.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsAddOpen(false)}
                aria-label="Close add modal"
              >
                <IoCloseOutline size={20} />
              </button>
            </header>
            <div className="box-form">
              <label>
                <SearchSelect
                  label="Species"
                  value={speciesSearch}
                  onChange={handleSpeciesChange}
                  options={speciesOptions.map((option) => option.label)}
                  placeholder="Select species"
                  listId="box-species-options"
                />
              </label>
              <label>
                Variant
                <select
                  value={newBoxEntry.variantId}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
                      ...prev,
                      variantId: event.target.value
                    }))
                  }
                  disabled={!selectedSpecies}
                >
                  <option value="">Select variant</option>
                  {availableVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.variant_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nature
                <select
                  value={newBoxEntry.natureId}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
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
                Nickname
                <input
                  type="text"
                  value={newBoxEntry.nickname}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
                      ...prev,
                      nickname: event.target.value
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label>
                Level
                <input
                  type="number"
                  min="1"
                  value={newBoxEntry.level}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
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
                  value={newBoxEntry.mainSkillLevel}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
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
                  checked={newBoxEntry.isShiny}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
                      ...prev,
                      isShiny: event.target.checked
                    }))
                  }
                />
              </label>
              <button className="button" onClick={handleAddToBox}>
                Add to box
              </button>
            </div>
          </section>
        </div>
      )}
      {boxDetail && (
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
              <button
                className="icon-button"
                onClick={closeBoxDetail}
                aria-label="Close details"
              >
                <IoCloseOutline size={20} />
              </button>
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
                    <div className="slot-list">
                      {boxDetailDraft.ingredientSlots.map((slot) => (
                        <div key={slot.slotLevel} className="slot-row">
                          <span className="meta">
                            Lv {slot.slotLevel}
                          </span>
                          <select
                            value={slot.ingredientId}
                            disabled={slot.slotLevel > detailLevel}
                            onChange={(event) =>
                              setBoxDetailDraft((prev) => ({
                                ...prev,
                                ingredientSlots: prev.ingredientSlots.map(
                                  (entry) =>
                                    entry.slotLevel === slot.slotLevel
                                      ? {
                                          ...entry,
                                          ingredientId: event.target.value
                                        }
                                      : entry
                                )
                              }))
                            }
                          >
                            <option value="">Select ingredient</option>
                            {ingredientCatalog.map((ingredient) => (
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
                            min="0"
                            value={slot.quantity}
                            disabled={slot.slotLevel > detailLevel}
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
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4>Sub Skills</h4>
                    <div className="slot-list">
                      {boxDetailDraft.subSkillSlots.map((slot) => (
                        <div
                          key={slot.slotLevel}
                          className="slot-row two-col"
                        >
                          <span className="meta">
                            Lv {slot.slotLevel}
                          </span>
                          <select
                            value={slot.subSkillId}
                            disabled={slot.slotLevel > detailLevel}
                            onChange={(event) =>
                              setBoxDetailDraft((prev) => ({
                                ...prev,
                                subSkillSlots: prev.subSkillSlots.map(
                                  (entry) =>
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
                    <p className="meta">{boxDetail.mainSkill.notes}</p>
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
                    <label className="inline-field">
                      <span className="meta">Value</span>
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
                        placeholder={
                          typeof boxDetail.entry.main_skill_value_default ===
                          "number"
                            ? `Default: ${boxDetail.entry.main_skill_value_default}`
                            : "Optional"
                        }
                      />
                    </label>
                    {typeof boxDetail.entry.main_skill_value_default ===
                    "number" ? (
                      <p className="meta">
                        Default value:{" "}
                        {boxDetail.entry.main_skill_value_default}
                      </p>
                    ) : null}
                    {typeof boxDetailDraft?.mainSkillValue !== "undefined" &&
                      boxDetailDraft.mainSkillValue !== "" && (
                        <p className="meta">
                          Value: {boxDetailDraft.mainSkillValue}
                        </p>
                      )}
                    {typeof boxDetailDraft?.mainSkillValue === "undefined" &&
                      typeof boxDetail.entry.main_skill_value ===
                        "number" && (
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
                {boxDetail.ingredients.length ? (
                  boxDetail.ingredients
                    .filter(
                      (ingredient) =>
                        ingredient.name &&
                        ingredient.slot_level <= boxDetail.entry.level
                    )
                    .map((ingredient) => (
                      <div
                        key={`${ingredient.name}-${ingredient.slot_level}`}
                        className="ingredient-preview-row"
                      >
                        {ingredient.image_path ? (
                          <img
                            src={ingredient.image_path}
                            alt={ingredient.name}
                          />
                        ) : null}
                        <span>{ingredient.name}</span>
                      </div>
                    ))
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
                        skill.name &&
                        skill.slot_level <= boxDetail.entry.level
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
      )}
    </>
  );
};

export default BoxView;
