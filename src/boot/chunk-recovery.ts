import { defineBoot } from '#q-app';

/**
 * Recovery from failed dynamic imports.
 *
 * Every route component is a lazy `import()`, and so are firebase/auth, @firebase/functions
 * and html-to-text. Almost nothing awaits those promises, so when the chunk request fails
 * nothing surfaces that the user can act on — the tapped page simply never appears, or the
 * header never learns who is signed in. The only trace left is an unhandled rejection in
 * Sentry carrying the browser's own wording and no stack at all, which is exactly what
 * LEGISLATION-4 was.
 *
 * Two things make the request fail, and this site meets both:
 *
 *  - A deploy. Asset filenames are content-hashed and each release replaces the previous
 *    one on Hosting, so a tab opened before a deploy asks for chunks that are no longer
 *    there. A missing /assets/… file is not even a 404: firebase.json's last rewrite hands
 *    it the SPA fallback, so the browser is given main.html with a text/html content type
 *    and refuses it as a module script.
 *  - A flaky mobile connection, which is how most of this site is read.
 *
 * One thing fixes both — load the page again from the release that is actually deployed —
 * so that is all this does. Once per cooldown, so that a genuinely broken deploy cannot put
 * a browser into a reload loop; a second failure inside that window is left alone to reach
 * Sentry, because by then it is real and worth an issue.
 */

const RELOAD_COOLDOWN_MS = 10_000;
const RELOAD_MARKER = 'cksc:chunk-recovery';

/**
 * None of the engines throws a typed error for this, and each words it differently: the
 * first is WebKit, then Chromium, then Firefox, then Chromium again for the text/html the
 * SPA fallback serves, and last the stylesheet half of the preload helper.
 */
const MODULE_LOAD_ERROR =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Failed to load module script|not a valid JavaScript MIME type|Unable to preload CSS/i;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return MODULE_LOAD_ERROR.test(message);
}

let recovering = false;
let reloadTarget: string | null = null;

/**
 * Whether a recovery reload has been committed. From that point the page is on its way out
 * and every further error is a symptom of the chunk that never arrived — src/boot/sentry.ts
 * drops those rather than filing them as issues of their own.
 */
export function isRecovering(): boolean {
  return recovering;
}

/**
 * Records that we are reloading, and refuses if we already did so within the cooldown.
 */
function claimReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARKER));
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    return true;
  } catch {
    // No sessionStorage (private mode, site data blocked) means no way to tell a first
    // failure from a loop, and a reload loop is worse than a dead page. Leave it be.
    return false;
  }
}

/**
 * Reload onto the release that is actually deployed. `fullPath`, when it is known, is where
 * the user was trying to go — reloading the page they are standing on instead would leave
 * them to work out for themselves that the tap they made needs making again.
 *
 * Returns false when the cooldown has already been spent, which is the caller's signal to
 * let the error surface instead.
 */
export function recoverFromModuleLoadError(fullPath?: string): boolean {
  if (fullPath) reloadTarget = fullPath;
  if (recovering) return true;
  if (!claimReload()) return false;

  recovering = true;
  // On a macrotask, so that the handler which called this finishes first: vite:preloadError
  // still has a preventDefault() to apply once we return.
  setTimeout(() => {
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (reloadTarget && reloadTarget !== here) {
      // A navigation that never happened: send them where they tapped, leaving the page
      // they are on in history where the back button expects it.
      window.location.assign(reloadTarget);
    } else {
      window.location.reload();
    }
  });
  return true;
}

export default defineBoot(({ router }) => {
  if (import.meta.env.QUASAR_SERVER) return;

  // Which navigation is in flight, so a chunk lost mid-navigation is recovered by loading
  // the page the user asked for rather than the one they are leaving. beforeEach runs ahead
  // of the route component's import(); router.onError — the other hook that knows the
  // target — arrives a rejection too late to be the one that tells us.
  router.beforeEach((to) => {
    reloadTarget = to.fullPath;
  });
  router.afterEach(() => {
    reloadTarget = null;
  });

  // Fires for every import() the build wrapped, route chunks included, and rethrows unless
  // the default is prevented. Preventing it keeps both the original rejection and the
  // knock-on errors from code handed `undefined` where it expected a module out of Sentry,
  // for a page that is already being replaced.
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromModuleLoadError()) event.preventDefault();
  });

  // Backstop for the imports that helper did not wrap: `quasar dev` wraps none of them, and
  // the production build leaves those with no dependencies to preload as bare import()s.
  router.onError((error, to) => {
    if (isModuleLoadError(error)) recoverFromModuleLoadError(to.fullPath);
  });
});
