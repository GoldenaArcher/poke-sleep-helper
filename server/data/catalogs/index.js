import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadJson = (baseDir, filename) => {
  const filePath = path.join(baseDir, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load catalog file ${filename}: ${error.message}`);
  }
};

const loadDishLevels = (baseDir) => {
  const dishLevelsDir = path.join(baseDir, "dish_levels");
  const curries = loadJson(dishLevelsDir, "curries.json");
  const desserts = loadJson(dishLevelsDir, "desserts.json");
  const salads = loadJson(dishLevelsDir, "salads.json");

  return {
    ...curries,
    ...desserts,
    ...salads
  };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertNumber = (value, message) => {
  assert(typeof value === "number" && Number.isFinite(value), message);
};

const assertString = (value, message) => {
  assert(typeof value === "string" && value.trim().length > 0, message);
};

const assertArray = (value, message) => {
  assert(Array.isArray(value), message);
};

const assertObject = (value, message) => {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    message
  );
};

const assertUniqueNames = (items, catalogName) => {
  const seen = new Set();
  items.forEach((item, index) => {
    assertString(item.name, `${catalogName}[${index}] must have a name`);
    assert(
      !seen.has(item.name),
      `${catalogName} contains duplicate name "${item.name}"`
    );
    seen.add(item.name);
  });
  return seen;
};

const validateDishCatalog = (dishCatalog, ingredientNames) => {
  assertArray(dishCatalog, "dishes.json must contain an array");
  const dishNames = assertUniqueNames(dishCatalog, "dishCatalog");
  dishCatalog.forEach((dish, index) => {
    assertString(dish.type, `dishCatalog[${index}] must have a type`);
    assert(
      typeof dish.description === "string",
      `dishCatalog[${index}] must have a description`
    );
    assertArray(
      dish.ingredients,
      `dishCatalog[${index}] ingredients must be an array`
    );
    dish.ingredients.forEach((ingredient, ingredientIndex) => {
      assertObject(
        ingredient,
        `dishCatalog[${index}].ingredients[${ingredientIndex}] must be an object`
      );
      assertString(
        ingredient.name,
        `dishCatalog[${index}].ingredients[${ingredientIndex}] must have a name`
      );
      assertNumber(
        ingredient.quantity,
        `dishCatalog[${index}].ingredients[${ingredientIndex}] must have a numeric quantity`
      );
      assert(
        ingredientNames.has(ingredient.name),
        `dish "${dish.name}" references missing ingredient "${ingredient.name}"`
      );
    });
  });
  return dishNames;
};

const validateLevelMap = (levelMap, mapName, parentNames, validators) => {
  assertObject(levelMap, `${mapName} must contain an object`);
  Object.entries(levelMap).forEach(([parentName, levels]) => {
    assert(
      parentNames.has(parentName),
      `${mapName} references missing parent "${parentName}"`
    );
    assertArray(levels, `${mapName} entry "${parentName}" must be an array`);
    levels.forEach((levelEntry, index) => {
      assertObject(
        levelEntry,
        `${mapName} entry "${parentName}" level ${index} must be an object`
      );
      validators(levelEntry, parentName, index);
    });
  });
};

const validateCatalogData = (catalogs) => {
  const {
    ingredientCatalog,
    dishCatalog,
    dishLevelData,
    berryCatalog,
    berryStrengthData,
    mainSkillCatalog,
    mainSkillLevelCatalog,
    subSkillCatalog,
    natureCatalog,
    researchAreas,
    pokemonTypes
  } = catalogs;

  assertArray(ingredientCatalog, "ingredients.json must contain an array");
  const ingredientNames = assertUniqueNames(ingredientCatalog, "ingredientCatalog");
  ingredientCatalog.forEach((ingredient, index) => {
    assertNumber(
      ingredient.baseStrength,
      `ingredientCatalog[${index}] must have a numeric baseStrength`
    );
  });

  const dishNames = validateDishCatalog(dishCatalog, ingredientNames);
  validateLevelMap(
    dishLevelData,
    "dishLevelData",
    dishNames,
    (levelEntry, dishName, index) => {
      assertNumber(
        levelEntry.level,
        `dishLevelData["${dishName}"][${index}] must have a numeric level`
      );
      assertNumber(
        levelEntry.experience,
        `dishLevelData["${dishName}"][${index}] must have a numeric experience`
      );
      assertNumber(
        levelEntry.value,
        `dishLevelData["${dishName}"][${index}] must have a numeric value`
      );
    }
  );

  assertArray(berryCatalog, "berries.json must contain an array");
  const berryNames = assertUniqueNames(berryCatalog, "berryCatalog");
  berryCatalog.forEach((berry, index) => {
    assertString(berry.type, `berryCatalog[${index}] must have a type`);
  });
  validateLevelMap(
    berryStrengthData,
    "berryStrengthData",
    berryNames,
    (levelEntry, berryName, index) => {
      assertNumber(
        levelEntry.level,
        `berryStrengthData["${berryName}"][${index}] must have a numeric level`
      );
      assertNumber(
        levelEntry.strength,
        `berryStrengthData["${berryName}"][${index}] must have a numeric strength`
      );
    }
  );

  assertArray(mainSkillCatalog, "main_skills.json must contain an array");
  const mainSkillNames = assertUniqueNames(mainSkillCatalog, "mainSkillCatalog");
  mainSkillCatalog.forEach((skill, index) => {
    assertString(
      skill.effectType,
      `mainSkillCatalog[${index}] must have an effectType`
    );
    assertString(skill.target, `mainSkillCatalog[${index}] must have a target`);
  });
  validateLevelMap(
    mainSkillLevelCatalog,
    "mainSkillLevelCatalog",
    mainSkillNames,
    (levelEntry, skillName, index) => {
      assertNumber(
        levelEntry.level,
        `mainSkillLevelCatalog["${skillName}"][${index}] must have a numeric level`
      );
      const hasRange =
        typeof levelEntry.valueMin === "number" &&
        typeof levelEntry.valueMax === "number";
      const hasValue = typeof levelEntry.value === "number";
      assert(
        hasRange || hasValue,
        `mainSkillLevelCatalog["${skillName}"][${index}] must have value or valueMin/valueMax`
      );
    }
  );

  assertArray(subSkillCatalog, "sub_skills.json must contain an array");
  assertUniqueNames(subSkillCatalog, "subSkillCatalog");
  subSkillCatalog.forEach((skill, index) => {
    assertString(
      skill.description,
      `subSkillCatalog[${index}] must have a description`
    );
    assert(
      typeof skill.rarity === "string",
      `subSkillCatalog[${index}] must have a rarity string`
    );
    assert(
      typeof skill.upgradableTo === "string",
      `subSkillCatalog[${index}] must have an upgradableTo string`
    );
  });

  assertArray(natureCatalog, "natures.json must contain an array");
  assertUniqueNames(natureCatalog, "natureCatalog");
  natureCatalog.forEach((nature, index) => {
    assertString(nature.boostStat, `natureCatalog[${index}] must have a boostStat`);
    assertNumber(nature.boostPct, `natureCatalog[${index}] must have a boostPct`);
    assertString(
      nature.reductionStat,
      `natureCatalog[${index}] must have a reductionStat`
    );
    assertNumber(
      nature.reductionPct,
      `natureCatalog[${index}] must have a reductionPct`
    );
  });

  assertArray(researchAreas, "research_areas.json must contain an array");
  assertUniqueNames(researchAreas, "researchAreas");
  researchAreas.forEach((area, index) => {
    assert(
      typeof area.isDefault === "boolean" || area.isDefault === 0 || area.isDefault === 1,
      `researchAreas[${index}] must have a boolean-like isDefault`
    );
    assert(
      typeof area.favoritesRandom === "boolean",
      `researchAreas[${index}] must have a favoritesRandom boolean`
    );
    assertArray(area.favorites, `researchAreas[${index}] favorites must be an array`);
  });

  assertArray(pokemonTypes, "pokemon_types.json must contain an array");
  const seenTypes = new Set();
  pokemonTypes.forEach((type, index) => {
    assertString(type, `pokemonTypes[${index}] must be a non-empty string`);
    assert(!seenTypes.has(type), `pokemonTypes contains duplicate type "${type}"`);
    seenTypes.add(type);
  });
};

export const loadCatalogData = (baseDir = __dirname) => {
  const catalogs = {
    dishCatalog: loadJson(baseDir, "dishes.json"),
    dishLevelData: loadDishLevels(baseDir),
    researchAreas: loadJson(baseDir, "research_areas.json"),
    pokemonTypes: loadJson(baseDir, "pokemon_types.json"),
    berryCatalog: loadJson(baseDir, "berries.json"),
    berryStrengthData: loadJson(baseDir, "berry_strengths.json"),
    ingredientCatalog: loadJson(baseDir, "ingredients.json"),
    mainSkillCatalog: loadJson(baseDir, "main_skills.json"),
    mainSkillLevelCatalog: loadJson(baseDir, "main_skill_levels.json"),
    subSkillCatalog: loadJson(baseDir, "sub_skills.json"),
    natureCatalog: loadJson(baseDir, "natures.json")
  };

  validateCatalogData(catalogs);

  return catalogs;
};

export {
  validateCatalogData
};

const catalogs = loadCatalogData();

export const {
  dishCatalog,
  dishLevelData,
  researchAreas,
  pokemonTypes,
  berryCatalog,
  berryStrengthData,
  ingredientCatalog,
  mainSkillCatalog,
  mainSkillLevelCatalog,
  subSkillCatalog,
  natureCatalog
} = catalogs;
