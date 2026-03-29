import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api.js";
import usePokedexStore from "../stores/usePokedexStore.js";

const TypeChip = ({ name, image }) => (
  <span className="type-chip">
    {image ? <img src={image} alt={name} /> : null}
    <span>{name}</span>
  </span>
);

const PokedexView = () => {
  const pokedex = usePokedexStore((state) => state.pokedex);

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Pokedex</p>
        <h2>Catalog</h2>
        <p className="subhead">{pokedex.length} species</p>
      </header>
      <section className="card">
        <div className="pokedex-grid">
          {pokedex.map((species) => (
            <Link
              key={species.dex_no}
              to={`/pokedex/${species.dex_no}`}
              className="pokedex-card"
            >
              <div className="pokedex-card-body">
                <img
                  className="pokedex-preview"
                  src={
                    species.image_path ||
                    `/uploads/pokemons/${species.dex_no}.png`
                  }
                  alt={species.name}
                />
                <div className="pokedex-info">
                  <strong>
                    #{String(species.dex_no).padStart(3, "0")} {species.name}
                  </strong>
                  <div className="type-row">
                    {species.primary_type && (
                      <TypeChip
                        name={species.primary_type}
                        image={species.primary_type_image}
                      />
                    )}
                    {species.secondary_type && (
                      <TypeChip
                        name={species.secondary_type}
                        image={species.secondary_type_image}
                      />
                    )}
                    <span className="type-specialty">
                      {species.specialty || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
};

const VariantStats = ({ stats }) => {
  if (!stats) {
    return <p className="meta">No stats set.</p>;
  }
  return (
    <div className="stat-grid">
      <div className="stat">
        <span className="meta">Base Frequency</span>
        <strong>{stats.base_frequency}</strong>
      </div>
      <div className="stat">
        <span className="meta">Carry Limit</span>
        <strong>{stats.carry_limit}</strong>
      </div>
      <div className="stat">
        <span className="meta">Friendship Points Needed</span>
        <strong>{stats.friendship_points_needed}</strong>
      </div>
      <div className="stat">
        <span className="meta">Recruit Experience</span>
        <strong>{stats.recruit_experience}</strong>
      </div>
      <div className="stat">
        <span className="meta">Recruit Shards</span>
        <strong>{stats.recruit_shards}</strong>
      </div>
    </div>
  );
};

const VariantSection = ({ title, children, emptyLabel }) => (
  <div>
    <h4>{title}</h4>
    {children?.length ? children : <p className="meta">{emptyLabel}</p>}
  </div>
);

const getBerryImage = (name) =>
  `/uploads/berries/${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.png`;

const getIngredientImage = (name) =>
  `/uploads/ingredients/${name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}.png`;

const normalizeEvolutionList = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const formatEvolutionItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return items
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object") {
        const name = item.name || item.item || "";
        const quantity = item.quantity ? ` x${item.quantity}` : "";
        return `${name}${quantity}`.trim();
      }
      return "";
    })
    .filter(Boolean)
    .join(" + ");
};

const EvolutionRouteDisplay = ({ route }) => {
  if (!route) {
    return (
      <div className="evolution-route">
        <span className="route-arrow">→</span>
      </div>
    );
  }

  const hasLevel = Number.isFinite(route.level_required) && route.level_required > 0;
  const hasItems = Array.isArray(route.items) && route.items.length > 0;

  if (!hasLevel && !hasItems) {
    return (
      <div className="evolution-route">
        <span className="route-arrow">→</span>
      </div>
    );
  }

  return (
    <div className="evolution-route">
      <span className="route-arrow">→</span>
      {hasLevel && (
        <span className="route-text">Lv {route.level_required}</span>
      )}
      {hasItems && (
        <div className="evolution-route-items">
          {route.items.map((item, index) => {
            const itemName = typeof item === "string" ? item : (item?.name || "");
            const itemImage = (typeof item === "object" && item !== null && item.image_path) ? item.image_path : null;

            return (
              <div key={index} className="evolution-route-item">
                {itemImage ? (
                  <img
                    src={itemImage}
                    alt={itemName}
                    className="evolution-item-image"
                  />
                ) : null}
                <span className="route-text">{itemName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EvolutionStageCard = ({ stage, isCurrent = false }) => (
  <div className={`evolution-column ${isCurrent ? "current" : ""}`}>
    <Link
      to={`/pokedex/${stage.dex_no}`}
      className="evolution-link"
    >
      <img
        src={stage.image_path || `/uploads/pokemons/${stage.dex_no}.png`}
        alt={stage.name}
        className="evolution-preview"
      />
      <div>
        <strong>
          #{String(stage.dex_no).padStart(3, "0")}
        </strong>
        <p>{stage.name}</p>
        {stage.form_name && (
          <span className="meta">{stage.form_name}</span>
        )}
        {isCurrent && <span className="meta">Current</span>}
      </div>
    </Link>
  </div>
);

const LinearEvolutionChain = ({ species, evolvesFrom, evolvesTo }) => {
  const [ancestors, setAncestors] = useState([]);
  const [descendants, setDescendants] = useState([]);
  const [isLinear, setIsLinear] = useState(
    evolvesFrom.length <= 1 && evolvesTo.length <= 1
  );
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveLinearChain = async () => {
      if (evolvesFrom.length > 1 || evolvesTo.length > 1) {
        if (isMounted) {
          setIsLinear(false);
          setIsResolved(true);
        }
        return;
      }

      const fetchAncestors = async (routeToStage) => {
        const stage = {
          dex_no: routeToStage.dex_no,
          name: routeToStage.name,
          form_name: routeToStage.variant_name || routeToStage.form_name,
          variant_key: routeToStage.variant_key
        };
        let data = null;
        try {
          data = await apiFetch(`/api/pokedex/${stage.dex_no}`);
          if (stage.variant_key) {
            const matchedVariant = data?.variants?.find(
              (variant) => variant.variant_key === stage.variant_key
            );
            if (matchedVariant) {
              stage.image_path =
                matchedVariant.image_path || matchedVariant.shiny_image_path || null;
              stage.form_name =
                matchedVariant.variant_name && matchedVariant.variant_name !== stage.name
                  ? matchedVariant.variant_name
                  : stage.form_name;
            }
          }
        } catch (_error) {
          return [{ stage, incomingRoute: null }];
        }
        const previous = normalizeEvolutionList(data?.evolution?.evolves_from);
        if (previous.length > 1) {
          throw new Error("branching-ancestors");
        }
        if (previous.length === 0) {
          return [{ stage, incomingRoute: null }];
        }
        return [
          ...(await fetchAncestors(previous[0])),
          { stage, incomingRoute: previous[0] }
        ];
      };

      const fetchDescendants = async (routeToStage) => {
        const stage = {
          dex_no: routeToStage.dex_no,
          name: routeToStage.name,
          form_name: routeToStage.variant_name || routeToStage.form_name,
          variant_key: routeToStage.variant_key
        };
        let data = null;
        try {
          data = await apiFetch(`/api/pokedex/${stage.dex_no}`);
          if (stage.variant_key) {
            const matchedVariant = data?.variants?.find(
              (variant) => variant.variant_key === stage.variant_key
            );
            if (matchedVariant) {
              stage.image_path =
                matchedVariant.image_path || matchedVariant.shiny_image_path || null;
              stage.form_name =
                matchedVariant.variant_name && matchedVariant.variant_name !== stage.name
                  ? matchedVariant.variant_name
                  : stage.form_name;
            }
          }
        } catch (_error) {
          return [{ stage, incomingRoute: routeToStage }];
        }
        const next = normalizeEvolutionList(data?.evolution?.evolves_to);
        if (next.length > 1) {
          throw new Error("branching-descendants");
        }
        if (next.length === 0) {
          return [{ stage, incomingRoute: routeToStage }];
        }
        return [
          { stage, incomingRoute: routeToStage },
          ...(await fetchDescendants(next[0]))
        ];
      };

      try {
        const resolvedAncestors =
          evolvesFrom.length === 1 ? await fetchAncestors(evolvesFrom[0]) : [];
        const resolvedDescendants =
          evolvesTo.length === 1 ? await fetchDescendants(evolvesTo[0]) : [];

        if (isMounted) {
          setAncestors(resolvedAncestors);
          setDescendants(resolvedDescendants);
          setIsLinear(true);
          setIsResolved(true);
        }
      } catch (_error) {
        if (isMounted) {
          setAncestors([]);
          setDescendants([]);
          setIsLinear(false);
          setIsResolved(true);
        }
      }
    };

    setIsResolved(false);
    resolveLinearChain();

    return () => {
      isMounted = false;
    };
  }, [evolvesFrom, evolvesTo]);

  if (!isResolved || !isLinear) {
    return null;
  }

  return (
    <div className="evolution-chain compact">
      {ancestors.map(({ stage, incomingRoute }, index) => (
        <Fragment key={`ancestor-${stage.dex_no}-${index}`}>
          {index > 0 && <EvolutionRouteDisplay route={incomingRoute} />}
          <EvolutionStageCard stage={stage} />
        </Fragment>
      ))}
      {ancestors.length > 0 && <EvolutionRouteDisplay route={evolvesFrom[0]} />}
      <EvolutionStageCard
        stage={{
          dex_no: species.dex_no,
          name: species.name,
          form_name:
            species.selected_variant?.variant_name &&
            species.selected_variant.variant_name !== species.name
              ? species.selected_variant.variant_name
              : null,
          image_path:
            species.selected_variant?.image_path ||
            species.selected_variant?.shiny_image_path ||
            species.image_path ||
            null
        }}
        isCurrent
      />
      {descendants.map(({ stage, incomingRoute }, index) => (
        <Fragment key={`descendant-${stage.dex_no}-${index}`}>
          <EvolutionRouteDisplay route={incomingRoute} />
          <EvolutionStageCard stage={stage} />
        </Fragment>
      ))}
    </div>
  );
};

const EvolutionStageList = ({ stages, direction = "forward" }) => (
  <div className="evolution-column">
    {stages.map((stage, idx) => {
      const uniqueKey = `${stage.dex_no}-${idx}`;
      const sameDexNoCount = stages.filter((entry) => entry.dex_no === stage.dex_no).length;
      const isBranchingForm = sameDexNoCount > 1;

      return (
        <div className="evolution-branch" key={uniqueKey}>
          {direction === "forward" && (
            <div className="evolution-route">
              <span className="route-arrow">→</span>
              <EvolutionRouteDisplay route={stage} />
            </div>
          )}
          <Link
            to={`/pokedex/${stage.dex_no}`}
            className="evolution-link"
          >
            <img
              src={`/uploads/pokemons/${stage.dex_no}.png`}
              alt={stage.name}
              className="evolution-preview"
            />
            <div>
              <strong>
                #{String(stage.dex_no).padStart(3, "0")}
              </strong>
              <p>{stage.name}</p>
              {isBranchingForm && stage.form_name && (
                <span className="meta">{stage.form_name}</span>
              )}
            </div>
          </Link>
          {direction === "backward" && (
            <div className="evolution-route">
              <EvolutionRouteDisplay route={stage} />
              <span className="route-arrow">→</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const EvolutionPreviousColumn = ({ stages }) => {
  const [previousStages, setPreviousStages] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvolutions = async () => {
      setLoading(true);
      const results = {};
      for (const stage of stages) {
        try {
          const data = await apiFetch(`/api/pokedex/${stage.dex_no}`);
          if (data?.evolution?.evolves_from?.length > 0) {
            results[stage.dex_no] = data.evolution.evolves_from;
          }
        } catch (_error) {
          // Ignore missing ancestor data and render what we have.
        }
      }
      setPreviousStages(results);
      setLoading(false);
    };

    fetchEvolutions();
  }, [stages]);

  const allPreviousStages = Object.values(previousStages).flat();
  const hasPreviousStages = allPreviousStages.length > 0;

  return (
    <>
      {!loading && hasPreviousStages && (
        <EvolutionPreviousColumn stages={allPreviousStages} />
      )}
      <EvolutionStageList stages={stages} direction="backward" />
    </>
  );
};

// Recursive component to fetch and display forward evolution chains
const EvolutionStageColumn = ({ stages }) => {
  const [nextStages, setNextStages] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvolutions = async () => {
      setLoading(true);
      const results = {};
      for (const stage of stages) {
        try {
          const data = await apiFetch(`/api/pokedex/${stage.dex_no}`);
          if (data?.evolution?.evolves_to?.length > 0) {
            results[stage.dex_no] = data.evolution.evolves_to;
          }
        } catch (_error) {
          // Ignore missing descendant data and render what we have.
        }
      }
      setNextStages(results);
      setLoading(false);
    };

    fetchEvolutions();
  }, [stages]);

  const allNextStages = Object.values(nextStages).flat();
  const hasNextStages = allNextStages.length > 0;

  return (
    <>
      <EvolutionStageList stages={stages} direction="forward" />
      {/* Recursively render next stages */}
      {!loading && hasNextStages && (
        <EvolutionStageColumn stages={allNextStages} />
      )}
    </>
  );
};

const formatEvolutionRoute = (route) => {
  if (!route) {
    return "Special";
  }
  const parts = [];
  if (Number.isFinite(route.level_required) && route.level_required > 0) {
    parts.push(`Lv ${route.level_required}`);
  }
  const itemsText = formatEvolutionItems(route.items);
  if (itemsText) {
    parts.push(itemsText);
  }
  return parts.length > 0 ? parts.join(" / ") : "";
};

const VariantCard = ({ variant }) => (
  <div className="variant-card">
    <div className="variant-top">
      <div className="variant-preview-stack">
        {variant.image_path && (
          <img
            className="variant-preview"
            src={variant.image_path}
            alt={variant.variant_name}
          />
        )}
        {variant.shiny_image_path && (
          <img
            className="variant-preview shiny"
            src={variant.shiny_image_path}
            alt={`${variant.variant_name} shiny`}
          />
        )}
      </div>
      <div className="variant-body">
        <div className="variant-header">
          <h4>{variant.variant_name}</h4>
          {variant.notes && <p className="meta">{variant.notes}</p>}
        </div>
        <VariantStats stats={variant.stats} />
      </div>
    </div>
    <div className="detail-grid">
      <VariantSection title="Berries" emptyLabel="No berries set.">
        {variant.berries.map((berry) => (
          <div key={berry.name} className="preview-row">
            <img
              src={berry.image_path || getBerryImage(berry.name)}
              alt={berry.name}
            />
            <span>
              {berry.name} × {berry.quantity}
            </span>
          </div>
        ))}
      </VariantSection>
      <VariantSection title="Ingredients" emptyLabel="No ingredients set.">
        {variant.ingredients.map((ingredient) => (
          <div key={ingredient.name} className="preview-row">
            <img
              src={
                ingredient.image_path || getIngredientImage(ingredient.name)
              }
              alt={ingredient.name}
            />
            <span>{ingredient.name}</span>
          </div>
        ))}
      </VariantSection>
      <VariantSection title="Main Skills" emptyLabel="No main skills set.">
        {variant.mainSkills.map((skill) => (
          <div key={skill.name}>
            <strong>{skill.name}</strong>
            <p className="meta">{skill.notes}</p>
          </div>
        ))}
      </VariantSection>
    </div>
  </div>
);

const PokedexDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [species, setSpecies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantForEvolution, setSelectedVariantForEvolution] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    apiFetch(`/api/pokedex/${id}`)
      .then((data) => {
        if (isMounted) {
          setSpecies(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSpecies(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const variants = useMemo(() => species?.variants || [], [species]);
  const variantsWithEvolution = useMemo(
    () =>
      variants.filter((variant) => {
        const variantEvolution = variant.evolution;
        const shouldUseSpeciesEvolutionFallback =
          variants.length === 1 || variant.is_default === 1;
        const evolvesFrom = normalizeEvolutionList(
          variantEvolution?.evolves_from ||
            (shouldUseSpeciesEvolutionFallback ? species?.evolution?.evolves_from : [])
        );
        const evolvesTo = normalizeEvolutionList(
          variantEvolution?.evolves_to ||
            (shouldUseSpeciesEvolutionFallback ? species?.evolution?.evolves_to : [])
        );
        return evolvesFrom.length > 0 || evolvesTo.length > 0;
      }),
    [species?.evolution?.evolves_from, species?.evolution?.evolves_to, variants]
  );

  // Set default selected variant when species loads
  useEffect(() => {
    if (!species) {
      return;
    }
    if (variantsWithEvolution.length === 0) {
      if (selectedVariantForEvolution !== null) {
        setSelectedVariantForEvolution(null);
      }
      return;
    }
    const selectedStillValid = variantsWithEvolution.some(
      (variant) => variant.variant_key === selectedVariantForEvolution
    );
    if (!selectedStillValid) {
      const defaultVariant =
        variantsWithEvolution.find((variant) => variant.is_default === 1) ||
        variantsWithEvolution[0];
      setSelectedVariantForEvolution(defaultVariant.variant_key);
    }
  }, [species, variantsWithEvolution, selectedVariantForEvolution]);

  if (loading) {
    return (
      <section className="card placeholder">
        <p className="meta">Loading pokedex entry...</p>
      </section>
    );
  }

  if (!species) {
    return (
      <section className="card placeholder">
        <p className="meta">Pokemon not found.</p>
      </section>
    );
  }

  // Get evolution data for the selected variant
  const selectedVariant = variants.find(v => v.variant_key === selectedVariantForEvolution);
  const variantEvolution = selectedVariant?.evolution;
  const shouldUseSpeciesEvolutionFallback =
    variants.length === 1 || selectedVariant?.is_default === 1;

  const evolvesFrom = normalizeEvolutionList(
    variantEvolution?.evolves_from ||
      (shouldUseSpeciesEvolutionFallback ? species.evolution?.evolves_from : [])
  );
  const evolvesTo = normalizeEvolutionList(
    variantEvolution?.evolves_to ||
      (shouldUseSpeciesEvolutionFallback ? species.evolution?.evolves_to : [])
  );
  const canTryLinearEvolutionLayout =
    evolvesFrom.length <= 1 && evolvesTo.length <= 1;
  const shouldRenderEvolutionCard = evolvesFrom.length > 0 || evolvesTo.length > 0;
  
  // Check if any variant has evolution data
  const hasVariantEvolutions = variantsWithEvolution.length > 1;

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Pokedex</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="pokedex-title">
          <img
            className="pokedex-preview"
            src={
              species.image_path ||
              `/uploads/pokemons/${species.dex_no}.png`
            }
            alt={species.name}
          />
          <h2>
            #{String(species.dex_no).padStart(3, "0")} {species.name}
          </h2>
        </div>
        <p className="subhead">
          <span className="type-row">
            {species.primary_type && (
              <TypeChip
                name={species.primary_type}
                image={species.primary_type_image}
              />
            )}
            {species.secondary_type && (
              <TypeChip
                name={species.secondary_type}
                image={species.secondary_type_image}
              />
            )}
            <span className="type-specialty">
              {species.specialty || "—"}
            </span>
          </span>
        </p>
      </header>

      {shouldRenderEvolutionCard && (
        <section className="card evolution-card">
          <div className="section-header">
            <div>
              <h3>Evolution Chain</h3>
              <p className="meta">Evolution routes and branches.</p>
            </div>
            {hasVariantEvolutions && (
              <div className="filter-group">
                <label htmlFor="variant-evolution-selector">Variant:</label>
                <select
                  id="variant-evolution-selector"
                  value={selectedVariantForEvolution || ''}
                  onChange={(e) => setSelectedVariantForEvolution(e.target.value)}
                >
                  {variantsWithEvolution.map((variant) => (
                    <option key={variant.variant_key} value={variant.variant_key}>
                      {variant.variant_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {canTryLinearEvolutionLayout ? (
            <LinearEvolutionChain
              species={{
                ...species,
                selected_variant: selectedVariant || null
              }}
              evolvesFrom={evolvesFrom}
              evolvesTo={evolvesTo}
            />
          ) : (
            <div className="evolution-chain compact">
              {evolvesFrom.length > 0 && (
                <EvolutionPreviousColumn stages={evolvesFrom} />
              )}

              <div className="evolution-column current">
                <div className="evolution-link">
                  <img
                    src={
                      selectedVariant?.image_path ||
                      selectedVariant?.shiny_image_path ||
                      species.image_path ||
                      `/uploads/pokemons/${species.dex_no}.png`
                    }
                    alt={selectedVariant?.variant_name || species.name}
                    className="evolution-preview"
                  />
                  <div>
                    <strong>#{String(species.dex_no).padStart(3, "0")}</strong>
                    <p>{species.name}</p>
                    {selectedVariant?.variant_name &&
                      selectedVariant.variant_name !== species.name && (
                        <span className="meta">{selectedVariant.variant_name}</span>
                      )}
                    <span className="meta">Current</span>
                  </div>
                </div>
              </div>

              {evolvesTo.length > 0 && (
                <EvolutionStageColumn stages={evolvesTo} />
              )}
            </div>
          )}
        </section>
      )}

      <section className="card variants-card">
        <div className="section-header">
          <div>
            <h3>Variants</h3>
            <p className="meta">Compare all variants side by side.</p>
          </div>
        </div>
        <div className="variant-grid">
          {variants.map((variant) => (
            <VariantCard key={variant.id} variant={variant} />
          ))}
        </div>
      </section>
    </>
  );
};

export { PokedexDetailView };
export default PokedexView;
