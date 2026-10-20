import { isTransientNetworkError } from 'src/ts/firebase-errors.ts';

// Waits before the second and third attempt. Each failed read hands the SDK a fresh connection to try
// (see readWithRetry), so these only need to be long enough for a hiccup to clear, not for a backoff to run its course.
const RETRY_DELAYS_MS = [1000, 2000];

/**
 * Run a Firestore read that the server render is waiting on, and run it again if it failed because the connection was not there.
 *
 * The web SDK has no "try again" of its own for a one-off read: `getDoc` listens for the document, and when the watch stream
 * cannot be opened (or does not answer within 10 seconds) the client flips to offline, serves its empty cache and rejects with
 * `unavailable` — "Failed to get document because the client is offline." That is what a request on Cloud Run gets when the
 * instance's connection to Firestore is unusable at that moment (LEGISLATION-K: two visitors, two different laws, days apart —
 * not a missing document). The SDK drops back to an unknown online state as soon as the failed read stops listening, so the next
 * attempt opens a new connection rather than inheriting the dead one, which is why running the read again is enough, with no
 * teardown of the Firestore instance.
 *
 * Without it that single failure rejected out of preFetch, so the visitor was answered with a bare "500 | Internal Server Error"
 * instead of the page (and on a 公文 page, a "查無此公文" 404, since SingleDocumentPage swallows the error).
 *
 * Server-only on purpose: in the browser a failed read is a person with a bad connection, who is better served by the call site's
 * message than by waiting through retries. Anything that is not a dropped connection (`permission-denied`, a bad query) is thrown
 * straight away. If the third attempt fails too, Firestore really is unreachable from the server and the error still surfaces,
 * and still reaches Sentry.
 */
export async function readWithRetry<T>(read: () => Promise<T>): Promise<T> {
  if (!import.meta.env.QUASAR_SERVER) return read();
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await read();
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return read();
}
