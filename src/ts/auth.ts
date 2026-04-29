import { Loading } from 'quasar';
import type { Auth, User } from 'firebase/auth';
import type * as models from 'src/ts/models.ts';
import type { Ref } from 'vue';
import { reactive, ref } from 'vue';
import { useAuth, useFunctionAsync } from 'boot/vuefire.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

let authStore: Auth | null = null;
export const loggedInUser = ref(null) as Ref<User | null>;
export const loggedInUserClaims = reactive({} as { roles: string[] });

async function getAuthInstance() {
  if (!authStore) {
    authStore = await useAuth();
  }
  return authStore;
}

export async function init() {
  const auth = await getAuthInstance();
  void updateCustomClaims();
  auth.onAuthStateChanged((user) => {
    loggedInUser.value = user;
    void updateCustomClaims();
    if (user) {
      console.log('Logged In.');
    } else {
      console.log('Logged Out.');
    }
  });
}

export async function login() {
  console.log('Opening login page.');
  Loading.show();
  try {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const auth = await getAuthInstance();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    console.log('Logged in successfully.');
    Loading.hide();
    notifySuccess('登入成功');
  } catch (error) {
    console.error('Failed to log in.');
    Loading.hide();
    notifyError('登入失敗', error as Error);
  }
}

export async function updateCustomClaims() {
  const auth = await getAuthInstance();
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (!claims) {
    loggedInUserClaims.roles = [];
    return;
  }
  loggedInUserClaims.roles = (claims.claims.roles as string[]) || [];
}

export function useCurrentClaims() {
  return loggedInUserClaims;
}

export function useCurrentUser() {
  return loggedInUser;
}

export async function getAllUsers(): Promise<models.User[]> {
  const getAllUsersFn = await useFunctionAsync('getAllUsers');
  return (await getAllUsersFn()).data as models.User[];
}

export async function logout() {
  const auth = await getAuthInstance();
  void auth.signOut();
}
