import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Login, Signup } from "./Public.jsx";
import { Goals } from "./Features.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

vi.mock("../services/api.js", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("../contexts/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const goalRecord = {
  goal_type: "healthy_eating",
  calories: 2100,
  protein: 105,
  carbohydrates: 250,
  fat: 70,
  water_ml: 2500,
  target_weight_kg: null,
};

function setup(component) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{component}</MemoryRouter>
      </QueryClientProvider>,
    ),
    user: userEvent.setup(),
    client,
  };
}

describe("Account forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: null,
      login: vi.fn(),
      signup: vi.fn(),
      acceptSession: vi.fn(),
    });
  });
  afterEach(cleanup);

  it("keeps incomplete login credentials out of the authentication request", async () => {
    const { user } = setup(<Login />);
    await user.click(screen.getByRole("button", { name: /^Log in$/i }));
    expect(await screen.findByText("Enter your password.")).toBeInTheDocument();
    expect(useAuth().login).not.toHaveBeenCalled();
  });

  it("requires a long enough signup password before creating an account", async () => {
    const { user } = setup(<Signup />);
    await user.type(screen.getByLabelText("Full name"), "Asha Mehta");
    await user.type(screen.getByLabelText("Email address"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /Create account/i }));
    expect(
      await screen.findByText("Use at least 10 characters."),
    ).toBeInTheDocument();
    expect(useAuth().signup).not.toHaveBeenCalled();
  });
});

describe("Personal nutrition targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: goalRecord });
    api.put.mockResolvedValue({ data: goalRecord });
  });
  afterEach(cleanup);

  it("loads database targets and submits numeric updates with an optional empty target weight", async () => {
    const { user } = setup(<Goals />);
    const calories = await screen.findByLabelText("Daily calories (kcal)");
    await waitFor(() => expect(calories).toHaveValue(2100));
    await user.clear(calories);
    await user.type(calories, "2300");
    await user.click(screen.getByRole("button", { name: /Save my goals/i }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/goals/", {
        ...goalRecord,
        calories: 2300,
      }),
    );
  });

  it("rejects an invalid calorie target without changing the stored goal", async () => {
    const { user } = setup(<Goals />);
    const calories = await screen.findByLabelText("Daily calories (kcal)");
    await waitFor(() => expect(calories).toHaveValue(2100));
    await user.clear(calories);
    await user.type(calories, "100");
    // Submit directly to exercise schema validation as well as the HTML minimum.
    const form = calories.closest("form");
    form.noValidate = true;
    await user.click(screen.getByRole("button", { name: /Save my goals/i }));
    expect(
      await screen.findByText("Choose at least 500 kcal."),
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
