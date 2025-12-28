import {
  AVG_ENERGY_MULTIPLIER,
  COOKING_DAILY_NEED,
  DEFAULT_TRIGGER_RATE,
  DEFAULT_WEIGHTS,
  EVENT_MULTIPLIERS
} from "./constants";

export type PokemonBoxEntry = {
  id: number;
  species_id: number;
  variant_id: number;
  nickname?: string | null;
  level: number;
  main_skill_level: number;
  main_skill_value?: number | null;
  main_skill_value_default?: number | null;
  main_skill_trigger_rate?: number | null;
  primary_type?: string | null;
  secondary_type?: string | null;
};

export type VariantData = {
  id: number;
  berries: Array<{ name: string; quantity: number }>;
  ingredients: Array<{ name: string; unlock_level?: number; unlockLevel?: number }>;
  mainSkillName?: string;
  mainSkillEffectType?: string;
  stats?: {
    base_frequency?: string | number;
    baseFrequency?: string | number;
  };
};

export type ResearchSettings = {
  favoriteBerries: string[];
  eventTypes: string[];
  eventBuffs: {
    ingredientBonus: boolean;
    skillTriggerBonus: boolean;
    skillStrengthBonus: boolean;
    dreamShardMagnetBonus: boolean;
  };
  selectedDishIds: number[];
  weights?: {
    berry: number;
    ingredient: number;
    cooking: number;
    dreamShard?: number;
    skill?: number;
  };
};

export type ScoreBreakdown = {
  berryScore: number;
  ingredientScore: number;
  cookingScore: number;
  skillScore: number;
  totalScore: number;
  details: {
    expectedHelps: number;
    expectedTriggers: number;
    berryEV: number;
    ingredientEV: number;
    skillEV: number;
    cookingEV: number;
    skillValueUsed: number;
    deltaP: number;
    triggerRateUsed: number;
    triggerMultiplierUsed: number;
    typesUsed: string[];
    isBuffedType: boolean;
    triggerMultiplierApplied: number;
  };
  reasons: string[];
};

export type ScoredEntry = {
  entry: PokemonBoxEntry;
  dominant: "berry" | "ingredient" | "skill";
  breakdown: ScoreBreakdown;
};

const parseFrequencySeconds = (value?: string | number): number => {
  if (typeof value === "number") {
    return value;
  }
  if (!value || typeof value !== "string") {
    return 3600;
  }
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return 3600;
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
};

const expectedHelpsPerDay = (baseFrequencySeconds: number) =>
  (86400 / baseFrequencySeconds) * AVG_ENERGY_MULTIPLIER;

const isEventType = (entry: PokemonBoxEntry, settings: ResearchSettings) =>
  settings.eventTypes.some(
    (type) => type === entry.primary_type || type === entry.secondary_type
  );

const getBerryStrength = (
  berryMap: Map<string, { baseStrength?: number }>,
  berryName: string
) => berryMap.get(berryName.toLowerCase())?.baseStrength || 1;

const classifySkill = (effectType = "", skillName = "") => {
  if (effectType === "extra_tasty") {
    return "cooking";
  }
  if (effectType === "energy_restore") {
    return "energy";
  }
  if (effectType === "pot_expand") {
    return "cooking";
  }
  if (effectType === "ingredient_magnet" || effectType === "ingredient_draw") {
    return "ingredient";
  }
  if (effectType === "dream_shard") {
    return "shard";
  }
  if (effectType === "snorlax_strength" || effectType === "berry_burst") {
    return "strength";
  }
  const name = skillName.toLowerCase();
  if (name.includes("cooking") || name.includes("tasty")) {
    return "cooking";
  }
  if (name.includes("charge strength") || name.includes("berry burst")) {
    return "strength";
  }
  return "strength";
};

const normalizeWeights = (weights?: ResearchSettings["weights"]) => {
  if (!weights) {
    return DEFAULT_WEIGHTS;
  }
  const dreamShard =
    typeof weights.dreamShard === "number"
      ? weights.dreamShard
      : typeof weights.skill === "number"
        ? weights.skill
        : DEFAULT_WEIGHTS.dreamShard;
  return {
    berry:
      typeof weights.berry === "number" ? weights.berry : DEFAULT_WEIGHTS.berry,
    ingredient:
      typeof weights.ingredient === "number"
        ? weights.ingredient
        : DEFAULT_WEIGHTS.ingredient,
    cooking:
      typeof weights.cooking === "number"
        ? weights.cooking
        : DEFAULT_WEIGHTS.cooking,
    dreamShard
  };
};

export const scorePokemon = (
  entry: PokemonBoxEntry,
  variant: VariantData | undefined,
  settings: ResearchSettings,
  berryMap: Map<string, { baseStrength?: number }>,
  ingredientDemand: Map<string, number>
): ScoredEntry => {
  const weights = normalizeWeights(settings.weights);
  const baseFrequencySeconds = parseFrequencySeconds(
    variant?.stats?.base_frequency ?? variant?.stats?.baseFrequency
  );
  const helps = expectedHelpsPerDay(baseFrequencySeconds);
  const favoriteSet = new Set(
    settings.favoriteBerries.map((berry) => berry.toLowerCase())
  );
  const eventTypeActive = isEventType(entry, settings);
  const ingredientMultiplier =
    eventTypeActive && settings.eventBuffs.ingredientBonus
      ? EVENT_MULTIPLIERS.ingredient
      : 1;
  const skillTriggerMultiplier =
    eventTypeActive && settings.eventBuffs.skillTriggerBonus
      ? EVENT_MULTIPLIERS.skillTrigger
      : 1;
  const skillStrengthMultiplier =
    eventTypeActive && settings.eventBuffs.skillStrengthBonus
      ? EVENT_MULTIPLIERS.skillStrength
      : 1;
  const dreamShardMultiplier =
    eventTypeActive && settings.eventBuffs.dreamShardMagnetBonus
      ? EVENT_MULTIPLIERS.dreamShard
      : 1;

  let berryEV = 0;
  const reasons: string[] = [];
  (variant?.berries || []).forEach((drop) => {
    const isFavorite = favoriteSet.has(drop.name.toLowerCase());
    const multiplier = isFavorite ? 2 : 1;
    berryEV +=
      helps * (drop.quantity || 1) * getBerryStrength(berryMap, drop.name) * multiplier;
    if (isFavorite) {
      reasons.push(`Favorite berry match (x2)`);
    }
  });

  const unlockedIngredients = (variant?.ingredients || []).filter(
    (ingredient) =>
      (ingredient.unlock_level ?? ingredient.unlockLevel ?? 1) <= entry.level
  );
  const ingredientQuantity = helps * unlockedIngredients.length * ingredientMultiplier;
  const coverage = unlockedIngredients.reduce((total, ingredient) => {
    const weight = ingredientDemand.get(ingredient.name.toLowerCase()) || 1;
    return total + weight;
  }, 0);
  if (unlockedIngredients.length >= 2) {
    reasons.push(`Covers ${unlockedIngredients.length} early ingredients`);
  }
  const ingredientEV = ingredientQuantity;

  const mainSkillName = variant?.mainSkillName || "";
  const mainSkillEffectType = variant?.mainSkillEffectType || "";
  const mainSkillValueRaw =
    entry.main_skill_value ?? entry.main_skill_value_default ?? 0;
  const mainSkillValue = Number.isFinite(Number(mainSkillValueRaw))
    ? Number(mainSkillValueRaw)
    : 0;
  const triggerRate = Number.isFinite(Number(entry.main_skill_trigger_rate))
    ? Number(entry.main_skill_trigger_rate)
    : DEFAULT_TRIGGER_RATE;
  const skillCategory = classifySkill(mainSkillEffectType, mainSkillName);

  let energyMultiplier = 1;
  let skillGrowthEV = 0;
  let skillIngredientEV = 0;
  let skillCookingEV = 0;
  let skillShardEV = 0;
  let deltaP = 0;
  let triggerMultiplierUsed = skillTriggerMultiplier;
  let triggerRateUsed = triggerRate;
  const expectedTriggers = helps * triggerRate * triggerMultiplierUsed;
  const typesUsed = [
    entry.primary_type,
    entry.secondary_type
  ].filter(Boolean);

  if (skillCategory === "ingredient") {
    skillIngredientEV = mainSkillValue * expectedTriggers * ingredientMultiplier;
    reasons.push("Ingredient skill support");
  } else if (skillCategory === "energy") {
    const energyBoost = Math.min(0.25, mainSkillValue / 100);
    energyMultiplier = 1 + energyBoost;
    reasons.push("Energy skill boosts help speed");
  } else if (skillCategory === "cooking") {
    triggerMultiplierUsed = skillTriggerMultiplier;
    triggerRateUsed = triggerRate;
    if (mainSkillEffectType === "extra_tasty" || mainSkillName.toLowerCase().includes("tasty chance")) {
      deltaP = (mainSkillValue / 100) * triggerRate * triggerMultiplierUsed;
      reasons.push(
        `Tasty Chance expected +${(deltaP * 100).toFixed(1)}% (event-adjusted)`
      );
    } else {
      skillCookingEV = mainSkillValue * triggerRate * triggerMultiplierUsed * 0.5;
      reasons.push("Cooking-related skill");
    }
  } else if (skillCategory === "strength") {
    skillGrowthEV =
      mainSkillValue *
      expectedTriggers *
      skillStrengthMultiplier;
    reasons.push("Direct strength skill");
  } else if (skillCategory === "shard") {
    skillShardEV =
      mainSkillValue *
      expectedTriggers *
      dreamShardMultiplier;
  }

  const berryScore = berryEV * energyMultiplier + skillGrowthEV;
  const ingredientScore =
    ingredientQuantity * energyMultiplier + coverage + skillIngredientEV;

  const cookingRatio = Math.min(
    1,
    (ingredientQuantity * energyMultiplier) / COOKING_DAILY_NEED
  );
  const potFillScore = Math.sqrt(cookingRatio) * 100;
  const cookingBonusEV = deltaP > 0 ? potFillScore * deltaP : 0;
  const cookingEV = potFillScore + cookingBonusEV + skillCookingEV;
  if (cookingRatio >= 0.6) {
    reasons.push("Likely to fill pot daily");
  }

  const cookingScore = cookingEV;
  const skillScore =
    skillGrowthEV + skillIngredientEV + skillCookingEV + skillShardEV;
  const totalScore =
    weights.berry * berryScore +
    weights.ingredient * ingredientScore +
    weights.cooking * cookingScore +
    weights.dreamShard * skillShardEV;

  const dominant = (() => {
    const buckets: Array<[ScoredEntry["dominant"], number]> = [
      ["berry", berryScore],
      ["ingredient", ingredientScore],
      ["skill", skillScore]
    ];
    return buckets.sort((a, b) => b[1] - a[1])[0][0];
  })();

  return {
    entry,
    dominant,
    breakdown: {
      berryScore,
      ingredientScore,
      cookingScore,
      skillScore,
      totalScore,
      details: {
        expectedHelps: helps,
        expectedTriggers,
        berryEV,
        ingredientEV,
        skillEV: skillScore,
        cookingEV,
        skillValueUsed: mainSkillValue,
        deltaP,
        triggerRateUsed,
        triggerMultiplierUsed,
        typesUsed,
        isBuffedType: eventTypeActive,
        triggerMultiplierApplied: triggerMultiplierUsed
      },
      reasons: reasons.slice(0, 3)
    }
  };
};

export const scoreAll = (
  entries: PokemonBoxEntry[],
  variantById: Map<number, VariantData>,
  settings: ResearchSettings,
  berryMap: Map<string, { baseStrength?: number }>,
  ingredientDemand: Map<string, number>
) =>
  entries.map((entry) =>
    scorePokemon(
      entry,
      variantById.get(entry.variant_id),
      settings,
      berryMap,
      ingredientDemand
    )
  );

export const pickTeam = (scoredEntries: ScoredEntry[]) => {
  const buckets = {
    berry: scoredEntries.filter((entry) => entry.dominant === "berry"),
    ingredient: scoredEntries.filter((entry) => entry.dominant === "ingredient"),
    skill: scoredEntries.filter((entry) => entry.dominant === "skill")
  };
  const used = new Set<number>();
  const team: ScoredEntry[] = [];

  const takeTop = (list: ScoredEntry[], count: number) => {
    list
      .filter((entry) => !used.has(entry.entry.id))
      .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore)
      .slice(0, count)
      .forEach((entry) => {
        team.push(entry);
        used.add(entry.entry.id);
      });
  };

  takeTop(buckets.ingredient, 2);
  takeTop(buckets.berry, 2);

  const remaining = scoredEntries
    .filter((entry) => !used.has(entry.entry.id))
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);

  if (remaining[0]) {
    team.push(remaining[0]);
    used.add(remaining[0].entry.id);
  }

  remaining.slice(1).forEach((entry) => {
    if (team.length >= 5) {
      return;
    }
    team.push(entry);
  });

  return team;
};
