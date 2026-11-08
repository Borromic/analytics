/**
 * What is left of a page's address before it leaves the browser: its path, and the campaign tags of
 * its query. The rest of a query, and some paths, can hold an address or a reset link's token, and
 * say little about the page; the collector cleans the same way again.
 */

export const EMAIL_MARK = "[email]";
export const TOKEN_MARK = "[token]";

const MAX_PATH_LENGTH = 512;
const EMAIL = /[^\s/@]+@[^\s/@]+\.[^\s/@]+/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Twenty letters or digits in a row: a word that long is rare, an id or a hash is not. */
const LONG_RUN = /[A-Za-z0-9]{20,}/g;

/** "/reset/someone%40example.com?token=abc&utm_source=news" becomes "/reset/[email]?utm_source=news". */
export function cleanPath(pathname: string, search = ""): string {
  const path = pathname.split("/").map(cleanSegment).join("/") || "/";
  const campaign = campaignTags(search);
  return (campaign ? `${path}?${campaign}` : path).slice(0, MAX_PATH_LENGTH);
}

function cleanSegment(segment: string): string {
  const text = readable(segment);
  if (EMAIL.test(text)) return EMAIL_MARK;
  return holdsToken(text) ? TOKEN_MARK : segment;
}

/** The query's `utm_*` pairs, unless their value looks personal. */
function campaignTags(search: string): string {
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => {
      const [key = "", value = ""] = pair.split("=", 2);
      const text = readable(value);
      return /^utm_\w+$/i.test(key) && value !== "" && !EMAIL.test(text) && !holdsToken(text);
    })
    .join("&");
}

/** An id or a hash: a uuid, or a long run with digits in it or mixed case. A long slug is words, and stays. */
function holdsToken(text: string): boolean {
  if (UUID.test(text)) return true;
  return (text.match(LONG_RUN) ?? []).some((run) => /\d/.test(run) || (/[a-z]/.test(run) && /[A-Z]/.test(run)));
}

function readable(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}
