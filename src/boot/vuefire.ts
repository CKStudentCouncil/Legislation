import { defineBoot } from '#q-app';
import { initializeApp } from 'firebase/app';
import { createGtag } from 'vue-gtag';
import type { HttpsCallable } from '@firebase/functions';
import type { Auth } from 'firebase/auth';

export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyAI6eGOld2TX1NkPUjvp-nqJNmzfE-Ti7U',
  authDomain: 'cksc-legislation.firebaseapp.com',
  projectId: 'cksc-legislation',
  storageBucket: 'cksc-legislation.appspot.com',
  messagingSenderId: '872443717491',
  appId: '1:872443717491:web:7ea49ba1403de4928b0706',
  measurementId: 'G-0ZLXJZG30T',
});

export default defineBoot(({ app }) => {
  /**
   * Deliberately NOT `app.use(VueFire, { firebaseApp, modules: [] })`.
   *
   * That plugin's entire body is `app.provide(_FirebaseAppInjectionKey, firebaseApp)` plus a
   * loop over `modules`, and `modules` is empty here — while vuefire's `useFirebaseApp()`
   * already falls back to `getApp()` when the injection is missing (it passes `null` as the
   * inject default specifically to avoid warning about it). So installing it bought nothing
   * that `initializeApp()` above does not already provide.
   *
   * What it cost was the whole app. Boot files are eager, so `import { VueFire } from
   * 'vuefire'` put vuefire — and through it the Firestore SDK — in the entry chunk's static
   * import closure: ~175 KB brotli on every page, including the server-rendered public
   * document and legislation pages, whose content is already in the HTML and whose store is
   * hydrated from the serialized SSR state (`loadDocument` returns early and never opens a
   * Firestore connection). Every other vuefire/Firestore importer — model-converters.ts, the
   * /manage pages, the judicial pages, DocumentsPageV2 — is behind a lazy route chunk, so
   * dropping this line is what actually lets Rolldown keep Firestore out of the entry.
   *
   * `firebaseApp` is still initialized eagerly at module scope above, which is what
   * `getApp()` resolves to, so `useFirestore()` / `useDocument()` / `useCollection()` keep
   * working unchanged wherever they are used.
   */

  if (!import.meta.env.QUASAR_SERVER) {
    // defer gtag to reduce TBT and initial load size
    setTimeout(() => {
      app.use(
        createGtag({
          appName: 'CKSC Legislation Quasar App',
          tagId: firebaseApp.options.measurementId!,
        }),
      );
    }, 2000);
  }
});

export async function useFunctionAsync(name: string): Promise<HttpsCallable> {
  // Every callable identifies its caller by the ID token the Functions SDK attaches, and it can
  // only attach one if Auth exists and has finished restoring the persisted session. Auth is
  // created lazily (see useAuth), so a page that calls a function straight from setup on a
  // fresh load — ManageAccountsPage's user list — raced HeaderSidebar's init() and went out
  // anonymous, coming back 401 unauthenticated even for a signed-in admin (LEGISLATION-D).
  const [{ getFunctions, httpsCallable }, auth] = await Promise.all([import('@firebase/functions'), useAuth()]);
  await auth.authStateReady();
  return httpsCallable(getFunctions(firebaseApp, 'asia-east1'), name);
}

let authPromise: Promise<Auth> | null = null;

export function useAuth(): Promise<Auth> {
  // Deliberately NOT getAuth(). getAuth() wires in browserPopupRedirectResolver, whose
  // `_shouldInitProactively` is true on every mobile browser, Safari and iOS — so merely
  // creating the Auth instance eagerly opens the gapi auth iframe and pulls
  // https://cksc-legislation.firebaseapp.com/__/auth/iframe(.js) (~95 KB gzipped,
  // Cache-Control: max-age=1800) on *every* page load for *every* visitor, logged in or
  // not. That resolver is only actually needed while a sign-in popup is open, so
  // `login()` passes browserPopupRedirectResolver explicitly instead. The persistence
  // hierarchy below mirrors getAuth()'s default, so existing sessions keep working.
  //
  // The promise is cached because initializeAuth() throws `auth/already-initialized` if
  // it is called twice with options (getAuth() was idempotent; this is not).
  authPromise ??= import('firebase/auth')
    .then(({ initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence }) =>
      initializeAuth(firebaseApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      }),
    )
    .catch((error: unknown) => {
      // Drop a rejection out of the cache. The memo lives as long as the page, so a chunk
      // request lost to a flaky connection would otherwise leave every later caller —
      // login() included — rejecting with that same stale error for the rest of the visit.
      authPromise = null;
      throw error;
    });
  return authPromise;
}
