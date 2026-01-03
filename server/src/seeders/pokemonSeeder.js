/**
 * Pokemon Seeder
 * Seeds pokemon species, variants, and all related data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pokemonSeedPath = path.resolve(__dirname, "../../data/pokemon_seed.json");

export async function seedPokemon(db, dbRun, dbGet) {
  console.log("🐾 Seeding pokemon...");

  // ⚠️ IMPORTANT: Only clear reference data, NOT user data (pokemon_box)
  // Clear existing pokemon reference data (but NOT pokemon_box!)
  await dbRun("DELETE FROM pokemon_variant_stats");
  await dbRun("DELETE FROM pokemon_variant_main_skills");
  await dbRun("DELETE FROM pokemon_variant_ingredients");
  await dbRun("DELETE FROM pokemon_variant_berries");
  await dbRun("DELETE FROM pokemon_sub_skills");
  // ❌ DO NOT DELETE: pokemon_box, pokemon_box_sub_skills, pokemon_box_ingredients
  await dbRun("DELETE FROM pokemon_variants");
  await dbRun("DELETE FROM pokemon_species");
  
  // No need to reset auto-increment since we're using dex_no as primary key

  // Load pokemon data
  const pokemonData = JSON.parse(fs.readFileSync(pokemonSeedPath, "utf-8"));

  // Seed pokemon species (no need to sort, dex_no is the key)
  for (const species of pokemonData.species) {
    await dbRun(
      `INSERT INTO pokemon_species (dex_no, name, primary_type, secondary_type, specialty, image_path) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        species.dexNo,
        species.name,
        species.primaryType,
        species.secondaryType || null,
        species.specialty,
        `/uploads/pokemons/${species.profileImage || species.dexNo + '.png'}`
      ]
    );

    // Seed pokemon variants
    for (const variant of species.variants) {
      await dbRun(
        `INSERT INTO pokemon_variants (species_dex_no, variant_key, variant_name, is_default, is_event, notes, image_path, shiny_image_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          species.dexNo,
          variant.key,
          variant.name,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          `/uploads/pokemons/${variant.detailImage || species.dexNo + '-' + variant.key + '.png'}`,
          `/uploads/pokemons/${variant.shinyImage || species.dexNo + '-' + variant.key + '-shiny.png'}`
        ]
      );

      // Seed variant stats
      await dbRun(
        `INSERT INTO pokemon_variant_stats (species_dex_no, variant_key, base_frequency, carry_limit, friendship_points_needed, recruit_experience, recruit_shards)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          species.dexNo,
          variant.key,
          variant.stats.baseFrequency,
          variant.stats.carryLimit,
          variant.stats.friendshipPointsNeeded,
          variant.stats.recruitExperience,
          variant.stats.recruitShards
        ]
      );

      // Seed variant berries
      for (const berry of variant.berries) {
        const berryRow = await dbGet(`SELECT id FROM berries WHERE name = ?`, [berry.name]);
        if (berryRow) {
          await dbRun(
            `INSERT INTO pokemon_variant_berries (species_dex_no, variant_key, berry_id, quantity) VALUES (?, ?, ?, ?)`,
            [species.dexNo, variant.key, berryRow.id, berry.quantity]
          );
        }
      }

      // Seed variant ingredients
      for (const ingredient of variant.ingredients) {
        const ingredientRow = await dbGet(
          `SELECT id FROM ingredients WHERE name = ?`,
          [ingredient.name]
        );
        if (ingredientRow) {
          await dbRun(
            `INSERT INTO pokemon_variant_ingredients (species_dex_no, variant_key, ingredient_id, unlock_level) VALUES (?, ?, ?, ?)`,
            [species.dexNo, variant.key, ingredientRow.id, ingredient.unlockLevel]
          );
        }
      }

      // Seed variant main skill
      const mainSkillRow = await dbGet(
        `SELECT id FROM main_skills WHERE name = ?`,
        [variant.mainSkill]
      );
      if (mainSkillRow) {
        await dbRun(
          `INSERT INTO pokemon_variant_main_skills (species_dex_no, variant_key, main_skill_id) VALUES (?, ?, ?)`,
          [species.dexNo, variant.key, mainSkillRow.id]
        );
      }
    }
  }

  console.log(`  ✓ Seeded ${pokemonData.species.length} pokemon species with variants`);
}
