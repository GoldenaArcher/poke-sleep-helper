export const normalizeText = (value = "") =>
  String(value).trim().toLowerCase();

export const findByName = (items, name) => {
  const needle = normalizeText(name);
  return items.find((item) => normalizeText(item.name ?? item) === needle);
};
