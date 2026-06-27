/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';
admin.initializeApp(); // This must run before everything else
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError, onCall, onRequest } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import * as logger from 'firebase-functions/logger';
import { drive_v3, google } from 'googleapis';
import * as Stream from 'stream';
import { addUserWithRole, checkRole, editUserClaims } from './auth';
import { createTransport } from 'nodemailer';
import { newDocMail } from './mail/new-doc';
import { MailOptions } from 'nodemailer/lib/smtp-pool';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { newMeetingNotice } from './mail/new-meeting-notice';
import { accessGrantedMail } from './mail/access-granted';
import { SitemapStream } from 'sitemap';
import { createGzip } from 'zlib';
import * as https from 'https';
export { submitAmendmentRequest, resolveAmendmentRequest } from './amendments';
export { recordDocumentHistory, revertDocument } from './history';
import * as utf8 from 'utf8';
import { DocumentSpecificIdentity, DocumentType, User } from '../../src/ts/models';
import { convertToChineseDay, getCurrentReign } from '../../src/ts/shared-utils';

const globalFunctionOptions = { region: 'asia-east1' };
const ACCOUNT_MANAGER_ROLES = ['Chairman', 'Speaker', 'JudicialCommitteeChairman'];
// IndexNow: instantly notify Bing/Yandex (which feed ChatGPT & Perplexity) of changed
// URLs. The key is verified via the matching public/<key>.txt file served at the domain root.
const INDEXNOW_KEY = '1e97df272cbfcb532673b3550ccd6a16';
const INDEXNOW_HOST = 'law.cksc.tw';
const auth = new google.auth.GoogleAuth({
  keyFile: 'src/credential.json',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const db = admin.firestore();
const driveAPI = google.drive({ version: 'v3', auth }) as drive_v3.Drive;
const gmailEmail = process.env.GMAIL_EMAIL;
const gmailPassword = process.env.GMAIL_PASSWORD;
const mailTransport = createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

function getActorInfo(request: CallableRequest) {
  return {
    uid: request.auth?.uid ?? null,
    email: (request.auth?.token.email as string | undefined) ?? null,
    name: (request.auth?.token.name as string | undefined) ?? null,
  };
}

function getUserLogInfo(user: admin.auth.UserRecord) {
  return {
    uid: user.uid,
    email: user.email ?? null,
    name: user.displayName ?? null,
    roles: (user.customClaims?.roles as string[] | undefined) ?? [],
  };
}

export const addUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, ACCOUNT_MANAGER_ROLES);
  const user = request.data as User;
  const createdUser = await addUserWithRole(user);
  logger.info('User added', {
    actor: getActorInfo(request),
    target: {
      ...getUserLogInfo(createdUser),
      name: createdUser.displayName ?? user.name ?? null,
      roles: user.roles,
    },
  });
  return { success: true };
});

export const deleteUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, ACCOUNT_MANAGER_ROLES);
  const targetUser = await admin.auth().getUser(request.data.uid);
  await admin.auth().deleteUser(request.data.uid);
  logger.info('User deleted', {
    actor: getActorInfo(request),
    target: getUserLogInfo(targetUser),
  });
  return { success: true };
});

export const editUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, ACCOUNT_MANAGER_ROLES);
  const actor = getActorInfo(request);
  const beforeUser = await admin.auth().getUser(request.data.uid);
  logger.info('User edited, before:', {
    actor,
    target: getUserLogInfo(beforeUser),
    updatedClaims: request.data.claims ?? {},
  });
  await editUserClaims(request.data.uid, request.data.claims);
  const afterUser = await admin.auth().getUser(request.data.uid);
  logger.info('User edited, after:', {
    actor,
    before: getUserLogInfo(beforeUser),
    after: getUserLogInfo(afterUser),
    updatedClaims: request.data.claims ?? {},
  });
  return { success: true };
});

export const getAllUsers = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, ACCOUNT_MANAGER_ROLES);
  const users = await admin.auth().listUsers();
  return users.users.map((user) => {
    return {
      uid: user.uid,
      email: user.email,
      roles: user.customClaims?.roles,
      name: user.displayName,
    };
  });
});

export const uploadAttachment = onCall(
  {
    ...globalFunctionOptions,
    memory: '512MiB',
  },
  async (request) => {
    if (request.auth == null) {
      throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // Only provisioned council members (users with at least one role) may upload, to prevent
    // abuse of the shared Drive as anonymous public file hosting.
    const uploaderRoles = (request.auth.token.roles as string[] | undefined) ?? [];
    if (uploaderRoles.length === 0) {
      throw new HttpsError('permission-denied', 'You must have a council role to upload attachments.');
    }
    const { name, content, mimeType } = request.data;
    const buf = Buffer.from(content, 'base64');
    const fileSize = buf.length;
    if (fileSize > 25 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'File size exceeds 25MiB limit.');
    }
    const folderQuery = await driveAPI.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${getCurrentReign()}'`,
      fields: 'files(id)',
    });
    const folder =
      folderQuery.data.files?.[0].id ??
      (
        await driveAPI.files.create({
          requestBody: {
            name: getCurrentReign(),
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['1zNk5v8ZHJwAbDXCO_GswQoeY_CBCpb7m'],
          },
          fields: 'id',
        })
      ).data.id;
    const file = await driveAPI.files.create({
      requestBody: {
        name,
        mimeType,
        parents: [folder ?? '1zNk5v8ZHJwAbDXCO_GswQoeY_CBCpb7m'],
      },
      media: {
        mimeType,
        body: new Stream.PassThrough().end(buf),
      },
      fields: 'id,webViewLink',
    });
    await driveAPI.permissions.create({
      fileId: file.data.id ?? '',
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    await driveAPI.permissions.create({
      fileId: file.data.id ?? '',
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: 'cksc77th@gmail.com',
      },
    });
    return { success: true, url: file.data.webViewLink };
  },
);

export const publishDocument = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const docId = request.data.docId as string;
  const doc = (await admin.firestore().collection('documents').doc(docId).get()).data();
  if (!doc) {
    throw new HttpsError('not-found', 'Document not found.');
  }

  // Only someone who can edit the document may trigger its publication notifications, to prevent
  // unauthenticated callers from spamming recipients with arbitrary documents' emails.
  const callerEmail = request.auth.token.email as string | undefined;
  const callerRoles = (request.auth.token.roles as string[] | undefined) ?? [];
  const inList = (arr: unknown) => Array.isArray(arr) && !!callerEmail && arr.includes(callerEmail);
  const hasAnyRole = (arr: unknown) => Array.isArray(arr) && arr.some((r: string) => callerRoles.includes(r));
  const canPublish =
    !doc.authorEmail ||
    doc.authorEmail === 'legacy' ||
    doc.authorEmail === callerEmail ||
    inList(doc.editorEmails) ||
    hasAnyRole(doc.editorRoles) ||
    inList(doc.managerEmails) ||
    hasAnyRole(doc.managerRoles);
  if (!canPublish) {
    throw new HttpsError('permission-denied', 'Not authorized to publish this document.');
  }

  const names = [] as string[];
  const senderName = DocumentSpecificIdentity.VALUES[doc.fromSpecific].translation;
  let senderMail = undefined as string | undefined;
  const recipientsEmail = [] as string[];
  const ccEmail = [] as string[];

  const toChecker = (role: string) => {
    if (doc.toSpecific && doc.toSpecific.includes(role)) {
      names.push(DocumentSpecificIdentity.VALUES[role].translation);
      return true;
    }
    return false;
  };
  const ccChecker = (role: string) => {
    if (doc.ccSpecific && doc.ccSpecific.includes(role)) {
      names.push(DocumentSpecificIdentity.VALUES[role].translation);
      return true;
    }
    return false;
  };
  // Check accounts
  const users = await admin.auth().listUsers();
  for (const user of users.users) {
    if (user.email == null) continue;
    const roles = (user.customClaims?.roles as string[] | undefined) ?? [];
    if (roles.includes(doc.fromSpecific)) senderMail = user.email;
    if (roles.some(toChecker)) recipientsEmail.push(user.email);
    if (roles.some(ccChecker)) ccEmail.push(user.email);
  }
  // Check mailing list
  const mailingList = (await admin.firestore().collection('settings').doc('mailingList').get()).data();
  if (mailingList) {
    for (const entry of mailingList.main) {
      if (entry.roles.some(toChecker)) recipientsEmail.push(entry.email);
      if (entry.roles.some(ccChecker)) ccEmail.push(entry.email);
    }
  }
  const mailOptions = {
    from: '建中班聯會法律與公文系統 <cksc77th@gmail.com>',
    to: recipientsEmail,
    subject: `[公文] ${doc.subject}`,
    html: newDocMail(docId, doc.subject, Array.from(new Set(names)).join('、'), senderName),
  } as MailOptions;
  if (recipientsEmail.length == 0) {
    if (ccEmail.length != 0) {
      mailOptions.to = ccEmail;
    } else {
      return { success: false, error: 'No recipients found.' };
    }
  } else if (ccEmail.length != 0) {
    mailOptions.cc = ccEmail;
  }
  if (doc.type === 'MeetingNotice') {
    const cal = ical();
    const meetingTime = doc.meetingTime.toDate() as Date;
    const endTime = new Date(meetingTime);
    const organizerEmail = senderMail ?? 'cksc77th@gmail.com';
    endTime.setHours(endTime.getHours() + 1);
    cal.method(ICalCalendarMethod.REQUEST);
    cal.createEvent({
      start: meetingTime,
      end: endTime,
      summary: doc.subject,
      description: doc.content,
      location: doc.location,
      organizer: {
        name: senderName,
        email: organizerEmail,
        mailto: organizerEmail,
        sentBy: 'cksc77th@gmail.com',
      },
      url: 'https://law.cksc.tw/document/' + docId,
    });
    mailOptions.icalEvent = {
      filename: 'invite.ics',
      method: 'REQUEST',
      content: cal.toString(),
    };
    mailOptions.subject = `[開會通知] ${meetingTime.getMonth() + 1}/${meetingTime.getDate()} (${convertToChineseDay(meetingTime.getDay())}) ${doc.subject}`;
    mailOptions.html = newMeetingNotice(docId, doc.subject, Array.from(new Set(names)).join('、'), senderName, meetingTime, doc.location);
  }
  await mailTransport.sendMail(mailOptions);
  return { success: true };
});

// Notify newly-granted collaborators by email. The message is a fixed system template (no
// caller-supplied content) to remove any injection/phishing surface, and recipients are limited
// to addresses that are actually granted on the document so this can't be used as an open relay.
export const notifyDocumentAccess = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const docId = request.data.docId as string;
  const emails = request.data.emails;
  if (!docId || !Array.isArray(emails) || emails.length === 0) {
    throw new HttpsError('invalid-argument', 'docId and a non-empty emails array are required.');
  }
  if (emails.length > 50) {
    throw new HttpsError('invalid-argument', 'Too many recipients in a single notification.');
  }
  const doc = (await db.collection('documents').doc(docId).get()).data();
  if (!doc) {
    throw new HttpsError('not-found', 'Document not found.');
  }

  // Only someone who can manage this document's collaborators (author or manager) may send access
  // notifications — mirrors the firestore.rules collaborator-list write gate.
  const callerEmail = request.auth.token.email as string | undefined;
  const callerRoles = (request.auth.token.roles as string[] | undefined) ?? [];
  const inList = (arr: unknown) => Array.isArray(arr) && !!callerEmail && arr.includes(callerEmail);
  const hasAnyRole = (arr: unknown) => Array.isArray(arr) && arr.some((r: string) => callerRoles.includes(r));
  const canManage =
    !doc.authorEmail ||
    doc.authorEmail === 'legacy' ||
    doc.authorEmail === callerEmail ||
    inList(doc.managerEmails) ||
    hasAnyRole(doc.managerRoles);
  if (!canManage) {
    throw new HttpsError('permission-denied', 'Not authorized to send access notifications for this document.');
  }

  // Restrict recipients to addresses actually granted access on the document, so a caller can't
  // use this endpoint to email arbitrary addresses.
  const granted = new Set<string>([
    ...((doc.viewerEmails as string[] | undefined) ?? []),
    ...((doc.editorEmails as string[] | undefined) ?? []),
    ...((doc.managerEmails as string[] | undefined) ?? []),
  ]);
  const targets = Array.from(new Set(emails as string[])).filter((e) => typeof e === 'string' && granted.has(e));
  if (targets.length === 0) {
    return { success: false, error: 'No notifiable grantees.' };
  }

  await mailTransport.sendMail({
    from: '建中班聯會法律與公文系統 <cksc77th@gmail.com>',
    bcc: targets, // bcc so recipients don't see each other's addresses
    subject: `[公文權限] 您已獲授「${doc.subject}」的存取權限`,
    html: accessGrantedMail(docId, doc.subject),
  } as MailOptions);
  logger.info('Document access notification sent', {
    actor: getActorInfo(request),
    docId,
    recipientCount: targets.length,
  });
  return { success: true, notified: targets.length };
});

// Look up Firebase Auth accounts by email for the collaborator picker. Returns ONLY whether each
// address has an account plus its display name and avatar URL — never uid, roles, or any other PII —
// so the collaborators dialog can (a) block granting access to an address with no account and
// (b) show each grantee's avatar. Auth is required; account existence is unavoidably disclosed since
// that is the feature's whole purpose, but nothing else is.
export const lookupUsersByEmail = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated.');
  }
  const raw = request.data?.emails;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpsError('invalid-argument', 'A non-empty emails array is required.');
  }
  if (raw.length > 100) {
    throw new HttpsError('invalid-argument', 'Too many emails in a single lookup.');
  }
  const emails = Array.from(
    new Set(
      raw
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  );
  const users: Record<string, { exists: boolean; displayName: string | null; photoURL: string | null }> = {};
  for (const e of emails) users[e] = { exists: false, displayName: null, photoURL: null };
  if (emails.length === 0) return { users };
  const found = await admin.auth().getUsers(emails.map((email) => ({ email })));
  for (const user of found.users) {
    const key = user.email?.toLowerCase();
    if (key && key in users) {
      users[key] = { exists: true, displayName: user.displayName ?? null, photoURL: user.photoURL ?? null };
    }
  }
  return { users };
});

// Server-side document ID (字號) allocation. The document confidentiality rules (correctly) forbid
// a client from listing the documents collection — an unconstrained list query would expose
// confidential, unpublished documents — so the next serial number is computed here with the Admin
// SDK (which bypasses rules) and ONLY the generated number string is returned, never any document
// data. Mirrors the previous client-side src/ts/utils.ts generateDocumentIdNumber logic.
export const generateDocumentId = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError('unauthenticated', 'Must be authenticated.');
  }
  const { fromSpecific, type } = (request.data ?? {}) as { fromSpecific?: string; type?: string };
  const specific = fromSpecific ? DocumentSpecificIdentity.VALUES[fromSpecific] : undefined;
  const docType = type ? DocumentType.VALUES[type] : undefined;
  if (!specific || !docType) {
    throw new HttpsError('invalid-argument', 'Unknown or missing fromSpecific/type.');
  }

  let r = getCurrentReign().replace('-', '');
  if (r.length === 3) {
    r = '0' + r;
  }
  const target = specific.shareIdWith ?? specific;
  let s = r + target.generic.code + target.code;
  const sharedFrom = [target.firebase];
  for (const i of Object.values(DocumentSpecificIdentity.VALUES)) {
    if (i.shareIdWith?.firebase === target.firebase) {
      sharedFrom.push(i.firebase);
    }
  }
  const lastDoc = await db
    .collection('documents')
    .where('fromSpecific', 'in', sharedFrom)
    .where('type', '==', docType.firebase)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const top = lastDoc.docs[0];
  if (top && (top.data().idNumber as string | undefined)?.startsWith(r)) {
    const lastDocIdNumber = parseInt(top.id.slice(-4));
    s += (lastDocIdNumber + 1).toString().padStart(4, '0');
  } else {
    s += '0001';
  }
  return { idNumber: s };
});

export const buildIdCache = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, 'Chairman');
  const documents = await db.collection('documents').get();
  const legislation = await db.collection('legislation').get();
  const docCache = {} as { [id: string]: number };
  const lawCache = {} as { [id: string]: number };
  for (const doc of documents.docs) {
    const data = doc.data();
    docCache[doc.id] = data.publishedAt?.toMillis() ?? data.createdAt.toMillis();
  }
  for (const law of legislation.docs) {
    const data = law.data();
    lawCache[law.id] = data.createdAt.toMillis();
  }
  await db.doc('settings/cache').set({
    documents: docCache,
    legislation: lawCache,
  });
  return { success: true };
});

export const sitemap = onRequest(globalFunctionOptions, async (request, response) => {
  response.header('Content-Type', 'application/xml');
  response.header('Content-Encoding', 'gzip');

  try {
    const smStream = new SitemapStream({ hostname: 'https://law.cksc.tw/' });
    const pipeline = smStream.pipe(createGzip());
    const cache = await db.doc('settings/cache').get();

    // pipe your entries or directly write them.
    smStream.write({ url: '/', priority: 1.0 });
    smStream.write({ url: '/legislation/', priority: 0.9 });
    smStream.write({ url: '/document/', priority: 0.8 });
    smStream.write({ url: '/document/judicial', priority: 0.7 });
    smStream.write({ url: '/document/judicial/lawsuit', priority: 0.7 });
    smStream.write({ url: '/document/judicial/resolution', priority: 0.7 });
    smStream.write({ url: '/about', priority: 0.5 });
    if (cache.data()) {
      for (const doc of Object.entries(cache.data()!.legislation ?? {})) {
        smStream.write({ url: `/legislation/${doc[0]}`, lastmod: new Date(doc[1] as number).toISOString(), priority: 0.6 });
      }
      for (const doc of Object.entries(cache.data()!.documents ?? {})) {
        smStream.write({ url: `/document/${doc[0]}`, lastmod: new Date(doc[1] as number).toISOString(), priority: 0.5 });
      }
    }
    /* or use
    Readable.from([{url: '/page-1'}...]).pipe(smStream)
    if you are looking to avoid writing your own loop.
    */

    // make sure to attach a write stream such as streamToPromise before ending
    smStream.end();
    // stream write the response
    pipeline.pipe(response).on('error', (e) => {
      throw e;
    });
  } catch (e) {
    console.error(e);
    response.status(500).end();
  }
});

// Notify IndexNow of a newly-published/updated public URL. Failures are swallowed so a
// flaky ping never blocks the cache write that triggered it.
function pingIndexNow(path: string): Promise<void> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: [encodeURI(`https://${INDEXNOW_HOST}${path}`)],
    });
    const req = https.request(
      'https://api.indexnow.org/indexnow',
      { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          logger.warn(`IndexNow ping failed (${res.statusCode}) for ${path}`);
        }
        res.resume(); // drain the response so the socket can be freed
        resolve();
      },
    );
    req.on('error', (e) => {
      logger.warn(`IndexNow ping error for ${path}: ${e.message}`);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

export const updateIdCache = onDocumentWritten({ ...globalFunctionOptions, document: '{type}/{docId}' }, async (event) => {
  const type = event.params.type;
  if (type !== 'documents' && type !== 'legislation') throw new HttpsError('not-found', 'Type not found.');
  const docId = utf8.decode(event.params.docId);
  let del = !event.data?.after.exists; // Check if it's a deletion
  if (type === 'documents' && !del && (!event.data?.after.data()!.published || event.data?.after.data()!.confidentiality !== 'Public'))
    // Reject non-public docs
    del = true;
  await db.doc('settings/cache').update(new FieldPath(type, docId), del ? FieldValue.delete() : new Date().valueOf());
  // Tell IndexNow about newly public/updated URLs (skip deletions / freshly-hidden docs).
  if (!del) {
    await pingIndexNow(type === 'documents' ? `/document/${docId}` : `/legislation/${docId}`);
  }
});
