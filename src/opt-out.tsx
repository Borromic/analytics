"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { isOptedOut, onOptOutChange, optIn, optOut } from "./privacy.js";

export { isOptedOut, optIn, optOut };

export interface OptOutProps {
  /** What it says while this visitor is measured. */
  stop?: string;
  /** What it says once they've objected. */
  resume?: string;
  /** Leave it out for a button that reads as a link in the page's own text. */
  className?: string;
}

const READS_AS_A_LINK: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  font: "inherit",
  color: "inherit",
  textDecoration: "underline",
  cursor: "pointer",
};

/**
 * The visitor's way to object, for a privacy page. It renders as "stop" on the server, which can't
 * know the browser's choice, and says what's true once it runs in the browser.
 */
export function OptOut({
  stop = "Stop measuring my visits",
  resume = "Measure my visits again",
  className,
}: OptOutProps) {
  const optedOut = useSyncExternalStore(onOptOutChange, isOptedOut, () => false);
  return (
    <button
      type="button"
      className={className}
      style={className ? undefined : READS_AS_A_LINK}
      onClick={() => (optedOut ? optIn() : optOut())}
    >
      {optedOut ? resume : stop}
    </button>
  );
}
