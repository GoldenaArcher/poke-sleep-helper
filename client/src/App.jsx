import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes
} from "react-router-dom";
import { FiBriefcase } from "react-icons/fi";
import { FaMagnifyingGlassLocation } from "react-icons/fa6";
import BagModalContainer from "./components/BagModalContainer.jsx";
import ResearchAreasModalContainer from "./components/ResearchAreasModalContainer.jsx";
import BoxView from "./views/BoxView.jsx";
import BerriesView from "./views/BerriesView.jsx";
import DishesView, { DishDetailView } from "./views/DishesView.jsx";
import {
  IngredientDetailView,
  IngredientsListView
} from "./views/IngredientsView.jsx";
import PokedexView, { PokedexDetailView } from "./views/PokedexView.jsx";
import TeamsView from "./views/TeamsView.jsx";
import useBagStore from "./stores/useBagStore.js";
import useDishesStore from "./stores/useDishesStore.js";
import useNaturesStore from "./stores/useNaturesStore.js";
import usePokedexStore from "./stores/usePokedexStore.js";
import usePokemonBoxStore from "./stores/usePokemonBoxStore.js";
import useResearchStore from "./stores/useResearchStore.js";
import useSettingsStore from "./stores/useSettingsStore.js";

export default function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadBag = useBagStore((state) => state.loadBag);
  const loadDishes = useDishesStore((state) => state.loadDishes);
  const pokedex = usePokedexStore((state) => state.pokedex);
  const loadPokedex = usePokedexStore((state) => state.loadPokedex);
  const loadResearch = useResearchStore((state) => state.loadResearch);
  const loadNatures = useNaturesStore((state) => state.loadNatures);
  const loadPokemonBox = usePokemonBoxStore(
    (state) => state.loadPokemonBox
  );
  const [status, setStatus] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  useEffect(() => {
    Promise.all([
      loadSettings(),
      loadBag(),
      loadDishes(),
      loadPokedex(),
      loadResearch(),
      loadNatures(),
      loadPokemonBox()
    ]).catch(() => setStatus("Failed to load data."));
  }, [
    loadSettings,
    loadBag,
    loadDishes,
    loadPokedex,
    loadResearch,
    loadNatures,
    loadPokemonBox
  ]);



  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="rail">
          <div className="brand">
            <p className="eyebrow">Poke Sleep</p>
            <h1>Helper</h1>
          </div>
          <nav className="nav">
            <NavLink to="/" end>
              Dishes
            </NavLink>
            <NavLink to="/ingredients">Ingredients</NavLink>
            <NavLink to="/berries">Berries</NavLink>
            <NavLink to="/pokedex">Pokedex</NavLink>
            <NavLink to="/box">Box</NavLink>
            <NavLink to="/teams">Teams</NavLink>
          </nav>
          <button
            className={`bag-button ${bagOpen ? "active" : ""}`}
            onClick={() => setBagOpen((open) => !open)}
            aria-label="Toggle bag"
          >
            <FiBriefcase />
            Bag
          </button>
          <button
            className={`bag-button ${areasOpen ? "active" : ""}`}
            onClick={() => setAreasOpen((open) => !open)}
            aria-label="Toggle research setup"
          >
            <FaMagnifyingGlassLocation />
            Research
          </button>
        </aside>

        <main className="page">
          <Routes>
            <Route path="/" element={<DishesView />} />
            <Route path="/dishes/:dishId" element={<DishDetailView />} />
            <Route path="/ingredients" element={<IngredientsListView />} />
            <Route path="/berries" element={<BerriesView />} />
            <Route
              path="/ingredients/:ingredientName"
              element={<IngredientDetailView />}
            />
            <Route
              path="/pokedex"
              element={
                <PokedexView />
              }
            />
            <Route path="/pokedex/:id" element={<PokedexDetailView />} />
            <Route path="/box" element={<BoxView />} />
            <Route
              path="/teams"
              element={<TeamsView />}
            />
          </Routes>
          {status && <p className="status">{status}</p>}
        </main>

        {bagOpen && (
          <BagModalContainer
            onClose={() => setBagOpen(false)}
            setStatus={setStatus}
          />
        )}

        {areasOpen && (
          <ResearchAreasModalContainer
            onClose={() => setAreasOpen(false)}
          />
        )}
      </div>
    </BrowserRouter>
  );
}
