import { vi } from "vitest";
import { optIn } from "../src/privacy.js";
import { forgetPage } from "../src/tracker.js";

export interface SentBody {
  siteKey: string;
  server?: boolean;
  events: Record<string, unknown>[];
}

/** The network as the page sees it: every request is answered 202, and kept to be read back. */
export function stubNetwork() {
  const fetch = vi.fn(async (_endpoint: string, _init?: RequestInit) => new Response(null, { status: 202 }));
  const sendBeacon = vi.fn((_endpoint: string, _body: string) => true);
  vi.stubGlobal("fetch", fetch);
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
  const fetched = () => fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as SentBody);
  const beaconed = () => sendBeacon.mock.calls.map(([, body]) => JSON.parse(body) as SentBody);
  return { fetch, sendBeacon, fetched, beaconed, events: () => [...fetched(), ...beaconed()].flatMap((b) => b.events) };
}

/** A fresh page at this address, with no choice made and no signal set. */
export function freshPage(address = "/") {
  forgetPage();
  window.localStorage.clear();
  optIn();
  history.replaceState(null, "", address);
  setSignal("doNotTrack", undefined);
  setSignal("globalPrivacyControl", undefined);
  setVisibility("visible");
}

export function setSignal(name: "doNotTrack" | "globalPrivacyControl", value: string | boolean | undefined) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

export function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

export function hidePage() {
  setVisibility("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
}

export function setReferrer(referrer: string) {
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}
