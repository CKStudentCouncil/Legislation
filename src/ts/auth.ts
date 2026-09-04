import { Loading } from 'quasar';
import type { User } from 'firebase/auth';
import type * as models from 'src/ts/models.ts';
import type { Ref } from 'vue';
import { reactive, ref } from 'vue';
import { useAuth, useFunctionAsync } from 'boot/vuefire.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

export const loggedInUser = ref(null) as Ref<User | null>;
export const loggedInUserClaims = reactive({ roles: [] as string[] });

// useAuth() memoises the Auth instance itself, so there is nothing to cache here.
function getAuthInstance() {
  return useAuth();
}

let initPromise: Promise<void> | null = null;

// HeaderSidebar calls this from onMounted, and it is remounted every time the route
// switches between SSRLayout and MainLayout — so this has to be idempotent, otherwise
// every mount stacks another onAuthStateChanged listener and updateCustomClaims()
// (a getIdTokenResult() round-trip) runs once per copy on every auth change.
export function init(): Promise<void> {
  initPromise ??= getAuthInstance().then((auth) => {
    // onAuthStateChanged fires with the current state as soon as it is registered, so
    // that first callback is what populates loggedInUserClaims — no eager call needed.
    auth.onAuthStateChanged((user) => {
      loggedInUser.value = user;
      void updateCustomClaims();
      if (user) {
        console.log('Logged In.');
      } else {
        console.log('Logged Out.');
      }
    });
  });
  return initPromise;
}

export async function login() {
  console.log('Opening login page.');
  Loading.show();
  try {
    const { GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } = await import('firebase/auth');
    const auth = await getAuthInstance();
    const provider = new GoogleAuthProvider();
    // The resolver is passed here rather than baked into the Auth instance (see useAuth):
    // it is what loads the …/__/auth/iframe helper, and only sign-in actually needs it.
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
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
