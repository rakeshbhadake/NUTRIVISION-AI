import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  Check,
  Pencil,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { Button, Field, Input, Card, Badge } from "./ui";
import {
  normalizeItem,
  normalizeCatalogFood,
  scaleItem,
  sumItems,
  number,
  asList,
  errorMessage,
  nutrientKeys,
} from "../utils/nutrition";

const newItem = () => ({
  name: "",
  portion_g: 100,
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  source: "User entered",
  confidence: null,
});
export function FoodPicker({ onAdd }) {
  const [query, setQuery] = useState(""),
    [manual, setManual] = useState(false),
    [item, setItem] = useState(newItem),
    [looking, setLooking] = useState(false);
  const foods = useQuery({
    queryKey: ["foods", query],
    queryFn: async () =>
      (await api.get("/foods/search/", { params: { q: query, search: query } }))
        .data,
    enabled: query.trim().length > 1,
    staleTime: 60000,
  });
  async function lookup() {
    setLooking(true);
    try {
      const { data } = await api.post("/ai/estimate/", {
        query: query.trim(),
        portion_grams: 100,
      });
      const found = data.items || (data.item ? [data.item] : []);
      if (!found.length) {
        toast.info("No food was identified. Try a more specific food name.");
        return;
      }
      found.forEach((food) => onAdd(normalizeItem(food)));
      setQuery("");
      toast.success("Food added. Review the estimate before saving.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLooking(false);
    }
  }
  return (
    <div className="food-picker">
      <div className="food-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your food database…"
          aria-label="Search foods"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setManual((value) => !value)}
        >
          <Plus size={15} /> Enter manually
        </Button>
      </div>
      {query.trim().length > 1 && (
        <div className="food-search-results">
          {foods.isPending ? (
            <p className="muted">Searching…</p>
          ) : (
            asList(foods.data).map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => {
                  onAdd(normalizeCatalogFood(food));
                  setQuery("");
                }}
              >
                <span>
                  {food.name}
                  <small>per 100 g</small>
                </span>
                <Plus size={17} />
              </button>
            ))
          )}
          {!foods.isPending && asList(foods.data).length === 0 && (
            <p className="muted">No matching foods in your database.</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={looking}
            onClick={lookup}
          >
            {looking
              ? "Looking up composition…"
              : `Look up “${query}” with AI + USDA`}
          </Button>
        </div>
      )}
      {manual && (
        <div className="manual-food-form">
          <h3>Nutrition for this portion</h3>
          <p className="muted">
            Enter the values from a food label or your own measurements.
          </p>
          <div className="form-grid">
            <Field label="Food name">
              <Input
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                placeholder="e.g. Homemade dal"
              />
            </Field>
            <Field label="Portion (g)">
              <Input
                type="number"
                min="1"
                max="10000"
                value={item.portion_g}
                onChange={(e) =>
                  setItem({ ...item, portion_g: Number(e.target.value) })
                }
              />
            </Field>
            {nutrientKeys.map((key) => (
              <Field
                label={`${key === "carbohydrates" ? "Carbs" : key[0].toUpperCase() + key.slice(1)} (${key === "calories" ? "kcal" : key === "sodium" ? "mg" : "g"})`}
                key={key}
              >
                <Input
                  type="number"
                  min="0"
                  max="100000"
                  step="0.1"
                  value={item[key]}
                  onChange={(e) =>
                    setItem({ ...item, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setManual(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!item.name.trim() || item.portion_g <= 0}
              onClick={() => {
                onAdd(item);
                setItem(newItem());
                setManual(false);
              }}
            >
              <Plus size={16} /> Add food
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function MealEditor({
  initialItems = [],
  initialMeal = {},
  onSave,
  saving = false,
  submitLabel = "Save to my journal",
}) {
  const [items, setItems] = useState(initialItems.map(normalizeItem));
  const [name, setName] = useState(initialMeal.name || "");
  const [type, setType] = useState(initialMeal.meal_type || "lunch");
  const [dateTime, setDateTime] = useState(() => {
    const date = initialMeal.eaten_at
      ? new Date(initialMeal.eaten_at)
      : new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [notes, setNotes] = useState(initialMeal.notes || "");
  const [expanded, setExpanded] = useState(null);
  const totals = sumItems(items);
  const updateItem = (index, next) =>
    setItems((old) => old.map((item, i) => (i === index ? next : item)));
  const unknownNutrients = [
    ...new Set(
      items.flatMap((item) =>
        ["fiber", "sugar", "sodium"].filter((key) => item[key] == null),
      ),
    ),
  ];
  const valid =
    items.length > 0 &&
    items.every(
      (item) =>
        item.name.trim() &&
        item.portion_g > 0 &&
        nutrientKeys.every(
          (key) =>
            (["fiber", "sugar", "sodium"].includes(key) && item[key] == null) ||
            (Number.isFinite(item[key]) && item[key] >= 0),
        ),
    ) &&
    dateTime;
  async function submit(event) {
    event.preventDefault();
    if (!valid) {
      toast.error("Add a named food and valid portion before saving.");
      return;
    }
    await onSave({
      name:
        name.trim() ||
        items
          .map((item) => item.name)
          .join(", ")
          .slice(0, 200),
      meal_type: type,
      eaten_at: new Date(dateTime).toISOString(),
      notes,
      items: items.map(normalizeItem),
    });
  }
  return (
    <form onSubmit={submit} className="meal-editor">
      <div className="form-grid meal-meta">
        <Field label="Meal name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Give this meal a name"
          />
        </Field>
        <Field label="Meal type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            {["breakfast", "lunch", "dinner", "snack"].map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date & time">
          <Input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            required
          />
        </Field>
      </div>
      <div className="detected-foods">
        {items.map((item, index) => (
          <div className="detected-food" key={index}>
            <div className="detected-food-top">
              <div className="food-index">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="detected-food-name">
                <input
                  aria-label={`Food ${index + 1} name`}
                  value={item.name}
                  onChange={(e) =>
                    updateItem(index, { ...item, name: e.target.value })
                  }
                  required
                  maxLength={200}
                />
                <span>
                  {typeof item.confidence === "number" && (
                    <Badge>
                      {Math.round(
                        item.confidence <= 1
                          ? item.confidence * 100
                          : item.confidence,
                      )}
                      % confidence
                    </Badge>
                  )}
                  <small>{item.source}</small>
                </span>
              </div>
              <label className="portion-input">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  aria-label={`Portion for ${item.name}`}
                  value={item.portion_g}
                  onChange={(e) =>
                    updateItem(index, scaleItem(item, e.target.value))
                  }
                />
                <span>g</span>
              </label>
              <strong className="food-calories">
                {number(item.calories)}
                <small>kcal</small>
              </strong>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  setItems((old) => old.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="food-macro-row">
              <span>
                P <strong>{number(item.protein, 1)}g</strong>
              </span>
              <span>
                C <strong>{number(item.carbohydrates, 1)}g</strong>
              </span>
              <span>
                F <strong>{number(item.fat, 1)}g</strong>
              </span>
              <button
                type="button"
                onClick={() => setExpanded(expanded === index ? null : index)}
              >
                <Pencil size={12} />
                {expanded === index ? "Close details" : "Edit nutrition"}
                <ChevronDown size={13} />
              </button>
            </div>
            {expanded === index && (
              <div className="food-nutrient-editor form-grid">
                {nutrientKeys.map((key) => (
                  <Field
                    key={key}
                    label={`${key} (${key === "calories" ? "kcal" : key === "sodium" ? "mg" : "g"})`}
                  >
                    <Input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.1"
                      value={item[key] ?? ""}
                      placeholder="Unknown"
                      onChange={(e) =>
                        updateItem(index, {
                          ...item,
                          [key]:
                            e.target.value === "" &&
                            ["fiber", "sugar", "sodium"].includes(key)
                              ? null
                              : Number(e.target.value),
                          source: "User corrected",
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <FoodPicker onAdd={(item) => setItems((old) => [...old, item])} />
      {unknownNutrients.length > 0 && (
        <p className="nutrition-unknown-note">
          <Info size={14} /> {unknownNutrients.join(", ")} values are
          unavailable for some foods. These will remain unknown in your journal.
        </p>
      )}
      <Field label="A note for your journal (optional)">
        <textarea
          className="input"
          rows="2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="How did this meal make you feel?"
        />
      </Field>
      <div className="meal-total">
        <span>
          Meal total
          <strong>
            {number(totals.calories)} <small>kcal</small>
          </strong>
        </span>
        <div>
          <span>
            Protein <strong>{number(totals.protein, 1)}g</strong>
          </span>
          <span>
            Carbs <strong>{number(totals.carbohydrates, 1)}g</strong>
          </span>
          <span>
            Fats <strong>{number(totals.fat, 1)}g</strong>
          </span>
        </div>
      </div>
      <div className="save-meal-footer">
        <p>
          <Info size={15} /> Review estimates and adjust portions to match your
          plate.
        </p>
        <Button type="submit" disabled={!valid || saving}>
          <Check size={17} />
          {saving ? "Saving meal…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
