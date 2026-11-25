export const nutrientKeys = [
  "calories",
  "protein",
  "carbohydrates",
  "fat",
  "fiber",
  "sugar",
  "sodium",
];
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const number = (value, digits = 0) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
export const asList = (data) =>
  Array.isArray(data) ? data : data?.results || [];
export function normalizeItem(item) {
  const n = item.nutrition || item;
  const unknown = nutrientKeys.filter(
    (key) => ["fiber", "sugar", "sodium"].includes(key) && n[key] == null,
  );
  return {
    name: item.name || item.food_name || "",
    portion_g: Number(item.portion_g ?? item.portion_grams ?? 100),
    ...Object.fromEntries(
      nutrientKeys.map((key) => [
        key,
        unknown.includes(key)
          ? null
          : Number(n[key] ?? (key === "carbohydrates" ? n.carbs : 0) ?? 0),
      ]),
    ),
    confidence: item.confidence ?? null,
    source:
      typeof item.source === "string"
        ? item.source
        : item.source?.name || n.source || "User entered",
    source_url: item.source_url || item.source?.url || "",
    source_id: String(item.source_id || item.source?.id || ""),
    is_estimate: item.is_estimate ?? item.estimated ?? false,
    unknown_nutrients: unknown,
  };
}
export function scaleItem(item, portion) {
  const next = Math.max(1, Math.min(10000, Number(portion) || 1));
  const ratio = next / Math.max(1, Number(item.portion_g));
  return {
    ...item,
    portion_g: next,
    ...Object.fromEntries(
      nutrientKeys.map((key) => [
        key,
        item[key] == null
          ? null
          : Math.round(Number(item[key]) * ratio * 100) / 100,
      ]),
    ),
  };
}
export function normalizeCatalogFood(food) {
  const nutrition = food.nutrition || food.nutrition_information || {};
  return scaleItem(
    normalizeItem({
      ...food,
      nutrition,
      portion_g: Number(nutrition.basis_grams || 100),
      source: food.source || "Food database",
    }),
    100,
  );
}
export const sumItems = (items) =>
  Object.fromEntries(
    nutrientKeys.map((key) => [
      key,
      items.reduce((sum, item) => sum + Number(item[key] || 0), 0),
    ]),
  );
export const errorMessage = (error) => {
  const d = error?.response?.data;
  if (typeof d?.detail === "string") return d.detail;
  if (typeof d?.error === "string") return d.error;
  if (d && typeof d === "object")
    return Object.entries(d)
      .map(
        ([key, value]) =>
          `${key === "non_field_errors" ? "" : `${key}: `}${Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : JSON.stringify(value)}`,
      )
      .join(" ");
  return error?.message || "Something went wrong. Please try again.";
};
