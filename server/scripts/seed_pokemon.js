import { initDb, seedPokemonData } from "../src/db.js";

process.env.SEED_MODE = "none";

try {
  await initDb();
  await seedPokemonData();
  console.log("Pokemon seed completed.");
  process.exit(0);
} catch (error) {
  console.error("Pokemon seed failed.", error);
  process.exit(1);
}
