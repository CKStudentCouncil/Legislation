import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { useFirebaseApp, VueFire } from 'vuefire';
import { createGtag } from 'vue-gtag';
import type { HttpsCallable } from '@firebase/functions';
import { getFunctions, httpsCallable } from '@firebase/functions';

export const firebaseApp = initializeApp({
  apiKey: "AIzaSyAonGxBo_6mxqFbW0XfOhDROAiWfLdWmDs",
  authDomain: "bqsc-9a645.firebaseapp.com",
  projectId: "bqsc-9a645",
  storageBucket: "bqsc-9a645.firebasestorage.app",
  messagingSenderId: "1014884719639",
  appId: "1:1014884719639:web:711684060e3239eabe9052",
  measurementId: "G-S8CB7S18J4"
});
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app }) => {
  app.use(VueFire, {
    firebaseApp,
    modules: [],
  });
  app.use(
    createGtag({
      appName: 'BQSC Legislation Quasar App',
      tagId: firebaseApp.options.measurementId!,
    }),
  );
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp(), 'asia-east1'), name);
}

export function useAuth() {
  return getAuth(firebaseApp);
}
