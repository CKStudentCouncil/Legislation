import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { collection, doc, query, Timestamp, where } from 'firebase/firestore';
import type { Document, Legislation, MailingList } from './models';
import {
  convertContentFromFirebase,
  convertContentToFirebase,
  convertHistoryToFirebase,
  convertDocumentToFirebase,
  DocumentConfidentiality,
  DocumentSpecificIdentity,
  DocumentType,
  LegislationCategory,
  LegislationType,
} from './models';

// A stored document is whatever its author wrote — firestore.rules do not constrain its shape — so fromFirestore must not assume it. A throw
// here escapes DocumentSnapshot.data() and fails every list built from it, so one bad record would take down the whole page (and the SSR
// render of /document). Anything that is not the shape the Document interface promises degrades instead: arrays to [], dates to null,
// unregistered enum keys to undefined.
function toDate(value: any): Date | null {
  return typeof value?.toMillis === 'function' ? new Date(value.toMillis()) : null;
}

// Only registered keys resolve. VALUES[key] would stringify a non-string key (which throws for a stored map such as { toString: 1 }) and
// would reach Object.prototype for a key such as 'constructor', a native function that the SSR state serializer then refuses.
function lookup<T>(values: Record<string, T>, key: unknown): T | undefined {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
}

function lookupAll<T>(values: Record<string, T>, keys: unknown): (T | undefined)[] {
  return Array.isArray(keys) ? keys.map((key) => lookup(values, key)) : [];
}

export const documentConverter: FirestoreDataConverter<Document | null> = {
  toFirestore(docData: Document) {
    const data = firestoreDefaultConverter.toFirestore(convertDocumentToFirebase(docData) as any);
    delete data.getFullId;
    if (!data.location) delete data.location;
    if (!data.fromName) delete data.fromName;
    if (!data.secretarySpecific) delete data.secretarySpecific;
    if (!data.secretaryName) delete data.secretaryName;
    if (!data.published) delete data.publishedAt;
    if (!data.meetingTime) delete data.meetingTime;
    if (!data.prosecutionId) delete data.prosecutionId;
    if (!data.declassifyAt) delete data.declassifyAt;
    else data.declassifyAt = Timestamp.fromDate(data.declassifyAt) as any;
    if (!data.authorEmail) delete data.authorEmail;
    if (!data.viewerEmails?.length) delete data.viewerEmails;
    if (!data.editorRoles?.length) delete data.editorRoles;
    if (!data.editorEmails?.length) delete data.editorEmails;
    if (!data.managerRoles?.length) delete data.managerRoles;
    if (!data.managerEmails?.length) delete data.managerEmails;
    if (!data.lastEditedBy) delete data.lastEditedBy;
    if (!data.lastEditedAt) delete data.lastEditedAt;
    else data.lastEditedAt = Timestamp.fromDate(data.lastEditedAt) as any;
    return data;
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    // getFullId(), the list's row key and the page meta all concatenate these, and a stored map such as { toString: 1 } throws when stringified.
    for (const key of ['idPrefix', 'idNumber', 'subject']) {
      if (typeof data[key] === 'object' && data[key] !== null) data[key] = '';
    }
    // No Timestamp to convert: an epoch date keeps the record listable (and always a valid Date) rather than failing the query.
    data.createdAt = toDate(data.createdAt) ?? new Date(0);
    data.publishedAt = toDate(data.publishedAt);
    data.declassifyAt = toDate(data.declassifyAt);
    data.meetingTime = toDate(data.meetingTime);
    data.confidentiality = lookup(DocumentConfidentiality.VALUES, data.confidentiality);
    data.fromSpecific = lookup(DocumentSpecificIdentity.VALUES, data.fromSpecific);
    data.toSpecific = lookupAll(DocumentSpecificIdentity.VALUES, data.toSpecific);
    data.type = lookup(DocumentType.VALUES, data.type);
    data.ccSpecific = lookupAll(DocumentSpecificIdentity.VALUES, data.ccSpecific);
    data.viewers = lookupAll(DocumentSpecificIdentity.VALUES, data.viewers);
    data.viewerEmails = data.viewerEmails ?? [];
    data.editorRoles = data.editorRoles ?? [];
    data.editorEmails = data.editorEmails ?? [];
    data.managerRoles = data.managerRoles ?? [];
    data.managerEmails = data.managerEmails ?? [];
    data.lastEditedAt = toDate(data.lastEditedAt);
    data.secretarySpecific = data.secretarySpecific ? lookup(DocumentSpecificIdentity.VALUES, data.secretarySpecific) : null;
    data.getFullId = function () {
      return `${this.idPrefix}第${this.idNumber}號`;
    };
    return data as unknown as Document;
  },
};

export function documentsCollection() {
  return collection(useFirestore(), 'documents').withConverter(documentConverter);
}

export function useDocuments() {
  return useCollection(documentsCollection());
}

export function useSpecificDocument(id: string) {
  return useDocument(doc(documentsCollection(), id));
}

export function usePublicDocuments() {
  return useCollection(
    query(documentsCollection(), where('published', '==', true), where('confidentiality', '==', DocumentConfidentiality.Public.firebase)),
  );
}

export const legislationConverter: FirestoreDataConverter<Legislation | null> = {
  toFirestore(legislation: Legislation) {
    const data: any = {
      category: legislation.category.firebase,
      content: legislation.content.map(convertContentToFirebase).sort((a, b) => a.index - b.index),
      createdAt: Timestamp.fromDate(legislation.createdAt),
      name: legislation.name,
      history: legislation.history.map((history) => {
        const mapped = convertHistoryToFirebase(history);
        mapped.amendedAt = Timestamp.fromDate(mapped.amendedAt) as any;
        return mapped;
      }),
      addendum: legislation.addendum?.map((addendum) => {
        addendum.createdAt = Timestamp.fromDate(addendum.createdAt) as any;
        return addendum;
      }),
      attachments: legislation.attachments,
    };
    if (legislation.frozenBy) data.frozenBy = legislation.frozenBy;
    if (legislation.resolutionUrls?.length) {
      data.resolutionUrls = legislation.resolutionUrls;
    } else {
      delete data.resolutionUrls;
    }
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot: any): Legislation {
    const data = firestoreDefaultConverter.fromFirestore(snapshot) as any;
    if (!data) return data;
    data.category = LegislationCategory.VALUES[data.category as keyof typeof LegislationCategory.VALUES] as any;
    data.content = data.content.map(convertContentFromFirebase).sort((a: any, b: any) => a.index - b.index);
    data.createdAt = data.createdAt.toDate();
    data.type = LegislationType.VALUES[data.type as keyof typeof LegislationType.VALUES];
    data.history = data.history.map((history: any) => {
      history.amendedAt = history.amendedAt.toDate();
      history.totalAmendment = !!history.totalAmendment;
      return history;
    });
    data.addendum = data.addendum?.map((addendum: any) => {
      addendum.createdAt = addendum.createdAt.toDate();
      return addendum;
    });
    return data;
  },
};

export function legislationCollection() {
  return collection(useFirestore(), 'legislation').withConverter(legislationConverter);
}

export function legislationDocument(id: string) {
  return doc(legislationCollection(), id).withConverter(legislationConverter);
}

export function historyContentDocument(legislationId: string, contentDocId: string) {
  return doc(useFirestore(), 'legislation', legislationId, 'historyContent', contentDocId);
}

export function useLegislations() {
  return useCollection(legislationCollection());
}

export function useLegislation(id: string) {
  return useDocument(legislationDocument(id));
}

export const mailingListConverter: FirestoreDataConverter<MailingList | null> = {
  toFirestore(mailingList: MailingList) {
    const data: any = {
      main: mailingList.main.map((entry) => ({
        email: entry.email,
        roles: entry.roles.map((role) => role.firebase),
      })),
    };
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options) as any;
    if (!data) return null;
    data.main = data.main.map((entry: any) => ({
      email: entry.email,
      roles: entry.roles.map((identity: any) => DocumentSpecificIdentity.VALUES[identity]),
    }));
    return data as MailingList;
  },
};

export function settingsCollection() {
  return collection(useFirestore(), 'settings');
}

export function mailingListDoc() {
  return doc(settingsCollection(), 'mailingList').withConverter(mailingListConverter);
}

export function useMailingList() {
  return useDocument(mailingListDoc());
}
