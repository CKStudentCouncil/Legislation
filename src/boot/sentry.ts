import { defineBoot } from '#q-app';
import { browserTracingIntegration, captureException, init, replayIntegration, setUser, withScope } from '@sentry/vue';
import type { User } from 'firebase/auth';

/**
 * Sentry for the browser half of the app.
 *
 * Configuration is baked in at build time by quasar.config.ts > build > defineEnv, which
 * reads the SENTRY_* variables out of the build environment (CI supplies them from repo
 * secrets). They land in the bundle as literals, so with SENTRY_DSN unset every guard
 * below folds to a constant and Rolldown drops @sentry/vue — and everything it pulls in —
 * out of the client chunks entirely. A plain `yarn build` with no Sentry env in scope
 * therefore ships exactly the bytes it shipped before.
 *
 * Baking the DSN into client code is intended: a DSN only authorises event ingest and is
 * public by design. The two server runtimes deliberately do NOT share this value — the
 * SSR webserver (/src-ssr/sentry.ts) and the Cloud Functions (functions/src/sentry.ts)
 * both read SENTRY_DSN from process.env at runtime, so each can point at its own project
 * and can be re-pointed by a redeploy instead of a rebuild.
 */
const DSN = import.meta.env.SENTRY_DSN;
const TRACES_SAMPLE_RATE = import.meta.env.SENTRY_TRACES_SAMPLE_RATE;
const REPLAY_SESSION_SAMPLE_RATE = import.meta.env.SENTRY_REPLAY_SESSION_SAMPLE_RATE;
const REPLAY_ON_ERROR_SAMPLE_RATE = import.meta.env.SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE;

export default defineBoot(({ app, router }) => {
  // Boot files run on both halves of an SSR render, but this is the browser SDK: a crash
  // during the server render pass is reported by /src-ssr/sentry.ts (@sentry/node) instead.
  if (import.meta.env.QUASAR_SERVER || !DSN) return;

  // @sentry/vue does not re-export the Integration type, and @sentry/core is only a
  // transitive dependency, so take the type from a factory we already import.
  const integrations: ReturnType<typeof browserTracingIntegration>[] = [];

  // Tracing and replay are both opt-in because they are not free: roughly 15 KB gz for
  // browser tracing and 50 KB gz for replay, on a site whose whole point is fast
  // server-rendered public pages. Left at a sample rate of 0 the pushes below are dead
  // code, so neither integration reaches the bundle at all.
  if (TRACES_SAMPLE_RATE > 0) {
    integrations.push(browserTracingIntegration({ router }));
  }
  if (REPLAY_SESSION_SAMPLE_RATE > 0 || REPLAY_ON_ERROR_SAMPLE_RATE > 0) {
    // Defaults (mask text, block media) are kept on purpose — confidential 公文 render
    // through the same components as public ones.
    integrations.push(replayIntegration());
  }

  init({
    app,
    dsn: DSN,
    environment: import.meta.env.SENTRY_ENVIRONMENT,
    release: import.meta.env.SENTRY_RELEASE || undefined,
    integrations,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: REPLAY_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: REPLAY_ON_ERROR_SAMPLE_RATE,
    initialScope: { tags: { runtime: 'browser' } },
    // Noise that is never actionable: browser/extension chatter, and the generic network
    // failures Firebase and Algolia raise when the user navigates away mid-request.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      'AbortError',
      // The visitor closed the Google sign-in popup themselves.
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
    ],
    denyUrls: [/^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
  });
});

/**
 * Mirror the Firebase Auth session onto Sentry's user context.
 *
 * Called from src/ts/auth.ts's updateCustomClaims(), which is the single place that runs
 * on every login, logout and token refresh — and the only place that knows the roles,
 * which are the thing that actually decides what a user could see when it broke.
 */
export function setSentryUser(user: User | null, roles: string[] = []): void {
  if (!DSN) return;
  if (!user) {
    setUser(null);
    return;
  }
  setUser({
    id: user.uid,
    email: user.email ?? undefined,
    username: user.displayName ?? undefined,
    roles,
  });
}

/**
 * Report a handled error. notifyError() funnels through this, so anything a user is shown
 * as a red toast also reaches Sentry alongside the GA4 exception event.
 */
export function captureError(error: unknown, message?: string): void {
  if (!DSN) return;
  withScope((scope) => {
    scope.setLevel('error');
    // Which toast the user saw — the same error surfaces from several call sites, and
    // this is what tells them apart in the issue list.
    if (message) scope.setTag('notification', message);
    captureException(error);
  });
}
