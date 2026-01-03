/**
 * Main seeder orchestrator
 * Coordinates all individual seeders
 */

import { seedBerries } from "./berrySeeder.js";
import { seedDishes } from "./dishSeeder.js";
import { seedIngredients } from "./ingredientSeeder.js";
import { seedMainSkills } from "./mainSkillSeeder.js";
import { seedNatures } from "./natureSeeder.js";
import { seedPokemon } from "./pokemonSeeder.js";
import { seedResearchAreas } from "./researchAreaSeeder.js";
import { seedSubSkills } from "./subSkillSeeder.js";
import { seedPokemonTypes } from "./pokemonTypeSeeder.js";

/**
 * Run all seeders in the correct order
 */
export async function seedAll(db, dbRun, dbGet) {
  console.log("🌱 Starting full database seed...");

  // Seed reference data first (no dependencies)
  await seedPokemonTypes(db, dbRun, dbGet);
  await seedResearchAreas(db, dbRun, dbGet);
  await seedNatures(db, dbRun, dbGet);
  await seedSubSkills(db, dbRun, dbGet);
  await seedMainSkills(db, dbRun, dbGet);
  
  // Seed items (berries and ingredients)
  await seedBerries(db, dbRun, dbGet);
  await seedIngredients(db, dbRun, dbGet);
  
  // Seed dishes (depends on ingredients)
  await seedDishes(db, dbRun, dbGet);
  
  // Seed Pokemon (depends on berries, ingredients, main skills)
  await seedPokemon(db, dbRun, dbGet);

  console.log("✅ Full database seed completed!");
}

/**
 * Run specific seeders based on options
 */
export async function seedSelective(db, dbRun, dbGet, options = {}) {
  console.log("🌱 Starting selective seed...");

  if (options.berries) {
    await seedBerries(db, dbRun, dbGet);
  }

  if (options.dishes) {
    await seedDishes(db, dbRun, dbGet);
  }

  if (options.ingredients) {
    await seedIngredients(db, dbRun, dbGet);
  }

  if (options.mainSkills) {
    await seedMainSkills(db, dbRun, dbGet);
  }

  if (options.natures) {
    await seedNatures(db, dbRun, dbGet);
  }

  if (options.pokemon) {
    await seedPokemon(db, dbRun, dbGet);
  }

  if (options.researchAreas) {
    await seedResearchAreas(db, dbRun, dbGet);
  }

  if (options.subSkills) {
    await seedSubSkills(db, dbRun, dbGet);
  }

  if (options.pokemonTypes) {
    await seedPokemonTypes(db, dbRun, dbGet);
  }

  console.log("✅ Selective seed completed!");
}
