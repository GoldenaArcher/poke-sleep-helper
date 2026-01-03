/**
 * Pokemon Type Seeder
 * Seeds pokemon types
 */

import { pokemonTypes } from "../../data/catalogs.js";

export async function seedPokemonTypes(db, dbRun, dbGet) {
  console.log("🔥 Seeding pokemon types...");

  // Clear existing data
  await dbRun("DELETE FROM pokemon_types");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='pokemon_types'");

  // Seed pokemon types
  for (const type of pokemonTypes) {
    await dbRun(
      `INSERT INTO pokemon_types (name, image_path) VALUES (?, ?)`,
      [type, `/uploads/pokemonTypes/${type.toLowerCase()}.png`]
    );
  }

  console.log(`  ✓ Seeded ${pokemonTypes.length} pokemon types`);
}
