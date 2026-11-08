// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../src/server.js";
import { DEFAULT_ENDPOINT } from "../src/wire.js";

const fetch = vi.fn(async (_endpoint: string, _init?: RequestInit) => new Response(null, { status: 202 }));

beforeEach(() => {
  fetch.mockClear();
  vi.stubGlobal("fetch", fetch);
});

afterEach(() => vi.unstubAllEnvs());

const sentBody = () => JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));

describe("server track", () => {
  it("sends one server event as JSON to the default collector", async () => {
    await track("payment", { amount: 49 }, { siteKey: "site_server" });
    const [endpoint, init] = fetch.mock.calls[0] ?? [];
    expect([endpoint, init?.headers, sentBody()]).toEqual([
      DEFAULT_ENDPOINT,
      { "content-type": "application/json" },
      { siteKey: "site_server", server: true, events: [{ kind: "event", name: "payment", data: { amount: 49 } }] },
    ]);
  });

  it("answers whether the collector kept it", async () => {
    fetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect(await track("payment", undefined, { siteKey: "site_server" })).toBe(false);
  });

  it("answers true when it was kept", async () => {
    expect(await track("payment", undefined, { siteKey: "site_server" })).toBe(true);
  });

  it("reads its own variables first", async () => {
    vi.stubEnv("BORROMIC_ANALYTICS_KEY", "site_server_env");
    vi.stubEnv("NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY", "site_public_env");
    vi.stubEnv("BORROMIC_ANALYTICS_ENDPOINT", "https://collector.example.com/e");
    await track("payment");
    expect([fetch.mock.calls[0]?.[0], sentBody().siteKey]).toEqual([
      "https://collector.example.com/e",
      "site_server_env",
    ]);
  });

  it("falls back on the browser's variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY", "site_public_env");
    vi.stubEnv("NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT", "https://collector.example.org/e");
    await track("payment");
    expect([fetch.mock.calls[0]?.[0], sentBody().siteKey]).toEqual([
      "https://collector.example.org/e",
      "site_public_env",
    ]);
  });

  it("sends nothing without a site key", async () => {
    expect(await track("payment")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends nothing without a name", async () => {
    expect(await track(" ", undefined, { siteKey: "site_server" })).toBe(false);
  });

  it("never throws when the collector can't be reached", async () => {
    fetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await track("payment", undefined, { siteKey: "site_server" })).toBe(false);
  });

  it("gives up after its timeout", async () => {
    fetch.mockImplementationOnce(
      (_endpoint, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    expect(await track("payment", undefined, { siteKey: "site_server", timeoutMs: 10 })).toBe(false);
  });
});
