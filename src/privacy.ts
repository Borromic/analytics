/**
 * The visitor's own say: the browser's privacy signals, and an objection they can make on the site.
 * The objection is the only thing ever written in the browser, and only once they make it.
 */

const OPT_OUT_KEY = "borromic-analytics:opt-out";

/** For a browser that keeps nothing: the choice then lasts as long as the page. */
let optedOutHere = false;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Do Not Track, or Global Privacy Control. */
export function saysDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const signals = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const doNotTrack = signals.doNotTrack ?? signals.msDoNotTrack ?? (window as { doNotTrack?: string }).doNotTrack;
  return doNotTrack === "1" || doNotTrack === "yes" || signals.globalPrivacyControl === true;
}

/** Whether this visitor objected. Read each time, so a choice made in another tab holds here too. */
export function isOptedOut(): boolean {
  if (optedOutHere) return true;
  try {
    return storage()?.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** The visitor objects: nothing more is sent from this browser, and what was waiting is dropped. */
export function optOut(): void {
  optedOutHere = true;
  remember(() => storage()?.setItem(OPT_OUT_KEY, "1"));
}

/** The visitor changed their mind, which also removes what the browser kept of their objection. */
export function optIn(): void {
  optedOutHere = false;
  remember(() => storage()?.removeItem(OPT_OUT_KEY));
}

/** Calls the listener whenever the choice changes, in this tab or another. The answer stops it. */
export function onOptOutChange(listener: () => void): () => void {
  listeners.add(listener);
  const fromAnotherTab = (event: StorageEvent) => event.key === OPT_OUT_KEY && listener();
  if (typeof window !== "undefined") window.addEventListener("storage", fromAnotherTab);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", fromAnotherTab);
  };
}

function remember(write: () => void): void {
  try {
    write();
  } catch {
    // Storage full or blocked: the choice still holds for this page.
  }
  for (const listener of listeners) listener();
}
