import { useEffect, useMemo, useState } from "react";
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
              key={species.id}
              to={`/pokedex/${species.id}`}
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
                  <div className="variant-list">
                    {species.variants.map((variant) => (
                      <span
                        key={variant.id}
                        className={`variant-chip ${
                          variant.is_event ? "event" : ""
                        }`}
                      >
                        {variant.variant_name}
                      </span>
                    ))}
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

const VariantCard = ({ variant }) => (
  <div className="variant-card">
    <div className="variant-top">
      {variant.image_path && (
        <img
          className="variant-preview"
          src={variant.image_path}
          alt={variant.variant_name}
        />
      )}
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

      <section className="card">
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
