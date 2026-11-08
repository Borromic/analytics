import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOptedOut, onOptOutChange, optIn, optOut, saysDoNotTrack } from "../src/privacy.js";
import { freshPage, setSignal } from "./support.js";

beforeEach(() => freshPage());

describe("saysDoNotTrack", () => {
  it("reads Do Not Track", () => {
    setSignal("doNotTrack", "1");
    expect(saysDoNotTrack()).toBe(true);
  });

  it("reads a Do Not Track that says no", () => {
    setSignal("doNotTrack", "0");
    expect(saysDoNotTrack()).toBe(false);
  });

  it("reads Global Privacy Control", () => {
    setSignal("globalPrivacyControl", true);
    expect(saysDoNotTrack()).toBe(true);
  });
});

describe("opting out", () => {
  it("holds for the page when the browser keeps nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    optOut();
    expect(isOptedOut()).toBe(true);
  });

  it("reads as not opted out when storage can't be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(isOptedOut()).toBe(false);
  });

  it("tells listeners of a choice made here", () => {
    const listener = vi.fn();
    const stop = onOptOutChange(listener);
    optOut();
    optIn();
    stop();
    optOut();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("tells listeners of a choice made in another tab", () => {
    const listener = vi.fn();
    const stop = onOptOutChange(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "borromic-analytics:opt-out" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    stop();
    expect(listener).toHaveBeenCalledOnce();
  });
});
