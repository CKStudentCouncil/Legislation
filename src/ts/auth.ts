import { useFirebaseAuth } from 'vuefire';
import { Loading } from 'quasar';
import { browserLocalPersistence, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import type * as models from 'src/ts/models.ts';
import { reactive } from 'vue';
import { useFunction } from 'boot/vuefire.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

let auth = useFirebaseAuth()!;
export const loggedInUserClaims = reactive({} as { roles: string[] });

export function init() {
  auth = useFirebaseAuth()!;
  void auth.setPersistence(browserLocalPersistence).then(async () => {
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
      notifySuccess('登入成功');
    })
    .catch((error) => {
      console.error('Failed to log in.');
      Loading.hide();
      notifyError('登入失敗', error);
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
  void auth.signOut();
}
