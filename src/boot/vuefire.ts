import { defineBoot } from '#q-app';
import { initializeApp } from 'firebase/app';
import { VueFire } from 'vuefire';
import { createGtag } from 'vue-gtag';
import type { HttpsCallable } from '@firebase/functions';

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

export async function useAuth() {
  const { getAuth } = await import('firebase/auth');
  return getAuth(firebaseApp);
}
