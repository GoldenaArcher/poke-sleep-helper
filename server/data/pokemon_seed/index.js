import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rangeFilePattern = /^\d{3}-\d{3}\.json$/;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertString = (value, message) => {
  assert(typeof value === "string" && value.trim().length > 0, message);
};

const assertArray = (value, message) => {
  assert(Array.isArray(value), message);
};

const ingredientSlotLevels = ["1", "30", "60"];

const parseRange = (filename) => {
  const match = filename.match(/^(\d{3})-(\d{3})\.json$/);
  assert(match, `Invalid Pokemon seed filename "${filename}"`);
  return {
    start: Number(match[1]),
    end: Number(match[2])
  };
};

const loadRangeFile = (baseDir, filename) => {
  const filePath = path.join(baseDir, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to load Pokemon seed file ${filename}: ${error.message}`
    );
  }
};

const normalizeIngredientOption = (option, messagePrefix) => {
  assert(
    option && typeof option === "object" && !Array.isArray(option),
    `${messagePrefix} must be an object`
  );
  assertString(option.name, `${messagePrefix} must have a name`);
  const quantity =
    typeof option.quantity === "number" && Number.isFinite(option.quantity)
      ? option.quantity
      : 1;
  assert(
    Number.isInteger(quantity) && quantity > 0,
    `${messagePrefix} must have a positive integer quantity`
  );
  return {
    name: option.name,
    quantity
  };
};

const normalizeIngredientOptions = (variant, messagePrefix) => {
  if (
    variant.ingredientOptions &&
    typeof variant.ingredientOptions === "object" &&
    !Array.isArray(variant.ingredientOptions)
  ) {
    const normalized = {};
    ingredientSlotLevels.forEach((slotLevel) => {
      const options = variant.ingredientOptions[slotLevel] || [];
      assertArray(
        options,
        `${messagePrefix}.ingredientOptions["${slotLevel}"] must be an array`
      );
      normalized[slotLevel] = options.map((option, index) =>
        normalizeIngredientOption(
          option,
          `${messagePrefix}.ingredientOptions["${slotLevel}"][${index}]`
        )
      );
    });
    return normalized;
  }

  const legacyIngredients = Array.isArray(variant.ingredients)
    ? variant.ingredients
    : [];
  const normalizedLegacy = legacyIngredients.map((option, index) =>
    normalizeIngredientOption(option, `${messagePrefix}.ingredients[${index}]`)
  );

  return {
    1: normalizedLegacy.map((option) => ({ ...option })),
    30: normalizedLegacy.map((option) => ({ ...option })),
    60: normalizedLegacy.map((option) => ({ ...option }))
  };
};

const cloneIngredientOptions = (ingredientOptions) =>
  Object.fromEntries(
    ingredientSlotLevels.map((slotLevel) => [
      slotLevel,
      (ingredientOptions[slotLevel] || []).map((option) => ({ ...option }))
    ])
  );

const parseIngredientInheritanceReference = (value, messagePrefix) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return {
      dexNo: value,
      variantKey: "default"
    };
  }

  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${messagePrefix} must be an object or integer dexNo`
  );
  assert(
    typeof value.dexNo === "number" && Number.isInteger(value.dexNo),
    `${messagePrefix}.dexNo must be an integer`
  );

  return {
    dexNo: value.dexNo,
    variantKey:
      typeof value.variantKey === "string" && value.variantKey.trim().length > 0
        ? value.variantKey
        : "default"
  };
};

const normalizeSpeciesEntry = (entry, index) => {
  const normalizedVariants = entry.variants.map((variant, variantIndex) => {
    const normalizedVariant = { ...variant };
    const messagePrefix = `species[${index}].variants[${variantIndex}]`;

    if (variant.inheritIngredientOptionsFrom !== undefined) {
      normalizedVariant.inheritIngredientOptionsFrom =
        parseIngredientInheritanceReference(
          variant.inheritIngredientOptionsFrom,
          `${messagePrefix}.inheritIngredientOptionsFrom`
        );
    }

    if (
      variant.ingredientOptions !== undefined ||
      Array.isArray(variant.ingredients) ||
      variant.inheritIngredientOptionsFrom === undefined
    ) {
      normalizedVariant.ingredientOptions = normalizeIngredientOptions(
        variant,
        messagePrefix
      );
    }

    return normalizedVariant;
  });

  return {
    ...entry,
    variants: normalizedVariants
  };
};

const resolveInheritedIngredientOptions = (species) => {
  const variantIndex = new Map();

  species.forEach((entry) => {
    entry.variants.forEach((variant) => {
      variantIndex.set(`${entry.dexNo}:${variant.key}`, { entry, variant });
    });
  });

  const resolving = new Set();

  const resolveVariant = (entry, variant) => {
    if (variant.ingredientOptions) {
      return variant.ingredientOptions;
    }

    const reference = variant.inheritIngredientOptionsFrom;
    assert(
      reference,
      `species dexNo ${entry.dexNo} variant "${variant.key}" must have ingredientOptions or inheritIngredientOptionsFrom`
    );

    const resolutionKey = `${entry.dexNo}:${variant.key}`;
    assert(
      !resolving.has(resolutionKey),
      `Pokemon seed contains cyclic ingredient inheritance at dexNo ${entry.dexNo} variant "${variant.key}"`
    );
    resolving.add(resolutionKey);

    const target = variantIndex.get(`${reference.dexNo}:${reference.variantKey}`);
    assert(
      target,
      `species dexNo ${entry.dexNo} variant "${variant.key}" inherits ingredientOptions from missing dexNo ${reference.dexNo} variant "${reference.variantKey}"`
    );

    const resolvedOptions = cloneIngredientOptions(
      resolveVariant(target.entry, target.variant)
    );
    variant.ingredientOptions = resolvedOptions;
    resolving.delete(resolutionKey);
    return resolvedOptions;
  };

  species.forEach((entry) => {
    entry.variants.forEach((variant) => {
      resolveVariant(entry, variant);
    });
  });
};

const validatePokemonSeedData = (species, rangeMembership) => {
  const seenDexNos = new Set();

  species.forEach((entry, index) => {
    assert(
      entry && typeof entry === "object" && !Array.isArray(entry),
      `species[${index}] must be an object`
    );
    assert(
      typeof entry.dexNo === "number" && Number.isInteger(entry.dexNo),
      `species[${index}] must have an integer dexNo`
    );
    assertString(entry.name, `species[${index}] must have a name`);
    assertString(
      entry.primaryType,
      `species[${index}] must have a primaryType`
    );
    assertString(entry.specialty, `species[${index}] must have a specialty`);
    assertArray(entry.variants, `species[${index}] must have a variants array`);
    assert(
      !seenDexNos.has(entry.dexNo),
      `Pokemon seed contains duplicate dexNo ${entry.dexNo}`
    );
    seenDexNos.add(entry.dexNo);

    const range = rangeMembership.get(entry.dexNo);
    assert(range, `species[${index}] dexNo ${entry.dexNo} is missing source range`);
    assert(
      entry.dexNo >= range.start && entry.dexNo <= range.end,
      `species[${index}] dexNo ${entry.dexNo} does not belong in ${String(range.start).padStart(3, "0")}-${String(range.end).padStart(3, "0")}.json`
    );

    entry.variants.forEach((variant, variantIndex) => {
      assertString(
        variant.key,
        `species[${index}].variants[${variantIndex}] must have a key`
      );
      assertString(
        variant.name,
        `species[${index}].variants[${variantIndex}] must have a name`
      );
      const ingredientOptions = variant.ingredientOptions;
      assert(
        ingredientOptions &&
          typeof ingredientOptions === "object" &&
          !Array.isArray(ingredientOptions),
        `species[${index}].variants[${variantIndex}] must have ingredientOptions`
      );
      ingredientSlotLevels.forEach((slotLevel) => {
        assertArray(
          ingredientOptions[slotLevel],
          `species[${index}].variants[${variantIndex}].ingredientOptions["${slotLevel}"] must be an array`
        );
      });
    });
  });
};

export const loadPokemonSeedData = (baseDir = __dirname) => {
  const filenames = fs
    .readdirSync(baseDir)
    .filter((filename) => rangeFilePattern.test(filename))
    .sort();

  assert(
    filenames.length > 0,
    `No Pokemon seed range files found in ${baseDir}`
  );

  const species = [];
  const rangeMembership = new Map();

  filenames.forEach((filename) => {
    const range = parseRange(filename);
    const data = loadRangeFile(baseDir, filename);
    assert(
      data && typeof data === "object" && !Array.isArray(data),
      `${filename} must contain an object`
    );
    assertArray(data.species, `${filename} must contain a species array`);

    data.species.forEach((entry, index) => {
      const normalizedEntry = normalizeSpeciesEntry(entry, index);
      species.push(normalizedEntry);
      rangeMembership.set(normalizedEntry.dexNo, range);
    });
  });

  resolveInheritedIngredientOptions(species);
  species.sort((a, b) => a.dexNo - b.dexNo);
  validatePokemonSeedData(species, rangeMembership);

  return { species };
};
