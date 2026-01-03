import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoCloseOutline,
  IoInformationCircleOutline,
  IoAddOutline,
  IoSwapVerticalOutline,
  IoTrashOutline
} from "react-icons/io5";
import SearchSelect from "../components/SearchSelect.jsx";
import PokemonDetailsModal from "../components/PokemonDetailsModal.jsx";
import useBagStore from "../stores/useBagStore.js";
import useNaturesStore from "../stores/useNaturesStore.js";
import usePokedexStore from "../stores/usePokedexStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import { apiFetch } from "../utils/api.js";

const BoxView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientDetails);
  const { natures } = useNaturesStore();
  const { pokedex } = usePokedexStore();
  const { settings } = useSettingsStore();
  const {
    pokemonBox,
    addToBox,
    openBoxDetail,
    removeFromBox
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
  const [speciesDetail, setSpeciesDetail] = useState(null);
  const [variantIngredientOptions, setVariantIngredientOptions] = useState({});
  const emptyIngredientSlots = [
    { slot_level: 1, ingredient_id: "", quantity: "1" },
    { slot_level: 30, ingredient_id: "", quantity: "1" },
    { slot_level: 60, ingredient_id: "", quantity: "1" }
  ];
  const [ingredientSlots, setIngredientSlots] = useState(
    emptyIngredientSlots
  );
  const sortMenuRef = useRef(null);

  const selectedSpecies = pokedex.find(
    (species) => String(species.dex_no) === String(newBoxEntry.speciesId)
  );
  const availableVariants = selectedSpecies?.variants || [];
  const speciesOptions = pokedex.map((species) => ({
    id: species.dex_no,
    label: `#${String(species.dex_no).padStart(3, "0")} ${species.name}`,
    variants: species.variants || []
  }));
  const ingredientDetailByName = useMemo(() => {
    return new Map(
      ingredientCatalog.map((ingredient) => [
        ingredient.name.toLowerCase(),
        ingredient
      ])
    );
  }, [ingredientCatalog]);
  const slotLevels = [1, 30, 60];
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
    if (sortMode === "created") {
      // Sort by created_at descending (newest first)
      // API already returns in this order, but sort here for consistency
      entries.sort((a, b) => {
        const timeA = a.created_at || "";
        const timeB = b.created_at || "";
        if (timeA !== timeB) {
          return timeB.localeCompare(timeA); // descending
        }
        return b.id - a.id; // fallback to id descending
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
  useEffect(() => {
    let ignore = false;
    const loadSpeciesDetail = async () => {
      if (!newBoxEntry.speciesId) {
        setSpeciesDetail(null);
        setVariantIngredientOptions({});
        setIngredientSlots(emptyIngredientSlots);
        return;
      }
      const detail = await apiFetch(`/api/pokedex/${newBoxEntry.speciesId}`);
      if (!ignore) {
        setSpeciesDetail(detail);
      }
    };
    loadSpeciesDetail();
    return () => {
      ignore = true;
    };
  }, [newBoxEntry.speciesId]);

  useEffect(() => {
    if (!speciesDetail || !newBoxEntry.variantId) {
      setVariantIngredientOptions({});
      return;
    }
    const variant = speciesDetail.variants?.find(
      (item) => String(item.id) === String(newBoxEntry.variantId)
    );
    if (!variant) {
      setVariantIngredientOptions({});
      return;
    }
    const optionMap = new Map();
    (variant.ingredients || []).forEach((ingredient) => {
      const detail = ingredientDetailByName.get(
        String(ingredient.name || "").toLowerCase()
      );
      const ingredientId =
        ingredient.id || ingredient.ingredient_id || detail?.id || "";
      if (!ingredientId || optionMap.has(String(ingredientId))) {
        return;
      }
      optionMap.set(String(ingredientId), {
        id: ingredientId,
        name: ingredient.name,
        image_path: detail?.image_path
      });
    });
    const optionsList = Array.from(optionMap.values());
    const optionsBySlot = {};
    slotLevels.forEach((level) => {
      optionsBySlot[level] = optionsList;
    });
    setVariantIngredientOptions(optionsBySlot);
    setIngredientSlots((prev) =>
      slotLevels.map((level) => {
        const options = optionsBySlot[level] || [];
        const existing = prev.find((slot) => slot.slot_level === level);
        const existingId = existing?.ingredient_id || "";
        const isValid = options.some(
          (option) => String(option.id) === String(existingId)
        );
        const slotIndex = slotLevels.indexOf(level);
        const fallbackId =
          options[slotIndex]?.id || options[0]?.id || "";
        const nextId = isValid ? existingId : fallbackId;
        return {
          slot_level: level,
          ingredient_id: nextId,
          quantity: existing?.quantity || "1"
        };
      })
    );
  }, [speciesDetail, newBoxEntry.variantId, ingredientDetailByName]);

  const sortLabels = {
    dex: "Dex no",
    name: "Name",
    level: "Level",
    created: "Created time"
  };
  const sortOrder = ["dex", "name", "level", "created"];
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
    // Parse composite variantId (format: "dexNo-variantKey")
    const [dexNo, variantKey] = newBoxEntry.variantId.split('-');
    await addToBox({
      speciesId: Number(dexNo),
      variantKey: variantKey,
      natureId: newBoxEntry.natureId ? Number(newBoxEntry.natureId) : null,
      nickname: newBoxEntry.nickname || null,
      level: Number(newBoxEntry.level) || 1,
      mainSkillLevel: Number(newBoxEntry.mainSkillLevel) || 1,
      isShiny: newBoxEntry.isShiny,
      ingredientSlots: ingredientSlots
        .filter((slot) => slot.ingredient_id)
        .map((slot) => ({
          slot_level: slot.slot_level,
          ingredient_id: Number(slot.ingredient_id),
          quantity: Math.max(1, Number(slot.quantity) || 1)
        }))
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
    setIngredientSlots(emptyIngredientSlots);
    setIsAddOpen(false);
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
              <div className="box-ingredient-slots">
                <p className="meta">Ingredient slots</p>
                <div className="box-ingredient-slot box-ingredient-slot-header">
                  <span className="meta">Level</span>
                  <span className="meta">Ingredient</span>
                  <span className="meta">Qty</span>
                </div>
                {slotLevels.map((level) => {
                  const slot = ingredientSlots.find(
                    (entry) => entry.slot_level === level
                  );
                  const options = variantIngredientOptions[level] || [];
                  return (
                    <div key={level} className="box-ingredient-slot">
                      <span className="meta">Lv {level}</span>
                      <select
                        className="box-ingredient-select"
                        value={slot?.ingredient_id || ""}
                        onChange={(event) =>
                          setIngredientSlots((prev) =>
                            prev.map((entry) =>
                              entry.slot_level === level
                                ? {
                                    ...entry,
                                    ingredient_id: event.target.value
                                  }
                                : entry
                            )
                          )
                        }
                        disabled={!newBoxEntry.variantId}
                      >
                        <option value="">Select ingredient</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="box-ingredient-qty"
                        type="number"
                        min="1"
                        value={slot?.quantity || "1"}
                        onChange={(event) =>
                          setIngredientSlots((prev) =>
                            prev.map((entry) =>
                              entry.slot_level === level
                                ? { ...entry, quantity: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <button className="button" onClick={handleAddToBox}>
                Add to box
              </button>
            </div>
          </section>
        </div>
      )}
      <PokemonDetailsModal />
    </>
  );
};

export default BoxView;
