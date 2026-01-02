-- Normalize variant ingredient unlock levels to a single pool.
update pokemon_variant_ingredients
set unlock_level = 1
where unlock_level is null or unlock_level != 1;
