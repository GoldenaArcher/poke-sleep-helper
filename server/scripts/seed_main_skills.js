import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, dbAll, dbRun } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, "..", "data", "main_skill_levels.json");

const run = async () => {
  await initDb();
  const payload = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const skillRows = await dbAll("select id, name from main_skills");
  const skillIdByName = new Map(skillRows.map((row) => [row.name, row.id]));

  for (const skill of payload.skills || []) {
    const skillId = skillIdByName.get(skill.name);
    if (!skillId) {
      continue;
    }
    await dbRun(
      `update main_skills
       set value_unit = ?, value_semantics = ?
       where id = ?`,
      [skill.value_unit || null, skill.value_semantics || null, skillId]
    );
    for (const level of skill.levels || []) {
      await dbRun(
        `insert into main_skill_levels (skill_id, level, value_min, value_max, notes)
         values (?, ?, ?, ?, ?)
         on conflict(skill_id, level) do update set
           value_min = excluded.value_min,
           value_max = excluded.value_max,
           notes = excluded.notes`,
        [
          skillId,
          level.level,
          level.value_min ?? null,
          level.value_max ?? null,
          level.notes || null
        ]
      );
    }
  }
  console.log("Main skill levels seed completed.");
};

run().catch((error) => {
  console.error("Main skill levels seed failed.", error);
  process.exit(1);
});
