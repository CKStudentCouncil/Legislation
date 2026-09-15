import { Loading } from 'quasar';
import type { User } from 'firebase/auth';
import type * as models from 'src/ts/models.ts';
import type { Ref } from 'vue';
import { reactive, ref } from 'vue';
import { useAuth, useFunctionAsync } from 'boot/vuefire.ts';
import { setSentryUser } from 'boot/sentry.ts';
import { explainAuthError } from 'src/ts/firebase-errors.ts';
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
  initPromise ??= getAuthInstance()
    .then((auth) => {
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
    })
    .catch((error: unknown) => {
      // Idempotent must not mean "permanently broken": caching the rejection would leave
      // the header stuck signed-out with no way back short of a manual reload. The next
      // mount retries instead.
      initPromise = null;
      throw error;
    });
  return initPromise;
}

export async function login() {
  console.log('Opening login page.');
  Loading.show();
  try {
    // Concurrently, not one await after the other: a popup only opens while the browser still
    // considers the click that asked for it recent, and Safari is the strictest about it. Both
    // are normally already resolved — HeaderSidebar's init() loaded them on mount — so this
    // reaches signInWithPopup within a microtask or two of the click rather than a round-trip.
    const [{ GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver }, auth] = await Promise.all([
      import('firebase/auth'),
      getAuthInstance(),
    ]);
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
    // '登入失敗' on its own leaves the visitor with nothing to try. Nearly every way this
    // throws is their browser or our access policy rather than a bug — a blocked popup, an
    // account the project does not admit — so say which, and keep those out of Sentry.
    const { message, report } = explainAuthError(error);
    notifyError(message, error as Error, { report });
  }
}

export async function updateCustomClaims() {
  const auth = await getAuthInstance();
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (!claims) {
    loggedInUserClaims.roles = [];
    // Also covers logout: onAuthStateChanged calls this with no current user.
    setSentryUser(null);
    return;
  }
  loggedInUserClaims.roles = (claims.claims.roles as string[]) || [];
  // Roles decide what a user could see, so they are the single most useful thing to have
  // attached to an issue in a system where the same page renders differently per role.
  setSentryUser(auth.currentUser, loggedInUserClaims.roles);
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
