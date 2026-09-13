/**
 * Sentry for the SSR webserver — the Cloud Run half that server-renders /, /legislation/**
 * and /document/**. Runs in Node context.
 *
 * Deliberately separate from src/boot/sentry.ts (the browser SDK):
 *  - it reads its DSN from process.env at *runtime*, so the service can be pointed at a
 *    different Sentry project by redeploying rather than rebuilding, and
 *  - since @quasar/app-vite v3 /src-ssr is its own package, so @sentry/node is declared in
 *    /src-ssr/package.json. Quasar merges those deps into the generated
 *    dist/ssr/package.json, which `yarn gcp-build` installs inside the image.
 */
import type { Request } from 'express';
import { captureException, init, withScope } from '@sentry/node';

const dsn = process.env.SENTRY_DSN ?? '';

export const sentryEnabled = dsn !== '';

/**
 * Called first thing in create(), before any middleware is registered — early enough that
 * the default onUncaughtException / onUnhandledRejection integrations cover the whole
 * lifetime of the process.
 */
export function initSentry(): void {
  if (!sentryEnabled) return;

  init({
    dsn,
    // '||', not '??': Cloud Run gets these through envsubst, which writes an empty string
    // for anything unset — and '' is a value that ?? would happily pass through.
    environment: process.env.SENTRY_ENVIRONMENT || (import.meta.env.QUASAR_DEV ? 'development' : 'production'),
    release: process.env.SENTRY_RELEASE || undefined,
    // Tracing stays off unless explicitly turned on: every SSR page view is a Cloud Run
    // request, and the Firebase Hosting CDN in front of us already absorbs most of them.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    // Quasar bundles the whole webserver into a single dist/ssr/index.js, so there are no
    // module loads left for OpenTelemetry's ESM hooks to patch — registering them buys
    // nothing and only slows startup.
    registerEsmLoaderHooks: false,
    // K_REVISION is set by Cloud Run; it is what ties an issue to a deployed revision.
    serverName: process.env.K_REVISION || undefined,
    initialScope: { tags: { runtime: 'ssr' } },
  });
}

/**
 * Report a failed server render.
 *
 * The render middleware catches everything itself and never calls next(err), so an Express
 * error handler would never see these — the capture has to be explicit. Redirects and
 * route-not-found rejections are normal control flow and are filtered out by the caller.
 */
export function captureRenderError(err: unknown, req: Request): void {
  if (!sentryEnabled) return;

  withScope((scope) => {
    // The route pattern is not known here (Vue Router resolved it inside the failed
    // render), so group by path; Sentry still fingerprints on the stack trace.
    scope.setTransactionName(`${req.method} ${req.path}`);
    scope.setContext('request', {
      url: req.originalUrl,
      method: req.method,
      // Cookies and Authorization are deliberately not included. The rest is what actually
      // explains an SSR-only failure: which bot hit it, and which colour scheme / language
      // branch the render took.
      headers: {
        'user-agent': req.headers['user-agent'],
        referer: req.headers.referer,
        'accept-language': req.headers['accept-language'],
        'sec-ch-prefers-color-scheme': req.headers['sec-ch-prefers-color-scheme'],
      },
    });
    captureException(err);
  });
}
