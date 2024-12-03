import { useFirebaseAuth } from 'vuefire';
import { Loading, Notify } from 'quasar';
import { browserLocalPersistence, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import * as models from 'src/ts/models.ts';
import { reactive } from 'vue';
import { useFunction } from 'boot/vuefire.ts';

let auth = useFirebaseAuth()!;
export const loggedInUserClaims = reactive({} as { roles: string[] });

export function init() {
  auth = useFirebaseAuth()!;
  auth.setPersistence(browserLocalPersistence).then(async () => {
    console.log('Firebase auth persistence set.');
    await updateCustomClaims();
  });
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('Logged In.');
    } else if (auth) {
      console.log('Logged Out.');
    } else {
      console.log('Firebase auth not ready.');
    }
  });
}

export function login() {
  console.log('Opening login page.');
  Loading.show();
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(() => {
      console.log('Logged in successfully.');
      Loading.hide();
      Notify.create({
        message: '登入成功',
        color: 'positive',
        icon: 'check_circle',
        position: 'top',
        timeout: 2000,
      });
    })
    .catch((error) => {
      console.error('Failed to log in.');
      console.error(error);
      Loading.hide();
      Notify.create({
        message: '登入失敗',
        color: 'negative',
        icon: 'report_problem',
        position: 'top',
        timeout: 2000,
      });
    });
}

export async function updateCustomClaims() {
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (!claims) return;
  loggedInUserClaims.roles = claims.claims.roles as string[];
}

export function getUserClaims() {
  return loggedInUserClaims;
}

export async function getAllUsers(): Promise<models.User[]> {
  return (await useFunction('getAllUsers')()).data as models.User[];
}

export function logout() {
  auth.signOut();
}
