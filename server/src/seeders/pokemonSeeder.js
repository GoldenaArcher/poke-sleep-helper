/**
 * Pokemon Seeder
 * Seeds pokemon species, variants, and all related data
 */

import { loadPokemonSeedData } from "../../data/pokemon_seed/index.js";

export async function seedPokemon(db, dbRun, dbGet) {
  console.log("🐾 Seeding pokemon...");

  // ⚠️ IMPORTANT: Only clear reference data, NOT user data (pokemon_box)
  // Clear existing pokemon reference data (but NOT pokemon_box!)
  await dbRun("DELETE FROM pokemon_variant_stats");
  await dbRun("DELETE FROM pokemon_variant_main_skills");
  await dbRun("DELETE FROM pokemon_variant_ingredients");
  await dbRun("DELETE FROM pokemon_variant_berries");
  await dbRun("DELETE FROM pokemon_variant_evolution");
  await dbRun("DELETE FROM pokemon_evolution_items");
  await dbRun("DELETE FROM pokemon_evolution_routes");
  await dbRun("DELETE FROM pokemon_sub_skills");
  // ❌ DO NOT DELETE: pokemon_box, pokemon_box_sub_skills, pokemon_box_ingredients
  await dbRun("DELETE FROM pokemon_variants");
  await dbRun("DELETE FROM pokemon_species");
  await dbRun("DELETE FROM evolution_items");
  
  // No need to reset auto-increment since we're using dex_no as primary key

  // Load pokemon data
  const pokemonData = loadPokemonSeedData();

  const evolutionRoutes = [];
  const evolutionItemsSet = new Set(); // Collect all unique evolution items

  // Seed pokemon species (no need to sort, dex_no is the key)
  for (const species of pokemonData.species) {
    // Process evolution chain data
    const evolvesFromDexNo = species.evolutionChain?.evolvesFrom?.dexNo || null;
    const evolvesToEntries = Array.isArray(species.evolutionChain?.evolvesTo)
      ? species.evolutionChain.evolvesTo
      : species.evolutionChain?.evolvesTo
        ? [species.evolutionChain.evolvesTo]
        : [];
    const evolvesToDexNo = evolvesToEntries[0]?.dexNo || null;
    const evolutionLevelRequired =
      evolvesToEntries[0]?.levelRequired ?? null;

    await dbRun(
      `INSERT INTO pokemon_species (dex_no, name, primary_type, secondary_type, specialty, image_path, evolves_from_dex_no, evolves_to_dex_no, evolution_level_required) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        species.dexNo,
        species.name,
        species.primaryType,
        species.secondaryType || null,
        species.specialty,
        `/uploads/pokemons/${species.profileImage || species.dexNo + '.png'}`,
        evolvesFromDexNo,
        evolvesToDexNo,
        evolutionLevelRequired
      ]
    );

    evolvesToEntries.forEach((evolvesTo) => {
      if (!evolvesTo?.dexNo) {
        return;
      }
      
      // Collect evolution items from various possible field names
      let items = 
        evolvesTo.evolutionItems ??
        evolvesTo.items ??
        evolvesTo.itemList ??
        null;
      
      // Handle single item (like evolutionItem: "Thunder Stone")
      if (evolvesTo.evolutionItem && !items) {
        items = [evolvesTo.evolutionItem];
      }
      
      // Ensure items is an array or null
      if (items && !Array.isArray(items)) {
        items = [items];
      }
      
      // Add unique items to the set
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (typeof item === 'string') {
            evolutionItemsSet.add(item);
          } else if (item && typeof item === 'object' && item.name) {
            evolutionItemsSet.add(item.name);
          }
        });
      }
      
      evolutionRoutes.push({
        fromDexNo: species.dexNo,
        toDexNo: evolvesTo.dexNo,
        levelRequired: evolvesTo.levelRequired ?? null,
        items: items
      });
    });

    // Seed pokemon variants
    for (const variant of species.variants) {
      const shinyImagePath = variant.shinyImage 
        ? `/uploads/pokemons/${variant.shinyImage}`
        : null;
      
      await dbRun(
        `INSERT INTO pokemon_variants (species_dex_no, variant_key, variant_name, specialty, is_default, is_event, notes, image_path, shiny_image_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          species.dexNo,
          variant.key,
          variant.name,
          variant.specialty || species.specialty || null,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          `/uploads/pokemons/${variant.detailImage || species.dexNo + '-' + variant.key + '.png'}`,
          shinyImagePath
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

  // Seed variant evolution mappings (second pass after all variants are created)
  for (const species of pokemonData.species) {
    const evolvesToEntries = Array.isArray(species.evolutionChain?.evolvesTo)
      ? species.evolutionChain.evolvesTo
      : species.evolutionChain?.evolvesTo
        ? [species.evolutionChain.evolvesTo]
        : [];

    for (const evolvesTo of evolvesToEntries) {
      if (!evolvesTo?.variantMapping) {
        continue;
      }
      const targetDexNo = evolvesTo.dexNo;
      for (const [fromVariantKey, toVariantKey] of Object.entries(
        evolvesTo.variantMapping
      )) {
        await dbRun(
          `INSERT INTO pokemon_variant_evolution (from_species_dex_no, from_variant_key, to_species_dex_no, to_variant_key)
           VALUES (?, ?, ?, ?)`,
          [species.dexNo, fromVariantKey, targetDexNo, toVariantKey]
        );
      }
    }
  }

  // Seed evolution items catalog
  for (const itemName of Array.from(evolutionItemsSet).sort()) {
    const imageName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    await dbRun(
      `INSERT INTO evolution_items (name, image_path) VALUES (?, ?)`,
      [itemName, `/uploads/evolutionItems/${imageName}.png`]
    );
  }

  // Seed evolution routes and evolution items associations
  for (const route of evolutionRoutes) {
    await dbRun(
      `INSERT INTO pokemon_evolution_routes
       (from_species_dex_no, to_species_dex_no, level_required, items_json)
       VALUES (?, ?, ?, ?)`,
      [
        route.fromDexNo,
        route.toDexNo,
        route.levelRequired,
        route.items ? JSON.stringify(route.items) : null
      ]
    );

    // Insert evolution items associations
    if (route.items && Array.isArray(route.items)) {
      for (const item of route.items) {
        const itemName = typeof item === 'string' ? item : item.name;
        if (!itemName) continue;
        
        const itemRow = await dbGet(
          `SELECT id FROM evolution_items WHERE name = ?`,
          [itemName]
        );
        
        if (itemRow) {
          await dbRun(
            `INSERT INTO pokemon_evolution_items (from_species_dex_no, to_species_dex_no, item_id)
             VALUES (?, ?, ?)`,
            [route.fromDexNo, route.toDexNo, itemRow.id]
          );
        }
      }
    }
  }

  console.log(`  ✓ Seeded ${pokemonData.species.length} pokemon species with variants`);
}
