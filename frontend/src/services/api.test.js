import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { api, setToken } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  setToken(null);
});
describe("cookie authentication CSRF boundary", () => {
  it("obtains a CSRF cookie/token before submitting login with credentials enabled", async () => {
    const csrf = vi
      .spyOn(axios, "get")
      .mockResolvedValue({ data: { csrfToken: "test-csrf-token" } });
    const adapter = vi.fn(async (config) => ({
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));
    await api.post(
      "/auth/login/",
      { email: "test@example.invalid" },
      { adapter },
    );
    expect(csrf).toHaveBeenCalledWith("/api/auth/csrf/", {
      withCredentials: true,
    });
    const config = adapter.mock.calls[0][0];
    expect(config.headers["X-CSRFToken"]).toBe("test-csrf-token");
    expect(config.withCredentials).toBe(true);
  });
});
