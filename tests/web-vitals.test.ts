import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inject } from "../src/tracker.js";
import { watchWebVitals } from "../src/web-vitals.js";
import { freshPage, hidePage, stubNetwork } from "./support.js";

type Listener = (list: { getEntries: () => PerformanceEntry[] }) => void;

/** A browser's performance timeline that the test feeds by hand. */
class FakeObserver {
  static byType = new Map<string, FakeObserver>();
  static unsupported = new Set<string>();
  disconnected = false;
  constructor(private readonly listener: Listener) {}
  observe({ type }: { type: string }) {
    if (FakeObserver.unsupported.has(type)) throw new TypeError(`${type} isn't supported`);
    FakeObserver.byType.set(type, this);
  }
  disconnect() {
    this.disconnected = true;
  }
  static emit(type: string, ...entries: Record<string, unknown>[]) {
    FakeObserver.byType.get(type)?.listener({ getEntries: () => entries as unknown as PerformanceEntry[] });
  }
}

let network: ReturnType<typeof stubNetwork>;

beforeEach(() => {
  freshPage("/article");
  FakeObserver.byType.clear();
  FakeObserver.unsupported.clear();
  vi.stubGlobal("PerformanceObserver", FakeObserver);
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { responseStart: 180.4, activationStart: 0 } as unknown as PerformanceEntry,
  ]);
  network = stubNetwork();
  inject({ siteKey: "site_test" });
});

afterEach(() => vi.unstubAllGlobals());

const vitals = () =>
  Object.fromEntries(
    network
      .events()
      .filter((event) => event.kind === "vital")
      .map((event) => [event.name, event.value]),
  );

describe("watchWebVitals", () => {
  it("reports each vital once, as the page is hidden", () => {
    watchWebVitals();
    FakeObserver.emit("largest-contentful-paint", { startTime: 1_200.6 });
    FakeObserver.emit(
      "paint",
      { name: "first-paint", startTime: 300 },
      { name: "first-contentful-paint", startTime: 410.2 },
    );
    FakeObserver.emit(
      "event",
      { interactionId: 7, duration: 96 },
      { interactionId: 0, duration: 400 },
      { interactionId: 8, duration: 64 },
    );
    hidePage();
    expect(vitals()).toEqual({ LCP: 1_201, FCP: 410, INP: 96, TTFB: 180 });
  });

  it("scores layout shifts by their worst burst, leaving out shifts after input", () => {
    watchWebVitals();
    FakeObserver.emit(
      "layout-shift",
      { startTime: 100, value: 0.05, hadRecentInput: false },
      { startTime: 600, value: 0.05, hadRecentInput: false },
      { startTime: 700, value: 0.5, hadRecentInput: true },
      { startTime: 3_000, value: 0.02, hadRecentInput: false },
    );
    hidePage();
    expect(vitals().CLS).toBe(0.1);
  });

  it("reports once, however often the page is hidden", () => {
    watchWebVitals();
    FakeObserver.emit("largest-contentful-paint", { startTime: 900 });
    hidePage();
    window.dispatchEvent(new Event("pagehide"));
    expect(network.events().filter((event) => event.kind === "vital")).toHaveLength(2);
  });

  it("reports on page hide too", () => {
    watchWebVitals();
    window.dispatchEvent(new Event("pagehide"));
    expect(vitals()).toEqual({ TTFB: 180 });
  });

  it("goes without a measure the browser doesn't have", () => {
    FakeObserver.unsupported.add("layout-shift");
    vi.mocked(performance.getEntriesByType).mockReturnValue([]);
    watchWebVitals();
    FakeObserver.emit("largest-contentful-paint", { startTime: 800 });
    hidePage();
    expect(vitals()).toEqual({ LCP: 800 });
  });

  it("stops watching when stopped", () => {
    const stop = watchWebVitals();
    stop();
    hidePage();
    expect([vitals(), FakeObserver.byType.get("paint")?.disconnected]).toEqual([{}, true]);
  });

  it("does nothing in a browser with no performance observer", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    watchWebVitals()();
    hidePage();
    expect(vitals()).toEqual({});
  });
});
