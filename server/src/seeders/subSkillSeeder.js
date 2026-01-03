/**
 * Sub Skill Seeder
 * Seeds sub skills (aka passive skills)
 */

import { subSkillCatalog } from "../../data/catalogs.js";

export async function seedSubSkills(db, dbRun, dbGet) {
  console.log("💫 Seeding sub skills...");

  // Clear existing data
  await dbRun("DELETE FROM sub_skills");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='sub_skills'");

  // Seed sub skills
  for (const skill of subSkillCatalog) {
    await dbRun(
      `INSERT INTO sub_skills (name, description, rarity, upgradable_to) 
       VALUES (?, ?, ?, ?)`,
      [
        skill.name,
        skill.description,
        skill.rarity || null,
        skill.upgradableTo || null
      ]
    );
  }

  console.log(`  ✓ Seeded ${subSkillCatalog.length} sub skills`);
}
