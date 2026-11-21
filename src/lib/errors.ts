// What a failure says on screen. A lost connection shows up in many wordings, depending on the phone and
// the library ("Network request failed", "fetch failed: java.net.UnknownHostException: Unable to resolve
// host…", "Failed to fetch", a timeout), and none of them should reach the screen as they are.

export const NO_CONNECTION = 'No connection. Check your internet and try again.';

const NETWORK =
  /network request failed|fetch failed|failed to fetch|load failed|network ?error|unknownhost|unable to resolve host|no address associated|connectexception|failed to connect|connection (?:refused|reset|abort|closed)|sockettimeout|timed? ?out|econn|enotfound|enetunreach|ssl|unreachable|internet connection appears to be offline/i;

/** The text of anything thrown. */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(e);
}

/** True when the failure is the connection, not the answer. */
export const isOffline = (e: unknown) => NETWORK.test(errorText(e));

/**
 * The words to show for a failure: plain words for a lost connection, the app's own message otherwise
 * (they're written for people), or `fallback` when there's nothing readable.
 */
export function shownError(e: unknown, fallback: string, offline = NO_CONNECTION): string {
  if (isOffline(e)) return offline;
  const text = errorText(e).trim();
  return text && text !== 'undefined' && text !== '[object Object]' ? text : fallback;
}
