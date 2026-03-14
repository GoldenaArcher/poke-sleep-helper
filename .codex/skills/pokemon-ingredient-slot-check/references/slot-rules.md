# Slot Rules

- Pokemon ingredient data lives in `server/data/pokemon_seed/*.json`.
- Each variant should use `ingredientOptions` with `"1"`, `"30"`, and `"60"` keys.
- Slot 30 must include all slot 1 ingredient names.
- Slot 60 must include all slot 1 and slot 30 ingredient names.
- When a higher-slot quantity is not confirmed yet, keep the inherited ingredient with a placeholder quantity instead of removing it.
- After changing slot data, run:
  - `python3 .codex/skills/pokemon-ingredient-slot-check/scripts/check_pokemon_ingredient_slots.py [dexNo ...]`
  - `npm run test --workspace server`
