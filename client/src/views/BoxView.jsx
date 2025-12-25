import { useEffect, useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import useNaturesStore from "../stores/useNaturesStore.js";
import usePokedexStore from "../stores/usePokedexStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";

const BoxView = () => {
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
    mainSkillLevel: "1"
  });
  const [boxDetailDraft, setBoxDetailDraft] = useState(null);

  useEffect(() => {
    if (!boxDetail) {
      setBoxDetailDraft(null);
      return;
    }
    setBoxDetailDraft({
      id: boxDetail.entry.id,
      natureId: boxDetail.entry.nature_id || "",
      nickname: boxDetail.entry.nickname || "",
      level: boxDetail.entry.level,
      mainSkillLevel: boxDetail.entry.main_skill_level
    });
  }, [boxDetail]);

  const selectedSpecies = pokedex.find(
    (species) => String(species.id) === String(newBoxEntry.speciesId)
  );
  const availableVariants = selectedSpecies?.variants || [];

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
      mainSkillLevel: Number(newBoxEntry.mainSkillLevel) || 1
    });
    setNewBoxEntry({
      speciesId: "",
      variantId: "",
      natureId: "",
      nickname: "",
      level: "1",
      mainSkillLevel: "1"
    });
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
      mainSkillLevel: Number(boxDetailDraft.mainSkillLevel) || 1
    });
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
        <div className="box-form">
          <label>
            Species
            <select
              value={newBoxEntry.speciesId}
              onChange={(event) =>
                setNewBoxEntry((prev) => ({
                  ...prev,
                  speciesId: event.target.value,
                  variantId: ""
                }))
              }
            >
              <option value="">Select species</option>
              {pokedex.map((species) => (
                <option key={species.id} value={species.id}>
                  #{String(species.dex_no).padStart(3, "0")} {species.name}
                </option>
              ))}
            </select>
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
          <button className="button" onClick={handleAddToBox}>
            Add to box
          </button>
        </div>
      </section>

      <section className="card">
        <div className="box-table">
          <div className="box-row header">
            <div>Pokemon</div>
            <div>Nickname</div>
            <div>Actions</div>
          </div>
          {pokemonBox.length === 0 && (
            <p className="empty">No Pokemon in the box yet.</p>
          )}
          {pokemonBox.map((entry) => (
            <div key={entry.id} className="box-row">
              <div>{entry.variant_name || entry.species_name}</div>
              <div>{entry.nickname || "—"}</div>
              <div>
                <button
                  className="button ghost"
                  onClick={() => openBoxDetail(entry.id)}
                >
                  Details
                </button>
                <button
                  className="button ghost"
                  onClick={() => removeFromBox(entry.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
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
                        ingredient.unlock_level <= boxDetail.entry.level
                    )
                    .map((ingredient) => (
                      <div key={ingredient.name}>
                        {ingredient.name} (Lv {ingredient.unlock_level})
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
                      (skill) => skill.unlock_level <= boxDetail.entry.level
                    )
                    .map((skill) => (
                      <div key={skill.name}>
                        <strong>{skill.name}</strong>
                        <p className="meta">
                          Lv {skill.unlock_level} • {skill.rarity || "—"}
                        </p>
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
