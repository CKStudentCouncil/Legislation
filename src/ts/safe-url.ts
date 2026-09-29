/**
 * Render-time guard for a URL that came out of stored data and is about to be bound to an `href` or handed to `window.open`.
 *
 * Clause links (`frozenBy`, `resolutionUrls`), the legislation-level `frozenBy` and history links can reach Firestore without
 * passing the manage editor's `isUrl` check (an approved amendment request is written by a Cloud Function, a `.ckla` draft is
 * imported as-is, and the editor's check can be skipped or fooled), so a scheme that runs script in this origin when followed
 * is dropped here, at the sink. Following such a link would execute in the law.cksc.tw origin.
 *
 * The scheme is read the way browsers read it: leading C0 controls and spaces are skipped, and tabs and newlines are ignored
 * wherever they sit. A non-string value (the editor only ever writes strings; an array would stringify to its contents) is
 * dropped too. Everything else is returned untouched, so http(s), mailto and relative links behave exactly as before.
 *
 * Pure and SSR-safe: no browser, Quasar or Firebase imports. Returns `undefined` for an unsafe value, which leaves the
 * bound `href` unset and the element inert.
 */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  let start = 0;
  while (start < url.length && url.charCodeAt(start) <= 0x20) start++;
  const scheme = url.slice(start).replace(/[\t\n\r]/g, '');
  return /^(?:javascript|vbscript|data):/i.test(scheme) ? undefined : url;
}
