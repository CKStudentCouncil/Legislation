import { defineSsrMiddleware } from '#q-app';
import { captureRenderError } from '../sentry.ts';
import type { SsrRenderRedirectError, SsrRenderRouteNotFoundError } from '#q-app';

// Since @quasar/app-vite v3, render() rejects with plain shapes rather than a
// single RenderError, so narrow on the discriminating properties.
function isRedirectError(err: unknown): err is SsrRenderRedirectError {
  return typeof err === 'object' && err !== null && 'redirectUrl' in err && 'redirectHttpStatusCode' in err;
}

function isRouteNotFoundError(err: unknown): err is SsrRenderRouteNotFoundError {
  return typeof err === 'object' && err !== null && 'routeNotFound' in err;
}

/**
 * SSR paths that render byte-identical output no matter what query string they are handed.
 * `/` and `/legislation` are both LegislationPage, which reads nothing from route.query —
 * its search box is client-only and InstantSearch has no `routing` here. (`/document` is
 * deliberately absent: its filter UI genuinely syncs into the query string.)
 *
 * Firebase Hosting keys its CDN on the full URL, query string included, so every distinct
 * `?…` a crawler invents or a referrer appends is a guaranteed cache miss on the two most
 * requested URLs of the site — a fresh Cloud Run render, and a full page down the wire, for
 * a response we already had cached. Collapsing them to the canonical path (which is what
 * the page's own <link rel="canonical"> already claims) turns an unbounded family of cache
 * entries back into one.
 */
const CANONICAL_QUERYLESS_PATHS = new Set(['/', '/legislation', '/legislation/']);

// This middleware should execute as last one
// since it captures everything and tries to
// render the page with Vue

export default defineSsrMiddleware(({ app, resolve, render, serve }) => {
  // we capture any other Express route and hand it
  // over to Vue and Vue Router to render our page
  // ('{*path}' is the Express 5 spelling of the old '*' catch-all)
  app.get(resolve.urlPath('{*path}'), async (req, res) => {
    // Before anything expensive: send junk query strings back to the canonical path. The
    // redirect is itself cached at the edge, so a crawler grinding through a parameter
    // space stops reaching Cloud Run at all after the first hit of each URL.
    if (CANONICAL_QUERYLESS_PATHS.has(req.path) && req.originalUrl.includes('?')) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
      res.redirect(301, req.path === '/legislation/' ? '/legislation' : req.path);
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Accept-CH', 'Sec-CH-Prefers-Color-Scheme');
    res.setHeader('Vary', 'Sec-CH-Prefers-Color-Scheme');
    res.setHeader('Critical-CH', 'Sec-CH-Prefers-Color-Scheme');

    try {
      const html = await render(/* the ssrContext: */ { req, res });

      // Cache successfully-rendered pages at the Firebase Hosting CDN (honors
      // s-maxage) so crawlers and repeat visitors don't trigger a cold Cloud Run
      // render + Firestore read every time. Content is invalidated on write via
      // the updateIdCache Firestore trigger, so a short s-maxage + SWR is safe.
      // Not-found pages (statusCode 404, set in onServerPrefetch) are left uncached.
      if (res.statusCode === 200) {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
      }
      // now let's send the rendered html to the client
      res.send(html);
    } catch (err) {
      // oops, we had an error while rendering the page

      // we were told to redirect to another URL
      if (isRedirectError(err)) {
        res.redirect(err.redirectHttpStatusCode, err.redirectUrl);
        return;
      }

      // hmm, Vue Router could not find the requested route

      // Should reach here only if no "catch-all" route
      // is defined in /src/routes
      if (isRouteNotFoundError(err)) {
        res.status(404).send('404 | Page Not Found');
        return;
      }

      // Everything still here is a genuine render failure — the two rejections handled
      // above are normal control flow. This has to be an explicit capture: the catch
      // never calls next(err), so an Express error handler would never see it.
      captureRenderError(err, req);

      // well, we treat any other code as error;
      // if we're in dev mode, then we can use Quasar CLI
      // to display a nice error page that contains the stack
      // and other useful information

      // serve.devError is available on dev only
      if (import.meta.env.QUASAR_DEV) {
        const { errorHeaders, errorHtml } = serve.devError({ err, req });
        res.set(errorHeaders).status(500).send(errorHtml);
        return;
      }

      // we're in production, so we should have another method
      // to display something to the client when we encounter an error
      // (for security reasons, it's not ok to display the same wealth
      // of information as we do in development)

      // Render Error Page on production or
      // create a route (/src/routes) for an error page and redirect to it
      res.status(500).send('500 | Internal Server Error');

      if (import.meta.env.QUASAR_DEBUG) {
        console.error(err instanceof Error ? err.stack : (err ?? 'Unknown error'));
      }
    }
  });
});
