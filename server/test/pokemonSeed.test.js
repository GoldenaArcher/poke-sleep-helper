import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPokemonSeedData } from "../data/pokemon_seed/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../data/pokemon_seed");
const tempDirs = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poke-sleep-pokemon-seed-"));
  tempDirs.push(dir);
  return dir;
};

after(() => {
  tempDirs.forEach((dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test("pokemon seed loader merges all range files", () => {
  const data = loadPokemonSeedData();

  assert.equal(data.species.length, 81);
  assert.equal(data.species[0].dexNo, 1);
  assert.equal(data.species.at(-1).dexNo, 980);
  const pikachu = data.species.find((species) => species.dexNo === 25);
  assert.ok(pikachu);
  assert.ok(Array.isArray(pikachu.variants[0].ingredientOptions["1"]));
  assert.ok(Array.isArray(pikachu.variants[0].ingredientOptions["30"]));
  assert.ok(Array.isArray(pikachu.variants[0].ingredientOptions["60"]));
});

test("pokemon seed loader rejects species in the wrong range file", () => {
  const tempDir = makeTempDir();
  fs.cpSync(fixturesDir, tempDir, { recursive: true });

  const filePath = path.join(tempDir, "100-199.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.species.push({
    ...data.species[0],
    dexNo: 99,
    name: "OutOfRangeMon"
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

  assert.throws(
    () => loadPokemonSeedData(tempDir),
    /does not belong in 100-199\.json/
  );
});

test("pokemon seed loader rejects duplicate dex numbers across files", () => {
  const tempDir = makeTempDir();
  fs.cpSync(fixturesDir, tempDir, { recursive: true });

  const targetPath = path.join(tempDir, "000-099.json");
  const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  target.species.push({
    ...target.species[0],
    name: "DuplicateDexMon",
    dexNo: target.species[0].dexNo
  });
  fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + "\n");

  assert.throws(
    () => loadPokemonSeedData(tempDir),
    /duplicate dexNo/
  );
});

test("pokemon seed loader normalizes legacy flat ingredient arrays", () => {
  const tempDir = makeTempDir();
  const payload = {
    species: [
      {
        dexNo: 1,
        name: "LegacyMon",
        primaryType: "Electric",
        specialty: "Berries",
        variants: [
          {
            key: "default",
            name: "LegacyMon",
            ingredients: [
              { name: "Fancy Apple" },
              { name: "Warming Ginger", quantity: 2 }
            ]
          }
        ]
      }
    ]
  };
  fs.writeFileSync(
    path.join(tempDir, "000-099.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );

  const data = loadPokemonSeedData(tempDir);
  const options = data.species[0].variants[0].ingredientOptions;

  assert.deepEqual(options["1"], [
    { name: "Fancy Apple", quantity: 1 },
    { name: "Warming Ginger", quantity: 2 }
  ]);
  assert.deepEqual(options["30"], options["1"]);
  assert.deepEqual(options["60"], options["1"]);
});

test("pokemon seed loader resolves inherited ingredient options", () => {
  const tempDir = makeTempDir();
  const payload = {
    species: [
      {
        dexNo: 1,
        name: "BaseMon",
        primaryType: "Electric",
        specialty: "Berries",
        variants: [
          {
            key: "default",
            name: "BaseMon",
            ingredientOptions: {
              "1": [{ name: "Fancy Apple", quantity: 1 }],
              "30": [
                { name: "Fancy Apple", quantity: 2 },
                { name: "Warming Ginger", quantity: 2 }
              ],
              "60": [
                { name: "Fancy Apple", quantity: 4 },
                { name: "Warming Ginger", quantity: 2 },
                { name: "Fancy Egg", quantity: 3 }
              ]
            }
          }
        ]
      },
      {
        dexNo: 2,
        name: "InheritedMon",
        primaryType: "Electric",
        specialty: "Berries",
        variants: [
          {
            key: "default",
            name: "InheritedMon",
            inheritIngredientOptionsFrom: {
              dexNo: 1
            }
          }
        ]
      }
    ]
  };
  fs.writeFileSync(
    path.join(tempDir, "000-099.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );

  const data = loadPokemonSeedData(tempDir);
  assert.deepEqual(
    data.species[1].variants[0].ingredientOptions,
    data.species[0].variants[0].ingredientOptions
  );
});

test("pokemon seed loader rejects missing inherited ingredient sources", () => {
  const tempDir = makeTempDir();
  const payload = {
    species: [
      {
        dexNo: 2,
        name: "BrokenInheritedMon",
        primaryType: "Electric",
        specialty: "Berries",
        variants: [
          {
            key: "default",
            name: "BrokenInheritedMon",
            inheritIngredientOptionsFrom: {
              dexNo: 999
            }
          }
        ]
      }
    ]
  };
  fs.writeFileSync(
    path.join(tempDir, "000-099.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );

  assert.throws(
    () => loadPokemonSeedData(tempDir),
    /inherits ingredientOptions from missing dexNo 999 variant "default"/
  );
});
