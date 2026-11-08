import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inject, isOptedOut, optIn, optOut, track } from "../src/index.js";
import { DEFAULT_ENDPOINT } from "../src/wire.js";
import { freshPage, hidePage, setReferrer, setSignal, stubNetwork } from "./support.js";

const SITE_KEY = "site_test";

let network: ReturnType<typeof stubNetwork>;

beforeEach(() => {
  vi.useFakeTimers();
  freshPage("/");
  setReferrer("");
  network = stubNetwork();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("page views", () => {
  it("counts the page it starts on, once the batch leaves", () => {
    inject({ siteKey: SITE_KEY });
    expect(network.fetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(network.events()).toEqual([{ kind: "pageview", path: "/", ago: 2_000 }]);
  });

  it("posts plain text to the default collector, without credentials", () => {
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    const [endpoint, init] = network.fetch.mock.calls[0] ?? [];
    expect([endpoint, typeof init?.body, init?.keepalive, init?.credentials, init?.headers]).toEqual([
      DEFAULT_ENDPOINT,
      "string",
      true,
      "omit",
      undefined,
    ]);
  });

  it("sends to the endpoint it's given", () => {
    inject({ siteKey: SITE_KEY, endpoint: "https://collector.example.com/e" });
    vi.advanceTimersByTime(2_000);
    expect(network.fetch.mock.calls[0]?.[0]).toBe("https://collector.example.com/e");
  });

  it("counts a route change made with the history API", () => {
    inject({ siteKey: SITE_KEY });
    history.pushState(null, "", "/pricing?utm_source=news&ref=abc");
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.path)).toEqual(["/", "/pricing?utm_source=news"]);
  });

  it("counts going back", () => {
    inject({ siteKey: SITE_KEY });
    history.pushState(null, "", "/docs");
    history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.path)).toEqual(["/", "/docs", "/"]);
  });

  it("doesn't count a page twice when only the dropped part of its address changes", () => {
    inject({ siteKey: SITE_KEY });
    history.replaceState({ router: "state" }, "", "/?tab=2");
    vi.advanceTimersByTime(2_000);
    expect(network.events()).toHaveLength(1);
  });

  it("doesn't count a second time when it starts again on the same page", () => {
    const stop = inject({ siteKey: SITE_KEY });
    stop();
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.events()).toHaveLength(1);
  });

  it("stops counting route changes once stopped", () => {
    const stop = inject({ siteKey: SITE_KEY });
    stop();
    history.pushState(null, "", "/later");
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.path)).toEqual(["/"]);
  });

  it("sends the host of another site the visitor came from, with the first page only", () => {
    setReferrer("https://News.Example.org/story?id=1");
    inject({ siteKey: SITE_KEY });
    history.pushState(null, "", "/next");
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.referrer)).toEqual(["news.example.org", undefined]);
  });

  it("sends no referrer when the visitor came from this site", () => {
    setReferrer(`${location.origin}/before`);
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.events()[0]).not.toHaveProperty("referrer");
  });

  it("sends no referrer it can't read", () => {
    setReferrer("not a url");
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.events()[0]).not.toHaveProperty("referrer");
  });
});

describe("site key", () => {
  it("does nothing without a site key", () => {
    inject();
    track("signup");
    vi.advanceTimersByTime(5_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("says why in debug mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    inject({ debug: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("No site key"));
  });

  it("reads the site key and the endpoint from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY", "site_from_env");
    vi.stubEnv("NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT", "https://collector.example.com/e");
    inject();
    vi.advanceTimersByTime(2_000);
    expect([network.fetch.mock.calls[0]?.[0], network.fetched()[0]?.siteKey]).toEqual([
      "https://collector.example.com/e",
      "site_from_env",
    ]);
  });
});

describe("custom events", () => {
  it("sends an event with its data and the page it happened on", () => {
    inject({ siteKey: SITE_KEY });
    track("signup", { plan: "pro" });
    vi.advanceTimersByTime(2_000);
    expect(network.events()[1]).toEqual({
      kind: "event",
      path: "/",
      name: "signup",
      data: { plan: "pro" },
      ago: 2_000,
    });
  });

  it("ignores an event with no name", () => {
    inject({ siteKey: SITE_KEY });
    track("  ");
    vi.advanceTimersByTime(2_000);
    expect(network.events()).toHaveLength(1);
  });

  it("keeps what's recorded before it starts, and sends it once it does", () => {
    track("early");
    vi.advanceTimersByTime(5_000);
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.name ?? event.kind)).toEqual(["early", "pageview"]);
  });

  it("holds fifty events at most before it starts", () => {
    for (let index = 0; index < 60; index += 1) track(`early_${index}`);
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.events()[0]?.name).toBe("early_11");
  });

  it("never throws, even off the browser's usual path", () => {
    vi.stubGlobal("location", undefined);
    expect(() => track("signup")).not.toThrow();
  });
});

describe("batching", () => {
  it("sends as one request what happens within two seconds", () => {
    inject({ siteKey: SITE_KEY });
    track("one");
    vi.advanceTimersByTime(1_000);
    track("two");
    vi.advanceTimersByTime(1_000);
    expect([network.fetch.mock.calls.length, network.events().length]).toEqual([1, 3]);
  });

  it("sends at once when ten events are waiting", () => {
    inject({ siteKey: SITE_KEY });
    for (let index = 0; index < 9; index += 1) track(`event_${index}`);
    expect(network.events()).toHaveLength(10);
  });

  it("sends with a beacon as the page is hidden", () => {
    inject({ siteKey: SITE_KEY });
    hidePage();
    expect([network.sendBeacon.mock.calls.length, network.fetch.mock.calls.length]).toEqual([1, 0]);
  });

  it("sends with a beacon as the page goes away", () => {
    inject({ siteKey: SITE_KEY });
    window.dispatchEvent(new Event("pagehide"));
    expect(network.beaconed()[0]?.events).toHaveLength(1);
  });

  it("falls back on a kept-alive request when the beacon is refused", () => {
    network.sendBeacon.mockReturnValue(false);
    inject({ siteKey: SITE_KEY });
    hidePage();
    expect(network.fetch).toHaveBeenCalledOnce();
  });

  it("swallows a failed request", async () => {
    network.fetch.mockRejectedValue(new TypeError("offline"));
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    await vi.runAllTimersAsync();
    expect(network.fetch).toHaveBeenCalledOnce();
  });

  it("logs what it sends in debug mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    inject({ siteKey: SITE_KEY, debug: true });
    vi.advanceTimersByTime(2_000);
    expect(log).toHaveBeenCalledWith("[@borromic/analytics] Sending.", expect.objectContaining({ siteKey: SITE_KEY }));
  });
});

describe("beforeSend", () => {
  it("sends the event as beforeSend changes it", () => {
    inject({ siteKey: SITE_KEY, beforeSend: (event) => ({ ...event, path: "/redacted" }) });
    vi.advanceTimersByTime(2_000);
    expect(network.events()[0]?.path).toBe("/redacted");
  });

  it("drops an event beforeSend answers null to", () => {
    inject({ siteKey: SITE_KEY, beforeSend: (event) => (event.kind === "pageview" ? null : event) });
    track("kept");
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.name)).toEqual(["kept"]);
  });

  it("drops an event beforeSend throws on", () => {
    inject({
      siteKey: SITE_KEY,
      beforeSend: () => {
        throw new Error("broken filter");
      },
    });
    vi.advanceTimersByTime(2_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });
});

describe("privacy", () => {
  it("sends nothing when the browser says Do Not Track", () => {
    setSignal("doNotTrack", "1");
    inject({ siteKey: SITE_KEY });
    track("signup");
    vi.advanceTimersByTime(2_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing under Global Privacy Control", () => {
    setSignal("globalPrivacyControl", true);
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("measures despite the signals when told not to respect them", () => {
    setSignal("doNotTrack", "1");
    inject({ siteKey: SITE_KEY, respectDoNotTrack: false });
    vi.advanceTimersByTime(2_000);
    expect(network.events()).toHaveLength(1);
  });

  it("drops what was recorded before it started, once it learns the browser says not to", () => {
    track("early");
    setSignal("doNotTrack", "1");
    inject({ siteKey: SITE_KEY });
    setSignal("doNotTrack", undefined);
    vi.advanceTimersByTime(2_000);
    expect(network.events().map((event) => event.name)).not.toContain("early");
  });

  it("sends nothing once the visitor opts out, and drops what was waiting", () => {
    inject({ siteKey: SITE_KEY });
    optOut();
    track("after");
    vi.advanceTimersByTime(2_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("remembers the choice in the browser, and only then", () => {
    inject({ siteKey: SITE_KEY });
    expect(window.localStorage.length).toBe(0);
    optOut();
    expect([isOptedOut(), window.localStorage.getItem("borromic-analytics:opt-out")]).toEqual([true, "1"]);
  });

  it("measures again once the visitor opts back in", () => {
    optOut();
    optIn();
    inject({ siteKey: SITE_KEY });
    vi.advanceTimersByTime(2_000);
    expect([isOptedOut(), network.events().length]).toEqual([false, 1]);
  });

  it("drops a batch whose visitor objected in another tab before it left", () => {
    inject({ siteKey: SITE_KEY });
    window.localStorage.setItem("borromic-analytics:opt-out", "1");
    vi.advanceTimersByTime(2_000);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("writes no cookie", () => {
    inject({ siteKey: SITE_KEY });
    track("signup");
    vi.advanceTimersByTime(2_000);
    expect(document.cookie).toBe("");
  });
});
