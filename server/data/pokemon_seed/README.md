# Pokemon Seed Notes

## Ingredient Slot Rule

Pokemon ingredient data is modeled as slot-specific options under `ingredientOptions`:

- `"1"`: options available for the Lv 1 ingredient slot
- `"30"`: options available for the Lv 30 ingredient slot
- `"60"`: options available for the Lv 60 ingredient slot

Each option is stored as:

```json
{
  "name": "Fancy Apple",
  "quantity": 1
}
```

## Inheritance Convention

If an evolution or variant uses the exact same ingredient slot data as another seeded species, a variant may omit `ingredientOptions` and use:

```json
{
  "inheritIngredientOptionsFrom": {
    "dexNo": 74,
    "variantKey": "default"
  }
}
```

`variantKey` is optional and defaults to `"default"`.

Use this only when the full slot data is identical. If the species differs at any slot or quantity, keep a full inline `ingredientOptions` block instead.

Higher-level slots should include lower-level ingredient possibilities when they remain selectable in-game.

Example:

- If Lv 1 has `Fancy Apple x1`
- And Lv 30 unlocks `Warming Ginger x2`

Then Lv 30 should list both:

- `Fancy Apple x?`
- `Warming Ginger x2`

If the higher-slot quantity for an inherited ingredient is not yet confirmed, keep the inherited ingredient with a placeholder quantity based on the best known value for now and update it later when verified.

## Current Placeholder Convention

When exact higher-slot quantities are unknown:

- keep the inherited ingredient in that slot
- use the best known placeholder quantity instead of omitting it
- prefer a conservative placeholder already confirmed from a lower slot

This keeps slot-option coverage correct even when exact counts are still incomplete.

## Unsupported Metadata

Keep these seed files focused on data that is actually seeded and consumed by the app.

- Do not add `locations` to species entries.
- If location data becomes useful later, add it back together with a schema/API consumer instead of keeping it as dead seed metadata.
