import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { useFirebaseApp, VueFire } from 'vuefire';
import { createGtag } from 'vue-gtag';
import type { HttpsCallable } from '@firebase/functions';
import { getFunctions, httpsCallable } from '@firebase/functions';

export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyAI6eGOld2TX1NkPUjvp-nqJNmzfE-Ti7U',
  authDomain: 'cksc-legislation.firebaseapp.com',
  projectId: 'cksc-legislation',
  storageBucket: 'cksc-legislation.appspot.com',
  messagingSenderId: '872443717491',
  appId: '1:872443717491:web:7ea49ba1403de4928b0706',
  measurementId: 'G-0ZLXJZG30T',
});
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app, router }) => {
  app.use(VueFire, {
    firebaseApp,
    modules: [],
  });
  if (!process.env.SERVER) {
    app.use(
      createGtag({
        appName: 'CKSC Legislation Quasar App',
        tagId: firebaseApp.options.measurementId!,
        pageTracker: {
          router,
        },
      }),
    );
  }
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp(), 'asia-east1'), name);
}

export function useAuth() {
  return getAuth(firebaseApp);
}
