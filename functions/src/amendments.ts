/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { createTransport } from 'nodemailer';
import { MailOptions } from 'nodemailer/lib/smtp-pool';
import { DocumentSpecificIdentity, LegislationContent } from '../../src/ts/models';
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
    amendmentType: data.amendmentType,
    partialContent: data.partialContent || null,
    fullContent: data.fullContent || null,
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

    const mailOptions: MailOptions = {
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

    // Processing approval
    let newContent: LegislationContent[];

    if (reqData.amendmentType === 'full') {
      newContent = reqData.fullContent.map((c: any, i: number) => toFirebaseContent(c, i));
    } else {
      const isSequenceExport = reqData.partialContent.some((c: any) => c.status === 'unchanged');

      if (isSequenceExport) {
        newContent = [];
        for (const change of reqData.partialContent) {
          if (change.status === 'added') {
            newContent.push(change.current);
          } else if (change.status === 'unchanged') {
            const orig = legislationData.content.find((c: any) => c.index === change.originalIndex);
            if (orig) newContent.push(orig);
          } else if (change.status === 'modified') {
            const origIndex = change.originalIndex ?? change.originalContent?.index;
            const orig = legislationData.content.find((c: any) => c.index === origIndex);
            if (orig) newContent.push({ ...orig, ...change.current });
          } else if (change.status === 'deleted') {
            const origIndex = change.originalIndex ?? change.originalContent?.index;
            const orig = legislationData.content.find((c: any) => c.index === origIndex);
            if (orig) newContent.push({ ...orig, deleted: true });
          }
        }
      } else {
        newContent = JSON.parse(JSON.stringify(legislationData.content || [])) as LegislationContent[];

        for (const change of reqData.partialContent) {
          if (change.status === 'unchanged') continue;

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
    const docUrl = result.documentId ? `https://law.cksc.tw/document/${result.documentId}` : undefined;
    const legUrl = `https://law.cksc.tw/legislation/${reqData.legislationId}`;
    const mailOptions: MailOptions = {
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
