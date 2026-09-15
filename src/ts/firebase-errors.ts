/**
 * Turning a Firebase failure into a sentence the reader can act on — and deciding whether it
 * is also worth an issue in Sentry.
 *
 * Most of what arrived in Sentry from the browser on the first day of reporting was not a
 * bug: a sign-in popup the browser blocked, a Google account the project does not admit, a
 * phone that lost its connection halfway through a query. Each of those needs to tell the
 * person what to do next; none of them needs a stack trace filed against a release, where it
 * only buries the failures that *are* ours.
 *
 * Pure functions with no imports — DocumentsPageV2 renders server-side, so this is reached
 * during the SSR pass too.
 */

export interface ExplainedError {
  /** What to show the user, in place of the generic 'x失敗'. */
  message: string;
  /** Whether this is a defect in our code, i.e. whether Sentry should hear about it. */
  report: boolean;
}

/**
 * FirebaseError carries `code` ('auth/popup-blocked', 'permission-denied'); the DOMExceptions
 * thrown by navigator.share and the clipboard carry `name` ('AbortError') instead.
 */
export function errorCode(e: unknown): string {
  if (typeof e !== 'object' || e === null) return '';
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  const name = (e as { name?: unknown }).name;
  return typeof name === 'string' ? name : '';
}

function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (typeof e !== 'object' || e === null) return '';
  const message = (e as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

/**
 * The connection dropped, rather than anything about the request being wrong.
 *
 * Firestore's own transport says so three different ways depending on which half of it gave
 * up: the gRPC status 'unavailable', the WebChannel wrapper's bare `FirebaseError: Connection
 * failed.` (LEGISLATION-5, an iPhone on a flaky mobile connection), and the fetch/XHR wording
 * the browser supplies. None of them is actionable, and on a site that is mostly read on
 * phones all three are ordinary weather.
 */
export function isTransientNetworkError(e: unknown): boolean {
  const code = errorCode(e);
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') return true;
  if (code === 'auth/network-request-failed' || code === 'functions/unavailable' || code === 'functions/deadline-exceeded') return true;
  return /Connection failed|Failed to fetch|NetworkError|Load failed|network error/i.test(errorMessage(e));
}

const NETWORK_MESSAGE = '網路連線不穩，請確認網路後再試一次';

/**
 * Sign-in failures, which are overwhelmingly about the visitor's browser or the project's own
 * access policy rather than about this code.
 */
const AUTH_ERRORS: Record<string, ExplainedError> = {
  // Safari and every in-app browser drop the popup when signInWithPopup is not reached inside
  // the click that started it — and plenty of visitors simply run a popup blocker (LEGISLATION-9).
  'auth/popup-blocked': { message: '瀏覽器封鎖了登入視窗，請允許本站的彈出式視窗後再試一次', report: false },
  'auth/popup-closed-by-user': { message: '登入視窗已關閉，尚未完成登入', report: false },
  'auth/cancelled-popup-request': { message: '已取消先前的登入視窗，請再試一次', report: false },
  // The project does not admit this Google account — an access-policy answer, delivered to
  // someone who is simply not on the list, and correct behaviour (LEGISLATION-6).
  'auth/admin-restricted-operation': { message: '此 Google 帳號未獲准登入本系統，請洽班聯會資訊組開通', report: false },
  'auth/user-disabled': { message: '此帳號已被停用，請洽班聯會資訊組', report: false },
  'auth/network-request-failed': { message: NETWORK_MESSAGE, report: false },
  'auth/too-many-requests': { message: '嘗試登入次數過多，請稍後再試', report: false },
  'auth/web-storage-unsupported': { message: '此瀏覽器停用了網站儲存空間，無法登入。請關閉無痕模式或允許本站儲存資料', report: false },
  'auth/operation-not-supported-in-this-environment': { message: '此瀏覽器不支援 Google 登入，請改用系統瀏覽器開啟本頁', report: false },
  // The remaining two are misconfiguration on our side: a new domain that was never added to
  // the Firebase console, or the Google provider switched off. Those we do want to hear about.
  'auth/unauthorized-domain': { message: '此網域尚未授權登入，請洽班聯會資訊組', report: true },
  'auth/operation-not-allowed': { message: 'Google 登入尚未啟用，請洽班聯會資訊組', report: true },
};

export function explainAuthError(e: unknown): ExplainedError {
  return AUTH_ERRORS[errorCode(e)] ?? { message: '登入失敗，請稍後再試', report: true };
}

/**
 * Failures of a Firestore read issued on the reader's behalf.
 *
 * 'permission-denied' stays reportable: after the exact-公文字號 lookup stopped being a
 * single-document get (see DocumentsPageV2), the only way a public list query earns one is if
 * firestore.rules and the query have drifted apart — which is ours to fix.
 */
export function explainQueryError(e: unknown, fallback: string): ExplainedError {
  if (isTransientNetworkError(e)) return { message: NETWORK_MESSAGE, report: false };
  const code = errorCode(e);
  // Firestore normalises a query into disjunctive normal form and refuses more than 30 terms.
  // Two identity filters at once reach that on their own: a 發文部門 covers up to 14 identities
  // and a 受文部門 up to 13, so one of each is 182 terms and cannot run at any size of data.
  // The person asked for something the database will not answer — tell them which half to narrow.
  if (code === 'invalid-argument' && /disjunction/i.test(errorMessage(e))) {
    return { message: '篩選條件的組合過多，請縮小「發文部門／發文者」或「受文部門／受文者」的範圍', report: false };
  }
  if (code === 'resource-exhausted') return { message: '系統忙碌中，請稍後再試', report: true };
  // A filter combination with no composite index behind it (firestore.indexes.json). Ours to add.
  if (code === 'failed-precondition') return { message: '系統尚未支援此篩選組合，已通報班聯會資訊組', report: true };
  return { message: fallback, report: true };
}
