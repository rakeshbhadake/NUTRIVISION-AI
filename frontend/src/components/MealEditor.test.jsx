import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MealEditor from "./MealEditor";
import {
  normalizeItem,
  scaleItem,
  sumItems,
  localDate,
  normalizeCatalogFood,
} from "../utils/nutrition";

const original = {
  name: "Test food",
  portion_g: 100,
  calories: 180,
  protein: 9,
  carbohydrates: 20,
  fat: 7,
  fiber: null,
  sugar: null,
  sodium: 15,
  source: "Test label",
  source_url: "https://example.com/food",
  is_estimate: true,
};
describe("nutrition review and portion correction", () => {
  it("normalizes catalog composition from a nonstandard gram basis", () => {
    const food = normalizeCatalogFood({
      name: "Test label",
      nutrition: {
        basis_grams: 50,
        calories: 120,
        protein: 5,
        carbohydrates: 15,
        fat: 4,
        fiber: null,
        sugar: null,
        sodium: 10,
      },
    });
    expect(food).toMatchObject({
      portion_g: 100,
      calories: 240,
      protein: 10,
      carbohydrates: 30,
      fat: 8,
      fiber: null,
      sodium: 20,
    });
  });
  it("rescales totals and preserves unknown nutrients and provenance", () => {
    const next = scaleItem(normalizeItem(original), 250);
    expect(next).toMatchObject({
      calories: 450,
      protein: 22.5,
      carbohydrates: 50,
      fat: 17.5,
      fiber: null,
      sugar: null,
      sodium: 37.5,
      source_url: original.source_url,
      is_estimate: true,
    });
    expect(next.unknown_nutrients).toEqual(["fiber", "sugar"]);
    expect(sumItems([next, original]).calories).toBe(630);
  });
  it("uses the local calendar date instead of slicing a UTC timestamp", () => {
    expect(localDate(new Date(2026, 10, 10, 0, 5))).toBe("2026-11-10");
  });
  it("saves corrected portions and names with recalculated nutrients", async () => {
    const save = vi.fn().mockResolvedValue({});
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MealEditor initialItems={[original]} onSave={save} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Portion for Test food"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Food 1 name"), {
      target: { value: "Corrected food name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to my journal" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].items[0]).toMatchObject({
      name: "Corrected food name",
      portion_g: 200,
      calories: 360,
      protein: 18,
      fiber: null,
      unknown_nutrients: ["fiber", "sugar"],
    });
  });
});
