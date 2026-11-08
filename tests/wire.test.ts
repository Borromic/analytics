import { describe, expect, it } from "vitest";
import { eventData, eventName, MAX_BODY_BYTES, requestBodies, type WireEvent } from "../src/wire.js";

describe("eventName", () => {
  it("trims a name and cuts it at 100 characters", () => {
    expect(eventName(`  ${"n".repeat(120)}  `)).toHaveLength(100);
  });

  it("refuses a blank name", () => {
    expect(eventName("   ")).toBeNull();
  });

  it("refuses what isn't text", () => {
    expect(eventName(42)).toBeNull();
  });
});

describe("eventData", () => {
  it("keeps flat values", () => {
    expect(eventData({ plan: "pro", seats: 3, yearly: true, coupon: null })).toEqual({
      plan: "pro",
      seats: 3,
      yearly: true,
      coupon: null,
    });
  });

  it("drops nested values, undefined values and numbers that aren't finite", () => {
    expect(eventData({ nested: { a: 1 }, list: [1], missing: undefined, ratio: Number.NaN, kept: 1 })).toEqual({
      kept: 1,
    });
  });

  it("keeps twenty keys at most", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`key${index}`, index]));
    expect(Object.keys(eventData(many) ?? {})).toHaveLength(20);
  });

  it("cuts long keys and long text", () => {
    const kept = eventData({ ["k".repeat(80)]: "v".repeat(300) }) ?? {};
    const [[key, value]] = Object.entries(kept) as [[string, string]];
    expect([key.length, value.length]).toEqual([50, 200]);
  });

  it("has nothing to send when nothing is left", () => {
    expect(eventData({ nested: {} })).toBeUndefined();
  });

  it("has nothing to send for what isn't an object", () => {
    expect(eventData("plan")).toBeUndefined();
  });
});

describe("requestBodies", () => {
  const pageviews = (count: number): WireEvent[] =>
    Array.from({ length: count }, (_, index) => ({ kind: "pageview", path: `/page/${index}` }));

  it("sends a few events in one body", () => {
    const [body] = requestBodies("site_key", pageviews(3));
    expect(JSON.parse(body ?? "")).toEqual({ siteKey: "site_key", events: pageviews(3) });
  });

  it("sends twenty events at most in one body", () => {
    const bodies = requestBodies("site_key", pageviews(45));
    expect(bodies.map((body) => JSON.parse(body).events.length)).toEqual([20, 20, 5]);
  });

  it("splits before a body passes 16 KB", () => {
    const large: WireEvent[] = Array.from({ length: 6 }, () => ({
      kind: "event",
      name: "big",
      path: "x".repeat(4_000),
    }));
    const bodies = requestBodies("site_key", large);
    expect(bodies.length).toBeGreaterThan(1);
    expect(bodies.every((body) => new TextEncoder().encode(body).length <= MAX_BODY_BYTES)).toBe(true);
  });

  it("leaves out an event too large to go alone", () => {
    const bodies = requestBodies("site_key", [{ kind: "event", name: "huge", path: "x".repeat(MAX_BODY_BYTES) }]);
    expect(bodies).toEqual([]);
  });
});
