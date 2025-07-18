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
import { HttpsError, onCall, onRequest } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import { drive_v3, google } from 'googleapis';
import * as Stream from 'stream';
import { addUserWithRole, checkRole, editUserClaims } from './auth';
import { DocumentSpecificIdentity, User } from './models';
import { createTransport } from 'nodemailer';
import { convertToChineseDay, getCurrentReign } from './utils';
import { newDocMail } from './mail/new-doc';
import { MailOptions } from 'nodemailer/lib/smtp-pool';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { newMeetingNotice } from './mail/new-meeting-notice';
import { SitemapStream } from 'sitemap';
import { createGzip } from 'zlib';
import * as utf8 from 'utf8';

const globalFunctionOptions = { region: 'asia-east1' };
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

export const addUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, 'Chairman');
  const user = request.data as User;
  await addUserWithRole(user);
  return { success: true };
});

export const deleteUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, 'Chairman');
  await admin.auth().deleteUser(request.data.uid);
  return { success: true };
});

export const editUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, 'Chairman');
  await editUserClaims(request.data.uid, request.data.claims);
  return { success: true };
});

export const getAllUsers = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, 'Chairman');
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
    let folder: string | null | undefined = null;
    if ((folderQuery.data.files?.length ?? 0) == 0) {
      folder = (
        await driveAPI.files.create({
          requestBody: {
            name: getCurrentReign(),
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['1zNk5v8ZHJwAbDXCO_GswQoeY_CBCpb7m'],
          },
          fields: 'id',
        })
      ).data.id;
    } else {
      folder = folderQuery.data.files?.[0].id;
    }
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
    const roles = user.customClaims?.roles;
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
        email: senderMail,
        mailto: senderMail,
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
  })
  return { success: true };
});

export const sitemap = onRequest(globalFunctionOptions, async (request, response) => {
  response.header('Content-Type', 'application/xml');
  response.header('Content-Encoding', 'gzip');

  try {
    const smStream = new SitemapStream({ hostname: 'https://law.cksc.tw/' })
    const pipeline = smStream.pipe(createGzip())
    const cache = await db.doc('settings/cache').get();

    // pipe your entries or directly write them.
    smStream.write({ url: '/', priority: 1.0 })
    smStream.write({ url: '/legislation/', priority: 0.9 })
    smStream.write({ url: '/document/', priority: 0.8 })
    smStream.write({ url: '/document/judicial', priority: 0.7 })
    smStream.write({ url: '/document/judicial/lawsuit', priority: 0.7 })
    if (cache.data()) {
      for (const doc of Object.entries(cache.data()!.legislation ?? {})) {
        smStream.write({ url: `/legislation/${doc[0]}`, lastmod: new Date(doc[1] as number).toISOString(), priority: 0.6 })
      }
      for (const doc of Object.entries(cache.data()!.documents ?? {})) {
        smStream.write({ url: `/document/${doc[0]}`, lastmod: new Date(doc[1] as number).toISOString(), priority: 0.5 })
      }
    }
    /* or use
    Readable.from([{url: '/page-1'}...]).pipe(smStream)
    if you are looking to avoid writing your own loop.
    */

    // make sure to attach a write stream such as streamToPromise before ending
    smStream.end()
    // stream write the response
    pipeline.pipe(response).on('error', (e) => {throw e})
  } catch (e) {
    console.error(e)
    response.status(500).end()
  }
});

export const updateIdCache = onDocumentWritten(
  { ...globalFunctionOptions, document: '{type}/{docId}', },
  async (event) => {
    const type = event.params.type;
    if (type !== 'documents' && type !== 'legislation') throw new HttpsError('not-found', 'Type not found.');
    const docId = utf8.decode(event.params.docId);
    let del = !event.data?.after.exists; // Check if it's a deletion
    if (type === 'documents' && !del &&
      (!event.data?.after.data()!.published || event.data?.after.data()!.confidentiality !== 'Public')) // Reject non-public docs
      del = true;
    await db.doc('settings/cache').update(new FieldPath(type, docId), del ? FieldValue.delete() : new Date().valueOf());
  },
);
