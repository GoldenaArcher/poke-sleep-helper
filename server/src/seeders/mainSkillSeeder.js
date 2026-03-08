/**
 * Main Skill Seeder
 * Seeds main skills and their level data
 */

import {
  mainSkillCatalog,
  mainSkillLevelCatalog
} from "../../data/catalogs/index.js";

export async function seedMainSkills(db, dbRun, dbGet) {
  console.log("⚡ Seeding main skills...");

  // Clear existing data
  await dbRun("DELETE FROM main_skill_levels");
  await dbRun("DELETE FROM main_skills");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='main_skills'");

  // Seed main skills
  for (const skill of mainSkillCatalog) {
    const result = await dbRun(
      `INSERT INTO main_skills (name, effect_type, target, notes, value_unit, value_semantics) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        skill.name,
        skill.effectType,
        skill.target,
        skill.notes || null,
        skill.valueUnit || null,
        skill.valueSemantics || null
      ]
    );

    const skillId = result.lastID;

    // Seed main skill levels
    const levelData = mainSkillLevelCatalog[skill.name];
    if (levelData && Array.isArray(levelData)) {
      for (const level of levelData) {
        await dbRun(
          `INSERT INTO main_skill_levels (skill_id, level, value_min, value_max, notes) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            skillId,
            level.level,
            level.valueMin || level.value || 0,
            level.valueMax || level.value || 0,
            level.notes || null
          ]
        );
      }
    }
  }

  console.log(`  ✓ Seeded ${mainSkillCatalog.length} main skills with levels`);
}
