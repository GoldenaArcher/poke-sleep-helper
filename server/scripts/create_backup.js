import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/poke-sleep.sqlite');
const backupDir = path.join(__dirname, '../data/backups');

const db = new sqlite3.Database(dbPath);

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function createBackup() {
  console.log("💾 Creating backup...");

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Fetch user data
    const pokemonBox = await dbAll("SELECT * FROM pokemon_box");
    const pokemonBoxSubSkills = await dbAll("SELECT * FROM pokemon_box_sub_skills");
    const pokemonBoxIngredients = await dbAll("SELECT * FROM pokemon_box_ingredients");
    const settings = await dbAll("SELECT * FROM settings");
    const bagIngredients = await dbAll("SELECT * FROM bag_ingredients");
    const dishLevels = await dbAll("SELECT id, dish_level FROM dishes WHERE dish_level > 1");

    // Create backup data
    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        pokemon_box: pokemonBox,
        pokemon_box_sub_skills: pokemonBoxSubSkills,
        pokemon_box_ingredients: pokemonBoxIngredients,
        settings: settings,
        bag_ingredients: bagIngredients,
        dish_levels: dishLevels
      },
      counts: {
        pokemon: pokemonBox.length,
        settings: settings.length,
        bag_items: bagIngredients.length,
        dish_levels: dishLevels.length
      }
    };

    // Write backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `user-data-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf-8");

    console.log(`  ✓ Backup created: ${path.basename(backupFile)}`);
    console.log(`    - Pokemon: ${pokemonBox.length}`);
    console.log(`    - Sub skills: ${pokemonBoxSubSkills.length}`);
    console.log(`    - Ingredients: ${pokemonBoxIngredients.length}`);
    console.log(`    - Settings: ${settings.length}`);
    console.log(`    - Bag items: ${bagIngredients.length}`);
    console.log(`    - Dish levels: ${dishLevels.length}`);
    console.log(`\n📂 Backup location: ${backupFile}`);

    // Clean old backups (keep last 10)
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('user-data-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      const toDelete = files.slice(10);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`  🗑️  Deleted old backup: ${file.name}`);
      });
    }

    console.log('\n✅ Backup completed successfully!');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    db.close();
    process.exit(1);
  }
}

createBackup();
