/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import { DocumentReference, FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/https';
import { onCall, onDocumentWritten } from './sentry';
import * as logger from 'firebase-functions/logger';

const globalFunctionOptions = { region: 'asia-east1' };
const db = admin.firestore();

// Mirrors src/ts/utils.ts generateHistoryContentId — YYYYMMDD{counter} in UTC+8.
function generateHistoryContentId(refDate: Date, existingIds: string[]): string {
  const utc8 = new Date(refDate.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear().toString();
  const month = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = utc8.getUTCDate().toString().padStart(2, '0');
  const dateStr = year + month + day;
  let counter = 1;
  while (existingIds.includes(dateStr + counter)) counter++;
  return dateStr + counter;
}

// Fields that, when changed alone, should NOT create a new history version.
const IGNORED_FIELDS = new Set(['read', 'lastEditedAt', 'lastEditedBy', 'revertSource']);

function meaningfulChange(before: any, after: any): boolean {
  if (!before) return true;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) return true;
  }
  return false;
}

// Server-side, tamper-proof edit history. Archives the committed document snapshot on every
// meaningful write. Editor identity comes from the rules-validated lastEditedBy field.
export const recordDocumentHistory = onDocumentWritten({ ...globalFunctionOptions, document: 'documents/{docId}' }, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return; // deletion — nothing to archive
  const before = event.data?.before;
  const afterData = after.data()!;
  const beforeData = before?.exists ? before.data()! : null;
  if (!meaningfulChange(beforeData, afterData)) return;

  // NOTE: event.params values are URL-encoded in v2 Firestore triggers, so a Chinese doc ID
  // (建班…字第…號) arrives percent-encoded. Rebuilding the path from it via db.collection(...).doc(docId)
  // points at a different, non-existent document and writes history under the wrong ID. Use the
  // written snapshot's own ref — it is the actual, correctly-decoded DocumentReference.
  const docRef = after.ref;
  const docId = docRef.id;
  const historyCol = docRef.collection('history');
  const existing = await historyCol.orderBy('editedAt', 'desc').get();
  const existingIds = existing.docs.map((d) => d.id);
  const parentVersionId = existing.docs[0]?.id;
  const versionId = generateHistoryContentId(new Date(), existingIds);
  const changeType = !beforeData ? 'create' : afterData.revertSource ? 'revert' : 'update';

  const entry: any = {
    versionId,
    snapshot: afterData,
    editedAt: FieldValue.serverTimestamp(),
    editedBy: afterData.lastEditedBy ?? { email: null, uid: null, name: null },
    changeType,
  };
  if (parentVersionId) entry.parentVersionId = parentVersionId;
  await historyCol.doc(versionId).set(entry);
  logger.info('Recorded document history', { docId, versionId, changeType });

  // Clear the revertSource marker so subsequent normal edits aren't mislabeled. This write only
  // touches an ignored field, so the re-triggered run returns early without a spurious version.
  if (changeType === 'revert' && afterData.revertSource) {
    await after.ref.update({ revertSource: FieldValue.delete() });
  }
});

// Mirrors isLegacySteward() in firestore.rules: only council leadership may maintain an unowned (legacy)
// document, and only one they can already read. Callers check the author/editor/manager tiers themselves,
// so the read check here only needs the paths that don't go through those tiers.
const LEGACY_STEWARD_ROLES = ['Chairman', 'Speaker', 'DeputySpeaker', 'JudicialCommitteeChairman'];
export function isLegacySteward(doc: Record<string, any>, email: string | null | undefined, roles: string[]): boolean {
  const hasNoAuthor = doc.authorEmail == null || doc.authorEmail === 'legacy';
  if (!hasNoAuthor || !roles.some((r) => LEGACY_STEWARD_ROLES.includes(r))) return false;
  const isDeclassified = doc.published === true && doc.declassifyAt != null && doc.declassifyAt.toMillis() <= Date.now();
  return (
    doc.confidentiality === 'Public' ||
    isDeclassified ||
    (Array.isArray(doc.viewers) && doc.viewers.some((r: string) => roles.includes(r))) ||
    (Array.isArray(doc.viewerEmails) && email != null && doc.viewerEmails.includes(email))
  );
}

// Non-destructive revert (git-revert semantics). Restores a historical snapshot's content/metadata
// while preserving the live ownership/permission fields; the trigger then records it as a new version.
export const revertDocument = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated.');
  }
  const { docId, versionId } = request.data ?? {};
  if (!docId || !versionId) {
    throw new HttpsError('invalid-argument', 'Missing docId or versionId.');
  }

  const email = (request.auth.token.email as string | undefined) ?? null;
  const roles = (request.auth.token.roles as string[] | undefined) ?? [];
  const PERMISSION_FIELDS = ['authorEmail', 'viewers', 'viewerEmails', 'editorRoles', 'editorEmails', 'managerRoles', 'managerEmails', 'read'];

  await db.runTransaction(async (transaction) => {
    const docRef = db.collection('documents').doc(docId);
    const docSnap = await transaction.get(docRef);
    if (!docSnap.exists) throw new HttpsError('not-found', 'Document not found.');
    const live = docSnap.data()!;

    // Authorize: caller must be editor-or-above (author, manager, or editor) or a legacy steward on the LIVE doc.
    const inList = (arr: any) => Array.isArray(arr) && email != null && arr.includes(email);
    const hasRole = (arr: any) => Array.isArray(arr) && arr.some((r: string) => roles.includes(r));
    const isAuthor = !!live.authorEmail && live.authorEmail === email;
    const isManager = inList(live.managerEmails) || hasRole(live.managerRoles);
    const isEditor = isManager || inList(live.editorEmails) || hasRole(live.editorRoles);
    if (!(isAuthor || isEditor || isLegacySteward(live, email, roles))) {
      throw new HttpsError('permission-denied', 'You do not have permission to revert this document.');
    }

    const versionRef = docRef.collection('history').doc(versionId);
    const versionSnap = await transaction.get(versionRef);
    if (!versionSnap.exists) throw new HttpsError('not-found', 'Version not found.');

    // History outlives its parent, so only a version recorded after the LIVE document was created is restorable;
    // an older one belongs to an earlier document that had this ID. The answer is deliberately the same as for a
    // version that does not exist. (See listDocumentHistory for why createTime is the test.)
    const versionEditedAt = versionSnap.data()!.editedAt;
    if (!(versionEditedAt instanceof Timestamp) || !isAfter(versionEditedAt, docSnap.createTime!)) {
      throw new HttpsError('not-found', 'Version not found.');
    }

    const snapshot = (versionSnap.data()!.snapshot as Record<string, any>) ?? {};

    // Full set of the snapshot, but keep the LIVE ownership/permission/read fields.
    const restored: Record<string, any> = { ...snapshot };
    for (const f of PERMISSION_FIELDS) {
      if (f in live) restored[f] = live[f];
      else delete restored[f];
    }
    restored.lastEditedBy = {
      email,
      uid: request.auth?.uid ?? null,
      name: (request.auth?.token.name as string | undefined) ?? null,
    };
    restored.lastEditedAt = admin.firestore.Timestamp.now();
    restored.revertSource = versionId;

    transaction.set(docRef, restored);
  });

  return { success: true };
});

// True iff a is strictly later than b, at the (microsecond) precision Firestore itself orders timestamps by.
function isAfter(a: Timestamp, b: Timestamp): boolean {
  return a.seconds > b.seconds || (a.seconds === b.seconds && a.nanoseconds > b.nanoseconds);
}

// Deeper than Firestore lets a document nest (20 levels), so no stored value gets near it.
const MAX_WIRE_DEPTH = 30;

// Turns a value read from Firestore into one the callable encoding can carry. Timestamps do not survive that
// encoding (they arrive as { _seconds, _nanoseconds }), so they are sent as epoch milliseconds, which is what the
// history dialog turns them back into. Document fields are client-writable and unvalidated, and recordDocumentHistory
// copies every one of them into the entry, so this goes by whitelist: only strings, booleans, numbers, null, arrays
// and plain maps are walked or passed on. A bytes field (a Buffer, which would fan out to one key per byte) and any
// other class instance become null, a reference becomes its path and a GeoPoint its coordinates; a number the
// encoding cannot carry (NaN, Infinity) becomes null, as it would in JSON. Nothing else is ever iterated, so no
// value can fan out into more than it holds.
function toWire(value: any, depth = 0): any {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return null; // bigint, symbol, function
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof DocumentReference) return value.path;
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (depth >= MAX_WIRE_DEPTH) return null;
  if (Array.isArray(value)) return value.map((v) => toWire(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toWire(v, depth + 1);
  return out;
}

// The most one listDocumentHistory response carries, in bytes of JSON. It bounds a PAGE of the listing, not the listing:
// older entries are fetched with the cursor (see nextBefore below), so however much history there is, all of it can be
// reached. The response is that JSON escaped once more inside another string, at worst twice its size, so a page stays
// far below the ~32 MiB a Cloud Run response may be. A document's history holds a full snapshot per edit and document
// fields are client-writable, so without a bound on a page anyone who can write a document could make a response as
// large as they like.
const HISTORY_PAGE_BUDGET_BYTES = 4 * 1024 * 1024;
// An entry is stored in at most 1 MiB (the size limit of a document) and JSON spends at most 6 bytes on a stored byte
// (a control character such as U+0001 becomes \u0001), so no real entry gets near this. It is the backstop that stops an
// entry that somehow did from making its page undeliverable, and with it every older page: such an entry is listed
// without its snapshot.
const HISTORY_ENTRY_MAX_BYTES = 8 * 1024 * 1024;
// Entries read per query, so that neither the whole history nor much of it is ever in memory at once.
const HISTORY_QUERY_LIMIT = 10;

// Whether id could be the ID of a history entry: what Firestore accepts as a document ID (not '.', '..' or __name__, no
// '/') and no longer than any generated one. Anything else is turned away before it reaches a reference.
function isEntryId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id);
}

// Lists the edit history of the document as it exists now, newest first. Clients may not read
// documents/{docId}/history directly (see firestore.rules): history is deliberately kept when its parent is deleted or
// renamed, and a rule that judged access from whatever document currently sits at that ID would hand an earlier
// document's history to whoever re-creates the ID. Rules cannot read a document's createTime; this can. createTime
// survives updates and overwrites (revertDocument's set included) and changes only when a document is deleted and
// created again, and recordDocumentHistory writes every entry after its parent exists, so the entries of the document
// as it is now are exactly those with editedAt later than its createTime. Access is what the history read rule used to
// grant: the author, or a listed editor/manager (by email or role), of the LIVE document; nobody else, unowned
// documents included.
//
// The request is { docId, before? } and the result is { versions, nextBefore }. versions is one page of the list as ONE
// JSON STRING, not an array of maps, because the callable codec cannot be trusted with the entries: the client's decoder
// throws on any map that has a truthy "@type" key (or its own "hasOwnProperty" key), an entry carries the document's
// client-writable, unvalidated fields, and one such key anywhere in it would make the listing undecodable for every
// viewer for good. A string crosses both ends' codecs untouched.
//
// A page holds entries newest first while they fit HISTORY_PAGE_BUDGET_BYTES of JSON, and always at least one, so every
// page makes progress. nextBefore is the ID of the last (oldest) entry on the page when older entries remain, and null
// when the page ends the history. Sending it back as `before` returns the entries older than that one, so no version is
// ever out of reach, whatever the entries above it cost. `before` only counts if it names an entry of the document as it
// is now, that is one that exists and was recorded after the document's createTime; a cursor from an earlier document
// with this ID, or one that names nothing, is refused as an invalid cursor, both alike, so it cannot be used to read
// the earlier document's entries or to find out whether they exist.
export const listDocumentHistory = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated.');
  }
  const { docId, before } = request.data ?? {};
  if (typeof docId !== 'string' || !docId || docId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Missing docId.');
  }
  if (before != null && (typeof before !== 'string' || !isEntryId(before))) {
    throw new HttpsError('invalid-argument', 'Invalid cursor.');
  }

  const email = (request.auth.token.email as string | undefined) ?? null;
  const claimRoles = request.auth.token.roles as unknown;
  const roles: string[] = Array.isArray(claimRoles) ? claimRoles : [];
  const inList = (arr: any) => Array.isArray(arr) && email != null && arr.includes(email);
  const hasRole = (arr: any) => Array.isArray(arr) && arr.some((r: string) => roles.includes(r));

  // One read-only transaction, so the document that is authorized against, the createTime that is compared with,
  // the cursor that is checked and the entries that are returned are all the same instance of the document.
  return await db.runTransaction(
    async (transaction) => {
      const docSnap = await transaction.get(db.collection('documents').doc(docId));
      const parent = docSnap.data();
      // A missing document gets the same answer as an unauthorized caller, as it did from the rules.
      if (
        !docSnap.exists ||
        !parent ||
        !(
          (!!parent.authorEmail && parent.authorEmail === email) ||
          inList(parent.editorEmails) ||
          inList(parent.managerEmails) ||
          hasRole(parent.editorRoles) ||
          hasRole(parent.managerRoles)
        )
      ) {
        throw new HttpsError('permission-denied', 'You do not have permission to view the history of this document.');
      }

      const history = docSnap.ref.collection('history');
      let after: DocumentSnapshot | undefined;
      if (before != null) {
        // Only after the caller is authorized, so that the answer says nothing to anyone who is not.
        const cursor = await transaction.get(history.doc(before));
        const cursorAt = cursor.exists ? cursor.get('editedAt') : undefined;
        if (!(cursorAt instanceof Timestamp) || !isAfter(cursorAt, docSnap.createTime!)) {
          throw new HttpsError('invalid-argument', 'Invalid cursor.');
        }
        after = cursor;
      }

      const newestFirst = history.where('editedAt', '>', docSnap.createTime!).orderBy('editedAt', 'desc');
      const listed: string[] = []; // each entry as JSON, sized once here and never serialized again
      let bytes = 2; // the brackets around the list
      let lastListedId: string | null = null;
      let nextBefore: string | null = null;
      collect: for (;;) {
        // startAfter(snapshot) resumes after that entry in the query's own order, which breaks a tie in editedAt by the
        // entry's ID, so entries recorded at the same instant are neither skipped nor listed twice at a boundary.
        const page = await transaction.get((after ? newestFirst.startAfter(after) : newestFirst).limit(HISTORY_QUERY_LIMIT));
        for (const d of page.docs) {
          const data = d.data();
          const version = {
            versionId: data.versionId ?? d.id,
            snapshot: data.snapshot ?? {},
            editedAt: data.editedAt,
            editedBy: data.editedBy ?? null,
            changeType: data.changeType ?? 'update',
            parentVersionId: data.parentVersionId ?? null,
          };
          let json: string;
          try {
            json = JSON.stringify(toWire(version));
          } catch (e) {
            // toWire is meant not to throw; if it ever does, one entry must not take the whole listing down with it.
            // (Only the two fields that carry document content are given up; the rest is written by the trigger.)
            logger.warn('History entry could not be converted; listing it without its content', { docId, versionId: d.id, error: String(e) });
            json = JSON.stringify(toWire({ ...version, snapshot: {}, editedBy: null }));
          }
          if (Buffer.byteLength(json) > HISTORY_ENTRY_MAX_BYTES) json = JSON.stringify(toWire({ ...version, snapshot: {} }));
          const size = Buffer.byteLength(json) + (listed.length > 0 ? 1 : 0); // and the comma before it
          // The first entry of a page is listed however large it is (see HISTORY_ENTRY_MAX_BYTES). One that does not fit
          // after it starts the next page, and the cursor is the way to that page.
          if (listed.length > 0 && bytes + size > HISTORY_PAGE_BUDGET_BYTES) {
            nextBefore = lastListedId;
            break collect;
          }
          listed.push(json);
          bytes += size;
          lastListedId = d.id;
        }
        if (page.size < HISTORY_QUERY_LIMIT) break;
        after = page.docs[page.size - 1];
      }
      return { versions: `[${listed.join(',')}]`, nextBefore };
    },
    { readOnly: true },
  );
});
