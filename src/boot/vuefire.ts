import { defineBoot } from '#q-app';
import { initializeApp } from 'firebase/app';
import { VueFire } from 'vuefire';
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
  app.use(VueFire, {
    firebaseApp,
    modules: [],
  });

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
  const { getFunctions, httpsCallable } = await import('@firebase/functions');
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
  authPromise ??= import('firebase/auth').then(({ initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence }) =>
    initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    }),
  );
  return authPromise;
}
