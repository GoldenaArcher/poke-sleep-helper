/**
 * Berry Seeder
 * Seeds berries and berry strength data
 */

import { berryCatalog, berryStrengthData } from "../../data/catalogs.js";

export async function seedBerries(db, dbRun, dbGet) {
  console.log("🫐 Seeding berries...");

  // Clear existing data
  await dbRun("DELETE FROM berry_strengths");
  await dbRun("DELETE FROM berries");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='berries'");

  // Seed berries
  for (const berry of berryCatalog) {
    const result = await dbRun(
      `INSERT INTO berries (name, image_path, type) VALUES (?, ?, ?)`,
      [berry.name, `/uploads/berries/${berry.name.toLowerCase().replace(/ /g, "")}.png`, berry.type]
    );

    // Seed berry strength levels
    const berryId = result.lastID;
    const strengthLevels = berryStrengthData[berry.name];

    if (strengthLevels && Array.isArray(strengthLevels)) {
      for (const levelData of strengthLevels) {
        await dbRun(
          `INSERT INTO berry_strengths (berry_id, level, strength) VALUES (?, ?, ?)`,
          [berryId, levelData.level, levelData.strength]
        );
      }
    }
  }

  console.log(`  ✓ Seeded ${berryCatalog.length} berries with strength data`);
}
