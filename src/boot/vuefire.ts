import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { VueFire, VueFireAuth } from 'vuefire';
import VueGtag from 'vue-gtag';

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async ({ app, router }) => {
  // something to do
  const firebaseApp = initializeApp({
    apiKey: 'AIzaSyAI6eGOld2TX1NkPUjvp-nqJNmzfE-Ti7U',
    authDomain: 'cksc-legislation.firebaseapp.com',
    projectId: 'cksc-legislation',
    storageBucket: 'cksc-legislation.appspot.com',
    messagingSenderId: '872443717491',
    appId: '1:872443717491:web:7ea49ba1403de4928b0706',
    measurementId: 'G-0ZLXJZG30T',
  });
  app.use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()],
  });
  app.use(
    VueGtag,
    {
      appName: 'CKSC Legislation Quasar App',
      pageTrackerScreenviewEnabled: true,
      config: { id: firebaseApp.options.measurementId! },
    },
    router,
  );
});
