/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
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

  const docId = event.params.docId as string;
  const historyCol = db.collection('documents').doc(docId).collection('history');
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

    // Authorize: caller must be editor-or-above (author, manager, or editor) on the LIVE doc.
    const inList = (arr: any) => Array.isArray(arr) && email != null && arr.includes(email);
    const hasRole = (arr: any) => Array.isArray(arr) && arr.some((r: string) => roles.includes(r));
    const hasNoAuthor = !live.authorEmail || live.authorEmail === 'legacy';
    const isAuthor = !!live.authorEmail && live.authorEmail === email;
    const isManager = inList(live.managerEmails) || hasRole(live.managerRoles);
    const isEditor = isManager || inList(live.editorEmails) || hasRole(live.editorRoles);
    if (!(isAuthor || isEditor || hasNoAuthor)) {
      throw new HttpsError('permission-denied', 'You do not have permission to revert this document.');
    }

    const versionRef = docRef.collection('history').doc(versionId);
    const versionSnap = await transaction.get(versionRef);
    if (!versionSnap.exists) throw new HttpsError('not-found', 'Version not found.');
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
