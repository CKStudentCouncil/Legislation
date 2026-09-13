/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sentry for the Cloud Functions runtime.
 *
 * Gen-2 functions never crash on a handler error — firebase-functions catches it, turns it
 * into a response and keeps the container alive — so process-level handlers see nothing.
 * The only way to observe these failures is at the handler boundary, which is what the
 * onCall / onRequest / onDocumentWritten wrappers below exist for: they have the same
 * signatures as the firebase-functions originals, so instrumenting a file is a matter of
 * changing where it imports the trigger from, not touching 16 handlers.
 *
 * The DSN is read from process.env at runtime, which for Functions means functions/.env
 * (materialised in CI from the FUNCTIONS_ENV secret, exactly like GMAIL_*). Leave it unset
 * and every export here is a transparent pass-through.
 */
import { captureException, flush, init, withScope } from '@sentry/node';
import type { Scope } from '@sentry/node';
import { HttpsError, onCall as baseOnCall, onRequest as baseOnRequest } from 'firebase-functions/https';
import { onDocumentWritten as baseOnDocumentWritten } from 'firebase-functions/firestore';

const dsn = process.env.SENTRY_DSN ?? '';
const enabled = dsn !== '';

if (enabled) {
  init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    // Every gen-2 function is its own Cloud Run service, so K_SERVICE is this function's
    // own name and the tag is correct per-process.
    serverName: process.env.K_SERVICE || undefined,
    initialScope: {
      tags: { runtime: 'cloud-functions', function: process.env.K_SERVICE || 'unknown' },
    },
  });
}

/**
 * HttpsError codes that say the *caller* was wrong, not us. checkRole() throws
 * permission-denied at people who simply are not allowed to do the thing, and the
 * client-facing flows lean on invalid-argument / not-found for ordinary validation — all
 * of it is the function working as designed, and none of it belongs in an issue stream.
 * Everything else (internal, unknown, unavailable, deadline-exceeded, ...) is reported.
 */
const CALLER_FAULT_CODES = new Set([
  'cancelled',
  'invalid-argument',
  'not-found',
  'already-exists',
  'permission-denied',
  'unauthenticated',
  'failed-precondition',
  'out-of-range',
]);

async function report(error: unknown, trigger: string, enrich?: (scope: Scope) => void): Promise<void> {
  if (!enabled) return;
  if (error instanceof HttpsError && CALLER_FAULT_CODES.has(error.code)) return;

  withScope((scope) => {
    scope.setTag('trigger', trigger);
    enrich?.(scope);
    captureException(error);
  });

  // The container can be frozen the moment the handler settles, so get the event onto the
  // wire before letting the rejection continue. Never let a failed flush mask the error.
  await flush(2000).catch(() => undefined);
}

type Handler = (...args: any[]) => any;

/** Callable (onCall) trigger that reports unexpected failures to Sentry. */
export const onCall: typeof baseOnCall = ((...args: any[]) => {
  const handler = args.pop() as Handler;
  return (baseOnCall as any)(...args, async (request: any, response: any) => {
    try {
      return await handler(request, response);
    } catch (error) {
      await report(error, 'callable', (scope) => {
        if (request?.auth) {
          scope.setUser({
            id: request.auth.uid,
            email: request.auth.token?.email,
            username: request.auth.token?.name,
            roles: request.auth.token?.roles ?? [],
          });
        }
      });
      throw error;
    }
  });
}) as typeof baseOnCall;

/** HTTP (onRequest) trigger that reports unexpected failures to Sentry. */
export const onRequest: typeof baseOnRequest = ((...args: any[]) => {
  const handler = args.pop() as Handler;
  return (baseOnRequest as any)(...args, async (request: any, response: any) => {
    try {
      return await handler(request, response);
    } catch (error) {
      await report(error, 'https', (scope) => {
        scope.setTransactionName(`${request?.method} ${request?.path}`);
        scope.setContext('request', { url: request?.originalUrl, method: request?.method });
      });
      throw error;
    }
  });
}) as typeof baseOnRequest;

/** Firestore write trigger that reports unexpected failures to Sentry. */
export const onDocumentWritten: typeof baseOnDocumentWritten = ((...args: any[]) => {
  const handler = args.pop() as Handler;
  return (baseOnDocumentWritten as any)(...args, async (event: any) => {
    try {
      return await handler(event);
    } catch (error) {
      await report(error, 'firestore', (scope) => {
        // params is what identifies the document the trigger fired for — with the
        // wildcard triggers in use here ('{type}/{docId}') it is the only way to tell
        // a legislation write from a document write after the fact.
        scope.setContext('event', { id: event?.id, params: event?.params, document: event?.document });
      });
      throw error;
    }
  });
}) as typeof baseOnDocumentWritten;
