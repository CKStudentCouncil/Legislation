/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/https';
import { onCall } from './sentry';
import * as logger from 'firebase-functions/logger';
import { createTransport } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import { ContentType, DocumentSpecificIdentity, LegislationContent } from '../../src/ts/models';
import { amendmentNotificationMail } from './mail/amendment-notification';
import { amendmentResolvedMail } from './mail/amendment-resolved';

const globalFunctionOptions = { region: 'asia-east1' };
const gmailEmail = process.env.GMAIL_EMAIL;
const gmailPassword = process.env.GMAIL_PASSWORD;
const mailTransport = createTransport({
  service: 'gmail',
  auth: { user: gmailEmail, pass: gmailPassword },
});
const db = admin.firestore();

function getApproverRoleForCategory(categoryId: string): string {
  // Mapping based on models.ts LegislationCategory and user requirements
  switch (categoryId) {
  case 'StudentCouncilOrder':
    return DocumentSpecificIdentity.Speaker.firebase;
  case 'JudicialCommitteeOrder':
    return DocumentSpecificIdentity.JudicialCommitteeChairman.firebase;
  case 'VotingCommitteeOrder':
    return DocumentSpecificIdentity.ElectoralCommitteeChairman.firebase;
  case 'Constitution':
  case 'Chairman':
  case 'ExecutiveDepartment':
  case 'StudentCouncil':
  case 'JudicialCommittee':
  case 'ExecutiveOrder':
  default:
    return DocumentSpecificIdentity.Chairman.firebase;
  }
}

function toFirebaseContent(c: any, index: number): any {
  const isFrontendFormat = typeof c.type === 'object' && c.type !== null;
  const content: any = {
    title: c.title || '',
    subtitle: c.subtitle || '',
    type: isFrontendFormat ? c.type.firebase : c.type,
    index,
  };
  if (c.content) content.content = c.content;
  if (c.deleted) content.deleted = c.deleted;
  if (c.frozenBy) content.frozenBy = c.frozenBy;
  if (c.resolutionUrls) content.resolutionUrls = c.resolutionUrls;
  return content;
}

const SCRIPT_URL_SCHEMES = ['javascript', 'vbscript', 'data'];

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A stored request that stops passing is not the approver's mistake, so it is a failed-precondition rather than an invalid-argument.
function amendmentError(stored: boolean, message: string): HttpsError {
  return new HttpsError(stored ? 'failed-precondition' : 'invalid-argument', message);
}

// A clause type arrives either as a ContentType-shaped object or as its key; only an own key of ContentType.VALUES is accepted.
function contentTypeKey(type: unknown): string | undefined {
  const key = isRecord(type) ? type.firebase : type;
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ContentType.VALUES, key) ? key : undefined;
}

// The plain-object form of a ContentType: what the review UI reads (`type.firebase`) and what Firestore accepts (it rejects class instances).
function plainContentType(key: string) {
  const type = (ContentType.VALUES as Record<string, ContentType>)[key];
  return { firebase: type.firebase, translation: type.translation, arabicOrdinal: type.arabicOrdinal };
}

// Reads the scheme the way the WHATWG URL parser does: leading C0 controls and spaces are skipped, and tab/CR/LF are ignored anywhere.
function hasScriptScheme(value: string): boolean {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) <= 0x20) start++;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value.slice(start).replace(/[\t\n\r]/g, ''));
  return scheme !== null && SCRIPT_URL_SCHEMES.includes(scheme[1].toLowerCase());
}

// The frozenBy/resolutionUrls of a full amendment pass through as sent, minus what can only be an attack: values that are not strings,
// malformed entries, and script-capable URL schemes.
function cleanMarkers(raw: Record<string, any>): any {
  const markers: any = {};
  if (typeof raw.frozenBy === 'string' && !hasScriptScheme(raw.frozenBy)) markers.frozenBy = raw.frozenBy;
  if (Array.isArray(raw.resolutionUrls)) {
    markers.resolutionUrls = raw.resolutionUrls
      .filter((r: any) => isRecord(r) && typeof r.title === 'string' && typeof r.url === 'string' && !hasScriptScheme(r.url))
      .map((r: any) => ({ title: r.title, url: r.url }));
  }
  return markers;
}

// Rebuilds a petitioner-supplied clause from the only fields a petition may carry; everything else (index, editor extras, ...) is dropped.
// Returns undefined when a field is present with the wrong type. Absent (or null) fields stay absent, so a modified clause keeps the live value.
function cleanClause(raw: unknown, withMarkers: boolean): any {
  if (!isRecord(raw)) return undefined;
  const clause: any = {};
  if (raw.type != null) {
    const key = contentTypeKey(raw.type);
    if (key === undefined) return undefined;
    clause.type = plainContentType(key);
  }
  for (const field of ['title', 'subtitle', 'content']) {
    if (raw[field] == null) continue;
    if (typeof raw[field] !== 'string') return undefined;
    clause[field] = raw[field];
  }
  if (raw.deleted != null) {
    if (typeof raw.deleted !== 'boolean') return undefined;
    clause.deleted = raw.deleted;
  }
  if (withMarkers) Object.assign(clause, cleanMarkers(raw));
  return clause;
}

// What a reviewer reads in a clause, used to tell whether the live clause is still the one a request was written against.
function clauseText(clause: Record<string, any>): string {
  return JSON.stringify([contentTypeKey(clause.type) ?? null, clause.title ?? '', clause.subtitle ?? '', clause.content ?? '']);
}

// The live clause a modified/deleted change targets: the approval has always looked it up by originalContent.index.
function targetClauseIndex(change: Record<string, any>): number | undefined {
  const index = isRecord(change.originalContent) && change.originalContent.index != null ? change.originalContent.index : change.originalIndex;
  return Number.isInteger(index) ? index : undefined;
}

function liveClauseView(live: Record<string, any>, typeKey: string): any {
  const view: any = { type: plainContentType(typeKey), title: live.title ?? '', subtitle: live.subtitle ?? '', deleted: !!live.deleted };
  if (typeof live.content === 'string') view.content = live.content;
  return view;
}

// Rebuilds one partial change for storage. What the reviewer sees as 現行條文 (and for a deleted clause, everything but the comment) comes from
// the live law, never from the petitioner, and a modified clause keeps the live frozenBy/resolutionUrls because they are never read from it.
function toReviewChange(raw: Record<string, any>, position: number, liveContent: any[], stored: boolean): any {
  const where = `change ${position + 1}`;
  const change: any = {
    id: typeof raw.id === 'string' ? raw.id : String(position),
    status: raw.status,
    comment: typeof raw.comment === 'string' ? raw.comment : '',
  };
  const current = cleanClause(raw.current, false);

  if (raw.status === 'added') {
    if (current?.type === undefined) throw amendmentError(stored, `Invalid clause in ${where}.`);
    change.current = { ...current, title: current.title ?? '', subtitle: current.subtitle ?? '' };
    return change;
  }

  const target = targetClauseIndex(raw);
  const live = target === undefined ? undefined : liveContent.find((c: any) => c.index === target);
  if (live === undefined) throw amendmentError(stored, `The clause targeted by ${where} does not exist in the legislation.`);
  const liveType = contentTypeKey(live.type);
  if (liveType === undefined) throw amendmentError(stored, `The clause targeted by ${where} has an unknown type.`);
  if (stored && (!isRecord(raw.originalContent) || clauseText(raw.originalContent) !== clauseText(live))) {
    throw amendmentError(stored, `The clause targeted by ${where} has changed since the request was written. Reject it and ask for a new draft.`);
  }

  change.originalIndex = live.index;
  change.originalContent = { index: live.index, ...liveClauseView(live, liveType) };
  if (raw.status === 'modified') {
    if (current === undefined) throw amendmentError(stored, `Invalid clause in ${where}.`);
    change.current = { ...liveClauseView(live, liveType), ...current };
  } else {
    change.current = liveClauseView(live, liveType);
  }
  return change;
}

type ParsedAmendment =
  | { amendmentType: 'full'; partialContent: null; fullContent: any[] }
  | { amendmentType: 'partial'; partialContent: any[]; fullContent: null };

// Validates a petition (at submit) or a stored request (at approval, where it also has to still match the live law) and rebuilds it from the
// fields it may carry. `data` is untrusted either way: a request stored before this check existed is only as good as its submitter.
function parseAmendmentContent(data: any, liveContent: any[], stored: boolean): ParsedAmendment {
  if (data.amendmentType === 'full') {
    if (!Array.isArray(data.fullContent)) throw amendmentError(stored, 'A full amendment needs fullContent.');
    const fullContent = data.fullContent.map((raw: unknown, i: number) => {
      const clause = cleanClause(raw, true);
      if (clause?.type === undefined) throw amendmentError(stored, `Invalid clause at position ${i + 1}.`);
      return { ...clause, title: clause.title ?? '', subtitle: clause.subtitle ?? '', index: i };
    });
    return { amendmentType: 'full', partialContent: null, fullContent };
  }

  if (data.amendmentType !== 'partial' || !Array.isArray(data.partialContent)) {
    throw amendmentError(stored, 'The amendment type must be partial or full, with the matching content.');
  }
  const partialContent: any[] = [];
  data.partialContent.forEach((raw: unknown, i: number) => {
    if (!isRecord(raw)) throw amendmentError(stored, `Invalid change ${i + 1}.`);
    // The real UI never sends 'unchanged' rows; one in a stored request is skipped rather than acted on.
    if (stored && raw.status === 'unchanged') return;
    if (raw.status !== 'added' && raw.status !== 'modified' && raw.status !== 'deleted') {
      throw amendmentError(stored, `Change ${i + 1} has an unsupported status.`);
    }
    partialContent.push(toReviewChange(raw, i, liveContent, stored));
  });
  return { amendmentType: 'partial', partialContent, fullContent: null };
}

function generateHistoryContentId(refDate: Date, existingIds: string[]): string {
  const utc8 = new Date(refDate.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear().toString();
  const month = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = utc8.getUTCDate().toString().padStart(2, '0');
  const dateStr = year + month + day;
  let counter = 1;
  while (existingIds.includes(dateStr + counter)) {
    counter++;
  }
  return dateStr + counter;
}

export const submitAmendmentRequest = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to submit an amendment.');
  }

  const data = request.data;
  if (!data.legislationId || !data.amendmentType || (!data.partialContent && !data.fullContent)) {
    throw new HttpsError('invalid-argument', 'Missing amendment data.');
  }

  const legislationSnap = await db.collection('legislation').doc(data.legislationId).get();
  if (!legislationSnap.exists) {
    throw new HttpsError('not-found', 'Legislation not found.');
  }
  const legislation = legislationSnap.data()!;

  // Nothing the petitioner sends is stored as sent: the request is rebuilt from validated fields, with the current text taken from the live law.
  const amendment = parseAmendmentContent(data, legislation.content || [], false);

  // Retrieve user details from auth token
  const petitionerName = request.auth.token.name || request.auth.token.email || 'Unknown User';
  const petitionerEmail = request.auth.token.email || undefined;
  const petitionerUid = request.auth.uid;

  // Create request document
  const requestRef = db.collection('amendmentRequests').doc();
  const requestData = {
    legislationId: data.legislationId,
    legislationName: legislation.name,
    categoryId: legislation.category,
    amendmentType: amendment.amendmentType,
    partialContent: amendment.partialContent,
    fullContent: amendment.fullContent,
    petitionerName,
    petitionerEmail,
    petitionerUid,
    status: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
  };
  await requestRef.set(requestData);

  // Find approver emails
  const requiredRole = getApproverRoleForCategory(legislation.category);
  const users = await admin.auth().listUsers();
  const approverEmails: string[] = [];

  for (const user of users.users) {
    if (user.email && user.customClaims?.roles?.includes(requiredRole)) {
      approverEmails.push(user.email);
    }
  }

  // Send Notification Email
  if (approverEmails.length > 0) {
    const reviewUrl = `https://law.cksc.tw/manage/amendments/${requestRef.id}`;

    const reviewerTitle = DocumentSpecificIdentity.VALUES[requiredRole].translation;

    const mailOptions: SendMailOptions = {
      from: '建中班聯會法律與公文系統 <cksc77th@gmail.com>',
      to: approverEmails,
      subject: `[草案審查請求] ${legislation.name}`,
      html: amendmentNotificationMail(legislation.name, requestData.petitionerName, requestData.petitionerEmail, reviewUrl, reviewerTitle),
    };
    await mailTransport.sendMail(mailOptions);
  } else {
    logger.warn(`No approvers found with role ${requiredRole} for ${legislation.name}`);
  }

  return { success: true, id: requestRef.id };
});

export const resolveAmendmentRequest = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { requestId, action, resolutionReason } = request.data;
  if (!requestId || (action !== 'approve' && action !== 'reject')) {
    throw new HttpsError('invalid-argument', 'Invalid request parameters');
  }

  const requestRef = db.collection('amendmentRequests').doc(requestId);

  // Start transaction
  const result = await db.runTransaction(async (transaction) => {
    const reqSnap = await transaction.get(requestRef);
    if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found');
    const reqData = reqSnap.data()!;

    // Check permissions
    const requiredRole = getApproverRoleForCategory(reqData.categoryId);
    const userRoles = (request.auth?.token?.roles as string[]) || [];
    if (!userRoles.includes(requiredRole)) {
      throw new HttpsError('permission-denied', `Requires ${requiredRole} role`);
    }

    const legislationRef = db.collection('legislation').doc(reqData.legislationId);
    const legislationSnap = await transaction.get(legislationRef);
    if (!legislationSnap.exists) throw new HttpsError('not-found', 'Target legislation not found');
    const legislationData = legislationSnap.data()!;

    if (action === 'reject') {
      transaction.delete(requestRef);
      return { status: 'rejected', reqData };
    }

    // Processing approval. The stored request is validated again, so a request stored before these checks existed is covered too, and
    // it is refused if a targeted live clause is no longer the one the reviewer was shown (the approver can still reject it).
    const amendment = parseAmendmentContent(reqData, legislationData.content || [], true);
    let newContent: LegislationContent[];

    if (amendment.amendmentType === 'full') {
      newContent = amendment.fullContent.map((c: any, i: number) => toFirebaseContent(c, i));
    } else {
      newContent = JSON.parse(JSON.stringify(legislationData.content || [])) as LegislationContent[];

      for (const change of amendment.partialContent) {
        if (change.status === 'added') {
          newContent.push(change.current); // Fallback append
        } else if (change.status === 'deleted') {
          const targetIndex = newContent.findIndex((c: any) => c.index === change.originalContent.index);
          if (targetIndex !== -1) {
            newContent[targetIndex].deleted = true;
          }
        } else if (change.status === 'modified') {
          const targetIndex = newContent.findIndex((c: any) => c.index === change.originalContent.index);
          if (targetIndex !== -1) {
            newContent[targetIndex] = { ...newContent[targetIndex], ...change.current };
          }
        }
      }

      // Re-index everything sequentially to maintain structure
      newContent = newContent.map((c: any, i: number) => toFirebaseContent(c, i));
    }

    const { historySummary, documentId } = request.data;
    const now = admin.firestore.Timestamp.now();

    if (!documentId) {
      throw new HttpsError('invalid-argument', 'Missing documentId for publication order.');
    }

    const finalDocumentId = documentId;

    // Document already exists (drafted by user). We just publish it.
    const orderDocRef = db.collection('documents').doc(documentId);
    const orderDocSnap = await transaction.get(orderDocRef);
    if (!orderDocSnap.exists) {
      throw new HttpsError('not-found', 'Publication order document not found.');
    }

    const orderDocData = orderDocSnap.data()!;
    if (orderDocData.authorEmail !== request.auth?.token?.email) {
      throw new HttpsError('permission-denied', 'Cannot publish a document authored by a different user.');
    }

    transaction.update(orderDocRef, {
      published: true,
      publishedAt: now,
    });

    // Update Legislation history and content
    const existingIds = (legislationData.history || []).map((h: any) => h.contentId).filter((cid: string) => !!cid);
    const contentId = generateHistoryContentId(now.toDate(), existingIds);

    const historyDocRef = db.collection('legislation').doc(reqData.legislationId).collection('historyContent').doc(contentId);
    transaction.set(historyDocRef, {
      content: newContent,
    });

    const historyArray = legislationData.history || [];
    const newHistoryEntry: any = {
      brief: historySummary || '法規修正',
      amendedAt: now,
      link: `https://law.cksc.tw/document/${finalDocumentId}`,
      contentId: contentId,
    };
    if (reqData.amendmentType === 'full') {
      newHistoryEntry.totalAmendment = true;
    }
    historyArray.push(newHistoryEntry);

    transaction.update(legislationRef, {
      content: newContent,
      history: historyArray,
    });

    transaction.delete(requestRef);

    return { status: 'approved', reqData, documentId: finalDocumentId };
  });

  // Post transaction email dispatch
  const { reqData } = result;
  if (reqData.petitionerEmail) {
    const docUrl = result.documentId ? `https://law.cksc.tw/document/${encodeURIComponent(result.documentId)}` : undefined;
    const legUrl = `https://law.cksc.tw/legislation/${reqData.legislationId}`;
    const mailOptions: SendMailOptions = {
      from: '建中班聯會法律與公文系統 <cksc77th@gmail.com>',
      to: reqData.petitionerEmail,
      subject: `[草案審查結果] ${reqData.legislationName}`,
      html: amendmentResolvedMail(
        reqData.legislationName,
        reqData.petitionerName,
        result.status as 'approved' | 'rejected',
        resolutionReason,
        docUrl,
        legUrl,
      ),
    };
    await mailTransport.sendMail(mailOptions).catch((e) => logger.error('Failed to send petitioner email', e));
  }

  // Note: publishDocument function manually handles `published=true` downstream triggers,
  // currently we just created the doc in DB. The user's system often publishes via `updateIdCache` triggering sitemap.

  return { success: true, result };
});
