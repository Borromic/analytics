import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshPage, hidePage, stubNetwork } from "./support.js";

let network: ReturnType<typeof stubNetwork>;

/** Runs the plain-script build as a `<script>` tag with these data attributes would. */
async function loadScript(attributes: Record<string, string>) {
  const tag = document.createElement("script");
  for (const [name, value] of Object.entries(attributes)) tag.setAttribute(name, value);
  Object.defineProperty(document, "currentScript", { value: tag, configurable: true });
  vi.resetModules();
  const tracker = await import("../src/tracker.js");
  tracker.forgetPage();
  await import("../src/script.js");
}

beforeEach(() => {
  freshPage("/");
  network = stubNetwork();
  vi.stubGlobal("PerformanceObserver", undefined);
});

afterEach(() => {
  delete window.borromicAnalytics;
});

describe("plain script", () => {
  it("measures with the tag's site key and endpoint", async () => {
    await loadScript({ "data-site-key": "site_script", "data-endpoint": "https://collector.example.com/e" });
    hidePage();
    expect([network.sendBeacon.mock.calls[0]?.[0], network.beaconed()[0]?.siteKey]).toEqual([
      "https://collector.example.com/e",
      "site_script",
    ]);
  });

  it("records events through window.borromicAnalytics", async () => {
    await loadScript({ "data-site-key": "site_script", "data-web-vitals": "" });
    window.borromicAnalytics?.track("signup", { plan: "pro" });
    hidePage();
    expect(network.events().map((event) => event.name ?? event.kind)).toEqual(["pageview", "signup"]);
  });

  it("measures nothing without a site key", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await loadScript({ "data-debug": "", "data-respect-do-not-track": "false" });
    hidePage();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("No site key"));
    expect(network.events()).toEqual([]);
  });
});
