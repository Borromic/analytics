/**
 * The environment's defaults. Each variable is named in full, never looked up by a computed name,
 * because a framework such as Next.js only inlines `process.env.NEXT_PUBLIC_…` into the browser's
 * code where it finds it written out. Where there is no `process` at all, reading it throws, and
 * the default is simply absent.
 */

declare const process: { env: Record<string, string | undefined> };

const nonEmpty = (value: string | undefined) => value?.trim() || undefined;

function read(variable: () => string | undefined): string | undefined {
  try {
    return nonEmpty(variable());
  } catch {
    return undefined;
  }
}

/** The site key a browser build was given. */
export const publicSiteKey = () => read(() => process.env.NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY);

/** The collector a browser build was given. */
export const publicEndpoint = () => read(() => process.env.NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT);

/** The site key on a server: its own variable first, then the browser's. */
export const serverSiteKey = () => read(() => process.env.BORROMIC_ANALYTICS_KEY) ?? publicSiteKey();

/** The collector on a server: its own variable first, then the browser's. */
export const serverEndpoint = () => read(() => process.env.BORROMIC_ANALYTICS_ENDPOINT) ?? publicEndpoint();
