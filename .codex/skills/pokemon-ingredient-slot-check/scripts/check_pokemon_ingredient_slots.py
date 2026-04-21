#!/usr/bin/env python3

import json
import sys
from pathlib import Path


EXPECTED_SLOTS = ("1", "30", "60")
SPECIAL_COMPLETENESS_RULES_PATH = (
    Path(__file__).resolve().parent.parent
    / "references"
    / "special-completeness-rules.json"
)


def load_special_completeness_rules():
    with SPECIAL_COMPLETENESS_RULES_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    rules = {}
    for dex_no, rule in payload.items():
        rules[int(dex_no)] = rule
    return rules


SPECIAL_COMPLETENESS_RULES = load_special_completeness_rules()


def load_seed_files(seed_dir: Path):
    files = sorted(seed_dir.glob("[0-9][0-9][0-9]-[0-9][0-9][0-9].json"))
    if not files:
      raise SystemExit(f"No Pokemon seed range files found in {seed_dir}")
    payloads = []
    for file_path in files:
        with file_path.open("r", encoding="utf-8") as handle:
            payloads.append((file_path, json.load(handle)))
    return payloads


def clone_ingredient_options(ingredient_options):
    return {
        slot: [
            {
                "name": option["name"],
                "quantity": option["quantity"],
            }
            for option in ingredient_options.get(slot, [])
        ]
        for slot in EXPECTED_SLOTS
    }


def validate_option(option, context, errors):
    if not isinstance(option, dict):
        errors.append(f"{context}: ingredient option must be an object")
        return None
    name = option.get("name")
    quantity = option.get("quantity")
    if not isinstance(name, str) or not name.strip():
        errors.append(f"{context}: ingredient option must have a non-empty name")
        return None
    if not isinstance(quantity, int) or quantity < 1:
        errors.append(f"{context}: ingredient '{name}' must have a positive integer quantity")
        return None
    return name


def build_quantity_map(options):
    quantities = {}
    for option in options:
        name = option.get("name")
        quantity = option.get("quantity")
        if isinstance(name, str) and isinstance(quantity, int):
            quantities[name] = quantity
    return quantities


def evaluate_completeness(slot_options, dex_no=None):
    quantities_1 = build_quantity_map(slot_options.get("1", []))
    quantities_30 = build_quantity_map(slot_options.get("30", []))
    quantities_60 = build_quantity_map(slot_options.get("60", []))

    reasons = []
    special_rule = SPECIAL_COMPLETENESS_RULES.get(dex_no)
    expected_counts = (
        special_rule["slot_counts"]
        if special_rule
        else {"1": 1, "30": 2, "60": 3}
    )

    if len(quantities_1) != expected_counts["1"]:
        reasons.append(
            f"slot 1 has {len(quantities_1)} ingredients, expected {expected_counts['1']}"
        )
    if len(quantities_30) != expected_counts["30"]:
        reasons.append(
            f"slot 30 has {len(quantities_30)} ingredients, expected {expected_counts['30']}"
        )
    if len(quantities_60) != expected_counts["60"]:
        reasons.append(
            f"slot 60 has {len(quantities_60)} ingredients, expected {expected_counts['60']}"
        )

    missing_in_30 = sorted(set(quantities_1) - set(quantities_30))
    if missing_in_30:
        reasons.append(
            "slot 30 is missing slot 1 ingredients: "
            + ", ".join(missing_in_30)
        )

    missing_in_60 = sorted((set(quantities_1) | set(quantities_30)) - set(quantities_60))
    if missing_in_60:
        reasons.append(
            "slot 60 is missing slot 1/30 ingredients: "
            + ", ".join(missing_in_60)
        )

    for name, quantity_1 in quantities_1.items():
        quantity_30 = quantities_30.get(name)
        if quantity_30 is None:
            continue
        if quantity_30 <= quantity_1:
            reasons.append(
                f"slot 30 ingredient '{name}' has quantity {quantity_30}, expected greater than slot 1 quantity {quantity_1}"
            )

    for name, quantity_30 in quantities_30.items():
        quantity_60 = quantities_60.get(name)
        if quantity_60 is None:
            continue
        if quantity_60 <= quantity_30:
            reasons.append(
                f"slot 60 ingredient '{name}' has quantity {quantity_60}, expected greater than slot 30 quantity {quantity_30}"
            )

    return len(reasons) == 0, reasons, special_rule["label"] if special_rule else None


def parse_inheritance_reference(reference, context, errors):
    if isinstance(reference, int):
        return (reference, "default")
    if not isinstance(reference, dict):
        errors.append(
            f"{context}: inheritIngredientOptionsFrom must be an object or integer dexNo"
        )
        return None
    dex_no = reference.get("dexNo")
    if not isinstance(dex_no, int):
        errors.append(f"{context}: inheritIngredientOptionsFrom.dexNo must be an integer")
        return None
    variant_key = reference.get("variantKey")
    if variant_key is None:
        variant_key = "default"
    elif not isinstance(variant_key, str) or not variant_key.strip():
        errors.append(
            f"{context}: inheritIngredientOptionsFrom.variantKey must be a non-empty string"
        )
        return None
    return (dex_no, variant_key)


def build_variant_index(payloads):
    variant_index = {}
    for source_file, payload in payloads:
        species_list = payload.get("species", [])
        if not isinstance(species_list, list):
            continue
        for species in species_list:
            dex_no = species.get("dexNo")
            species_name = species.get("name", f"dex {dex_no}")
            for variant in species.get("variants", []):
                variant_key = variant.get("key")
                if not isinstance(variant_key, str):
                    continue
                variant_index[(dex_no, variant_key)] = {
                    "source_file": source_file,
                    "species": species,
                    "species_name": species_name,
                    "variant": variant,
                    "variant_name": variant.get("name") or variant_key,
                }
    return variant_index


def resolve_variant_ingredient_options(variant_record, variant_index, errors, resolving):
    variant = variant_record["variant"]
    ingredient_options = variant.get("ingredientOptions")
    if isinstance(ingredient_options, dict):
        return ingredient_options

    inherit_reference = variant.get("inheritIngredientOptionsFrom")
    context = (
        f"{variant_record['source_file'].name} :: "
        f"{variant_record['species_name']} [{variant_record['variant_name']}]"
    )
    parsed_reference = parse_inheritance_reference(
        inherit_reference,
        f"{context}",
        errors,
    )
    if parsed_reference is None:
        return None

    resolution_key = (variant_record["species"].get("dexNo"), variant.get("key"))
    if resolution_key in resolving:
        errors.append(f"{context}: cyclic ingredient inheritance detected")
        return None

    target_record = variant_index.get(parsed_reference)
    if target_record is None:
        errors.append(
            f"{context}: inherits ingredientOptions from missing dexNo {parsed_reference[0]} variant \"{parsed_reference[1]}\""
        )
        return None

    resolving.add(resolution_key)
    resolved = resolve_variant_ingredient_options(
        target_record,
        variant_index,
        errors,
        resolving,
    )
    resolving.remove(resolution_key)
    if resolved is None:
        return None

    normalized = clone_ingredient_options(resolved)
    variant["ingredientOptions"] = normalized
    return normalized


def validate_species(
    species,
    source_file: Path,
    errors,
    target_dex_nos,
    completeness_results,
    variant_index,
):
    dex_no = species.get("dexNo")
    if target_dex_nos and dex_no not in target_dex_nos:
        return

    species_name = species.get("name", f"dex {dex_no}")
    for variant in species.get("variants", []):
        variant_name = variant.get("name") or variant.get("key") or "unknown"
        context_base = f"{source_file.name} :: {species_name} [{variant_name}]"
        ingredient_options = resolve_variant_ingredient_options(
            {
                "source_file": source_file,
                "species": species,
                "species_name": species_name,
                "variant": variant,
                "variant_name": variant_name,
            },
            variant_index,
            errors,
            set(),
        )
        if not isinstance(ingredient_options, dict):
            errors.append(f"{context_base}: missing ingredientOptions")
            continue

        slot_names = {}
        slot_options = {}
        for slot in EXPECTED_SLOTS:
            options = ingredient_options.get(slot)
            if not isinstance(options, list):
                errors.append(f"{context_base}: slot {slot} must be an array")
                continue
            slot_options[slot] = options
            names = []
            seen = set()
            for index, option in enumerate(options):
                name = validate_option(
                    option,
                    f"{context_base} slot {slot} option {index}",
                    errors
                )
                if not name:
                    continue
                if name in seen:
                    errors.append(f"{context_base}: duplicate ingredient '{name}' in slot {slot}")
                    continue
                seen.add(name)
                names.append(name)
            slot_names[slot] = names

        names_1 = set(slot_names.get("1", []))
        names_30 = set(slot_names.get("30", []))
        names_60 = set(slot_names.get("60", []))

        is_complete, reasons, completeness_rule = evaluate_completeness(
            slot_options,
            dex_no=dex_no,
        )
        completeness_results.append({
            "dexNo": dex_no,
            "speciesName": species_name,
            "variantName": variant_name,
            "complete": is_complete,
            "reasons": reasons,
            "ruleLabel": completeness_rule,
        })


def parse_target_dex_nos(arguments):
    dex_nos = set()
    for argument in arguments:
        try:
            dex_nos.add(int(argument))
        except ValueError as exc:
            raise SystemExit(f"Invalid dex number '{argument}': {exc}") from exc
    return dex_nos


def main():
    repo_root = Path(__file__).resolve().parents[4]
    seed_dir = repo_root / "server" / "data" / "pokemon_seed"
    target_dex_nos = parse_target_dex_nos(sys.argv[1:])
    errors = []
    completeness_results = []
    payloads = load_seed_files(seed_dir)
    variant_index = build_variant_index(payloads)

    for source_file, payload in payloads:
        species_list = payload.get("species", [])
        if not isinstance(species_list, list):
            errors.append(f"{source_file.name}: top-level species must be an array")
            continue
        for species in species_list:
            validate_species(
                species,
                source_file,
                errors,
                target_dex_nos,
                completeness_results,
                variant_index,
            )

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)

    target_label = (
        ", ".join(str(dex_no) for dex_no in sorted(target_dex_nos))
        if target_dex_nos
        else "all Pokemon"
    )
    print(f"OK: ingredient slot data validated for {target_label}")

    for result in completeness_results:
        status = "COMPLETE" if result["complete"] else "INCOMPLETE"
        line = f"{status}: dex {result['dexNo']} {result['speciesName']} [{result['variantName']}]"
        if result["ruleLabel"]:
            line += f" using special rule for {result['ruleLabel']}"
        print(line)
        for reason in result["reasons"]:
            print(f"  - {reason}")


if __name__ == "__main__":
    main()
