import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoCloseOutline,
  IoInformationCircleOutline,
  IoAddOutline,
  IoSwapVerticalOutline,
  IoTrashOutline,
  IoFilterOutline,
  IoArrowUpOutline,
  IoArrowDownOutline
} from "react-icons/io5";
import { IoMdMale, IoMdFemale } from "react-icons/io";
import SearchSelect from "../components/SearchSelect.jsx";
import PokemonDetailsModal from "../components/PokemonDetailsModal.jsx";
import useBagStore from "../stores/useBagStore.js";
import useNaturesStore from "../stores/useNaturesStore.js";
import usePokedexStore from "../stores/usePokedexStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useResearchStore from "../stores/useResearchStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import { apiFetch } from "../utils/api.js";

const BoxView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientDetails);
  const { natures } = useNaturesStore();
  const { pokedex } = usePokedexStore();
  const berries = useResearchStore((state) => state.berries);
  const { settings, updateSettings } = useSettingsStore();
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
    isShiny: false,
    gender: "unknown"
  });
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [sortMode, setSortMode] = useState("dex");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [selectedBerries, setSelectedBerries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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
  const typeMenuRef = useRef(null);
  const initializedRef = useRef(false);

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
  const speciesByDex = useMemo(() => {
    return new Map(
      pokedex.map((species) => [String(species.dex_no), species])
    );
  }, [pokedex]);
  const typeOptions = useMemo(() => {
    const typeSet = new Set();
    const typeImageMap = new Map();
    pokedex.forEach((species) => {
      if (species.primary_type) {
        typeSet.add(species.primary_type);
        if (
          species.primary_type_image &&
          !typeImageMap.has(species.primary_type)
        ) {
          typeImageMap.set(
            species.primary_type,
            species.primary_type_image
          );
        }
      }
      if (species.secondary_type) {
        typeSet.add(species.secondary_type);
        if (
          species.secondary_type_image &&
          !typeImageMap.has(species.secondary_type)
        ) {
          typeImageMap.set(
            species.secondary_type,
            species.secondary_type_image
          );
        }
      }
    });
    return Array.from(typeSet.values())
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({
        name: type,
        image: typeImageMap.get(type) || ""
      }));
  }, [pokedex]);
  const specialtyOptions = useMemo(() => {
    const specialtySet = new Set();
    pokedex.forEach((species) => {
      if (species.specialty) {
        specialtySet.add(species.specialty);
      }
    });
    return Array.from(specialtySet.values()).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [pokedex]);
  const berryOptions = useMemo(
    () =>
      [...berries].sort((a, b) => a.name.localeCompare(b.name)).map((berry) => ({
        name: berry.name,
        image: berry.image_path || ""
      })),
    [berries]
  );
  const slotLevels = [1, 30, 60];
  const getOptionQuantity = (options, ingredientId) => {
    const match = options.find(
      (option) => String(option.id) === String(ingredientId)
    );
    return match?.quantity ? String(match.quantity) : "1";
  };
  const filteredPokemonBox = useMemo(() => {
    const orGroups = searchQuery
      .split(/\s*\|\s*|\s+or\s+/i)
      .map((group) =>
        group
          .split(/\s*&\s*|\s+and\s+/i)
          .map((token) => token.trim())
          .filter(Boolean)
      )
      .filter((group) => group.length > 0);
    const selectedTypeSet = new Set(
      selectedTypes.map((type) => type.toLowerCase())
    );
    const selectedSpecialtySet = new Set(
      selectedSpecialties.map((specialty) =>
        specialty.toLowerCase()
      )
    );
    const selectedBerrySet = new Set(
      selectedBerries.map((berry) => berry.toLowerCase())
    );
    return pokemonBox.filter((entry) => {
      const speciesInfo = speciesByDex.get(
        String(entry.species_dex_no ?? entry.dex_no)
      );
      const variantInfo = speciesInfo?.variants?.find(
        (variant) => variant.variant_key === entry.variant_key
      );
      const primaryType =
        entry.primary_type || speciesInfo?.primary_type || "";
      const secondaryType =
        entry.secondary_type || speciesInfo?.secondary_type || "";
      const specialty =
        entry.specialty || speciesInfo?.specialty || "";
      const hasTypeMatch =
        selectedTypeSet.size === 0 ||
        [primaryType, secondaryType].some(
          (type) =>
            type && selectedTypeSet.has(type.toLowerCase())
        );
      if (!hasTypeMatch) {
        return false;
      }
      const hasSpecialtyMatch =
        selectedSpecialtySet.size === 0 ||
        (specialty &&
          selectedSpecialtySet.has(specialty.toLowerCase()));
      if (!hasSpecialtyMatch) {
        return false;
      }
      const berryNames = (
        entry.berries?.length ? entry.berries : variantInfo?.berries || []
      ).map((berry) => String(berry.name || "").toLowerCase());
      const hasBerryMatch =
        selectedBerrySet.size === 0 ||
        berryNames.some((berryName) => selectedBerrySet.has(berryName));
      if (!hasBerryMatch) {
        return false;
      }
      if (orGroups.length === 0) {
        return true;
      }
      const rawText = `${entry.nickname || ""} ${entry.species_name || ""} ${
        entry.variant_name || ""
      }`;
      const lowerText = rawText.toLowerCase();
      const matchesToken = (token) => {
        try {
          const regex = new RegExp(token, "i");
          return regex.test(rawText);
        } catch (error) {
          return lowerText.includes(token.toLowerCase());
        }
      };
      return orGroups.some((group) => group.every(matchesToken));
    });
  }, [pokemonBox, searchQuery, selectedTypes, selectedSpecialties, selectedBerries, speciesByDex]);
  const sortedPokemonBox = useMemo(() => {
    const entries = [...filteredPokemonBox];
    const direction = sortDirection === "asc" ? 1 : -1;
    const getDisplayName = (entry) =>
      (entry.nickname || entry.species_name || "").trim().toLowerCase();
    const compare = (a, b) => {
      if (sortMode === "name") {
        const nameA = getDisplayName(a);
        const nameB = getDisplayName(b);
        if (nameA !== nameB) {
          return nameA.localeCompare(nameB);
        }
        if (a.dex_no !== b.dex_no) {
          return (a.dex_no || 0) - (b.dex_no || 0);
        }
        return a.id - b.id;
      }
      if (sortMode === "level") {
        if (a.level !== b.level) {
          return (a.level || 0) - (b.level || 0);
        }
        return (a.dex_no || 0) - (b.dex_no || 0);
      }
      if (sortMode === "created") {
        const timeA = a.created_at || "";
        const timeB = b.created_at || "";
        if (timeA !== timeB) {
          return timeA.localeCompare(timeB);
        }
        return a.id - b.id;
      }
      if (a.dex_no !== b.dex_no) {
        return (a.dex_no || 0) - (b.dex_no || 0);
      }
      return a.id - b.id;
    };
    entries.sort((a, b) => compare(a, b) * direction);
    return entries;
  }, [filteredPokemonBox, sortMode, sortDirection]);

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
    const optionsBySlot = {};
    slotLevels.forEach((level) => {
      const rawOptions =
        variant.ingredientOptionsBySlot?.[String(level)] ||
        variant.ingredientOptionsBySlot?.[level] ||
        [];
      const optionMap = new Map();
      rawOptions.forEach((ingredient) => {
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
          image_path: ingredient.image_path || detail?.image_path,
          quantity: Number(ingredient.quantity) || 1
        });
      });
      optionsBySlot[level] = Array.from(optionMap.values());
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
        const fallbackId = options[0]?.id || "";
        const nextId = isValid ? existingId : fallbackId;
        return {
          slot_level: level,
          ingredient_id: nextId,
          quantity:
            nextId && (!isValid || !existing?.quantity)
              ? getOptionQuantity(options, nextId)
              : existing?.quantity || "1"
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
  
  // Initialize filter and sort settings from settings store
  useEffect(() => {
    // Wait for settings to be loaded from API (version will be set)
    // AND only initialize once
    if (!initializedRef.current && settings && settings.version && settings.boxSortMode !== undefined) {
      // Set initialized flag BEFORE updating state to prevent save trigger
      initializedRef.current = true;
      setSortMode(settings.boxSortMode || "dex");
      setSortDirection(settings.boxSortDirection || "asc");
      setSelectedTypes(settings.boxFilterTypes || []);
      setSelectedSpecialties(settings.boxFilterSpecialties || []);
      setSelectedBerries(settings.boxFilterBerries || []);
    }
  }, [settings]);
  
  // Save filter and sort settings when they change (only after initialization)
  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    // Use a small delay to batch rapid changes and avoid saving during initialization
    const timeoutId = setTimeout(async () => {
      await updateSettings({
        boxFilterTypes: selectedTypes,
        boxFilterSpecialties: selectedSpecialties,
        boxFilterBerries: selectedBerries,
        boxSortMode: sortMode,
        boxSortDirection: sortDirection
      });
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [selectedTypes, selectedSpecialties, selectedBerries, sortMode, sortDirection, updateSettings]);
  
  useEffect(() => {
    if (!isSortOpen && !isTypeOpen) {
      return;
    }
    const handleClick = (event) => {
      const clickedOutsideSort =
        isSortOpen &&
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target);
      const clickedOutsideType =
        isTypeOpen &&
        typeMenuRef.current &&
        !typeMenuRef.current.contains(event.target);
      if (clickedOutsideSort) {
        setIsSortOpen(false);
      }
      if (clickedOutsideType) {
        setIsTypeOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isSortOpen, isTypeOpen]);

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
      gender: newBoxEntry.gender,
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
      isShiny: false,
      gender: "unknown"
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
            <div className="box-controls-right">
              <div className="box-search">
                <input
                  className="box-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name/species (A & B | C)"
                />
              </div>
              <div className="box-filter" ref={typeMenuRef}>
                <button
                  className="button ghost box-filter-button"
                  onClick={() => setIsTypeOpen((prev) => !prev)}
                  aria-expanded={isTypeOpen}
                >
                  <IoFilterOutline />
                  Filter
                  {selectedTypes.length + selectedSpecialties.length + selectedBerries.length >
                  0
                    ? ` (${
                        selectedTypes.length +
                        selectedSpecialties.length +
                        selectedBerries.length
                      })`
                    : ""}
                </button>
                {isTypeOpen && (
                  <div className="box-sort-menu box-filter-menu">
                    <button
                      className="box-filter-option"
                      type="button"
                      onClick={() => {
                        setSelectedTypes([]);
                        setSelectedSpecialties([]);
                        setSelectedBerries([]);
                      }}
                    >
                      Clear filter
                    </button>
                    {specialtyOptions.length > 0 && (
                      <div className="box-filter-group">
                        <p className="meta">Specialty</p>
                        <div className="box-filter-options-grid">
                        {specialtyOptions.map((specialty) => (
                          <button
                            key={specialty}
                            type="button"
                            className={`box-filter-option toggle-option ${
                              selectedSpecialties.includes(specialty)
                                ? "active"
                                : ""
                            }`}
                            aria-pressed={selectedSpecialties.includes(
                              specialty
                            )}
                            onClick={() => {
                              setSelectedSpecialties((prev) =>
                                prev.includes(specialty)
                                  ? prev.filter((item) => item !== specialty)
                                  : [...prev, specialty]
                              );
                            }}
                          >
                            <span className="box-filter-option-label">{specialty}</span>
                          </button>
                        ))}
                        </div>
                      </div>
                    )}
                    {typeOptions.length > 0 && (
                      <div className="box-filter-group">
                        <p className="meta">Type</p>
                    <div className="box-filter-options-grid">
                    {typeOptions.map((type) => (
                      <button
                        key={type.name}
                        type="button"
                        className={`box-filter-option toggle-option ${
                          selectedTypes.includes(type.name) ? "active" : ""
                        }`}
                        aria-pressed={selectedTypes.includes(type.name)}
                        onClick={() => {
                          setSelectedTypes((prev) =>
                            prev.includes(type.name)
                              ? prev.filter((item) => item !== type.name)
                              : [...prev, type.name]
                          );
                        }}
                      >
                        {type.image ? (
                          <img
                            className="box-filter-type-icon"
                            src={type.image}
                            alt={type.name}
                          />
                        ) : null}
                        <span className="box-filter-option-label">{type.name}</span>
                      </button>
                    ))}
                    </div>
                      </div>
                    )}
                    {berryOptions.length > 0 && (
                      <div className="box-filter-group">
                        <p className="meta">Berry</p>
                        <div className="box-filter-options-grid">
                          {berryOptions.map((berry) => (
                            <button
                              key={berry.name}
                              type="button"
                              className={`box-filter-option toggle-option ${
                                selectedBerries.includes(berry.name)
                                  ? "active"
                                  : ""
                              }`}
                              aria-pressed={selectedBerries.includes(
                                berry.name
                              )}
                              onClick={() => {
                                setSelectedBerries((prev) =>
                                  prev.includes(berry.name)
                                    ? prev.filter((item) => item !== berry.name)
                                    : [...prev, berry.name]
                                );
                              }}
                            >
                              {berry.image ? (
                                <img
                                  className="box-filter-type-icon"
                                  src={berry.image}
                                  alt={berry.name}
                                />
                              ) : null}
                              <span className="box-filter-option-label">{berry.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
              <button
                className="button ghost box-sort-direction"
                onClick={() =>
                  setSortDirection((prev) =>
                    prev === "asc" ? "desc" : "asc"
                  )
                }
                title={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
                aria-label="Toggle sort direction"
              >
                {sortDirection === "asc" ? (
                  <IoArrowUpOutline />
                ) : (
                  <IoArrowDownOutline />
                )}
              </button>
            </div>
          </div>
          <div className="box-row header">
            <div>Pokemon</div>
            <div>Nickname</div>
            <div>Actions</div>
          </div>
          {sortedPokemonBox.length === 0 && (
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
                    {entry.gender && (
                      <span className={`gender-chip ${entry.gender}`}>
                        {entry.gender === "male" && <IoMdMale />}
                        {entry.gender === "female" && <IoMdFemale />}
                      </span>
                    )}
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
                Gender
                <select
                  value={newBoxEntry.gender}
                  onChange={(event) =>
                    setNewBoxEntry((prev) => ({
                      ...prev,
                      gender: event.target.value
                    }))
                  }
                  style={{
                    color: newBoxEntry.gender === "male" ? "#3b82f6" : newBoxEntry.gender === "female" ? "#ef4444" : "inherit"
                  }}
                >
                  <option value="unknown">⚲ Unknown</option>
                  <option value="male" style={{ color: "#3b82f6" }}>♂ Male</option>
                  <option value="female" style={{ color: "#ef4444" }}>♀ Female</option>
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
                                    ingredient_id: event.target.value,
                                    quantity: event.target.value
                                      ? getOptionQuantity(
                                          options,
                                          event.target.value
                                        )
                                      : "1"
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
