/**
 * The page's web vitals, read from the browser's own performance entries: no library, and nothing
 * measured that the browser doesn't measure already.
 */
import { reportVitals } from "./tracker.js";

type VitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface Interaction extends PerformanceEntry {
  interactionId?: number;
}

/** Interactions faster than this can't be the slowest one that matters. */
const SHORTEST_INTERACTION_MS = 40;

/**
 * Watches this page's vitals and reports them once, as the page is hidden: the largest paint, the
 * first paint, the time to first byte, the layout shift and the slowest interaction so far. The
 * answer stops watching.
 */
export function watchWebVitals(): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => undefined;
  const measures = new Map<VitalName, number>();
  const shiftScore = layoutShiftScore();
  const observers = [
    observe("largest-contentful-paint", (entry) => measures.set("LCP", entry.startTime)),
    observe("paint", (entry) => entry.name === "first-contentful-paint" && measures.set("FCP", entry.startTime)),
    observe("layout-shift", (entry) => measures.set("CLS", shiftScore(entry as LayoutShift))),
    observe("event", (entry) => slowestInteraction(measures, entry as Interaction), {
      durationThreshold: SHORTEST_INTERACTION_MS,
    }),
  ];
  const firstByte = timeToFirstByte();
  if (firstByte !== undefined) measures.set("TTFB", firstByte);
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    reportVitals([...measures].map(([name, value]) => ({ name, value: rounded(name, value) })));
  };
  const onHidden = () => document.visibilityState === "hidden" && report();
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", report);
  return () => {
    for (const observer of observers) observer?.disconnect();
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", report);
  };
}

function observe(
  type: string,
  read: (entry: PerformanceEntry) => void,
  options: Record<string, unknown> = {},
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(read));
    observer.observe({ type, buffered: true, ...options } as PerformanceObserverInit);
    return observer;
  } catch {
    // A browser without this measure just doesn't report it.
    return null;
  }
}

/**
 * Cumulative layout shift as browsers define it: the worst burst of shifts, a burst ending after a
 * second without one or five seconds in all. Shifts right after the visitor's own input don't count.
 */
function layoutShiftScore(): (entry: LayoutShift) => number {
  let worst = 0;
  let burst = 0;
  let burstStart = 0;
  let lastShift = 0;
  return (entry) => {
    if (entry.hadRecentInput) return worst;
    const continues = burst > 0 && entry.startTime - lastShift < 1_000 && entry.startTime - burstStart < 5_000;
    if (!continues) burstStart = entry.startTime;
    burst = continues ? burst + entry.value : entry.value;
    lastShift = entry.startTime;
    worst = Math.max(worst, burst);
    return worst;
  };
}

function slowestInteraction(measures: Map<VitalName, number>, entry: Interaction): void {
  if (!entry.interactionId) return;
  measures.set("INP", Math.max(measures.get("INP") ?? 0, entry.duration));
}

/** When the first byte of the page arrived, counted from when it was shown if it was prerendered. */
function timeToFirstByte(): number | undefined {
  const [navigation] = performance.getEntriesByType("navigation") as (PerformanceNavigationTiming & {
    activationStart?: number;
  })[];
  if (!navigation) return undefined;
  const firstByte = navigation.responseStart - (navigation.activationStart ?? 0);
  return firstByte > 0 ? firstByte : undefined;
}

/** A score for CLS, whole milliseconds for the rest. */
const rounded = (name: VitalName, value: number) =>
  name === "CLS" ? Math.round(value * 10_000) / 10_000 : Math.round(value);
