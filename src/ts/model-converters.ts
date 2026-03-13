import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { collection, doc, query, Timestamp, where } from 'firebase/firestore';
import type { Document, Legislation, MailingList } from './models';
import {
  convertContentFromFirebase,
  convertContentToFirebase,
  convertDocumentToFirebase,
  DocumentConfidentiality,
  DocumentSpecificIdentity,
  DocumentType,
  LegislationCategory,
  LegislationType,
} from './models';

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
    return data;
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    data.createdAt = new Date(data.createdAt.toMillis());
    data.publishedAt = data.publishedAt ? new Date(data.publishedAt.toMillis()) : null;
    data.declassifyAt = data.declassifyAt ? new Date(data.declassifyAt.toMillis()) : null;
    data.meetingTime = data.meetingTime ? new Date(data.meetingTime.toMillis()) : null;
    data.confidentiality = DocumentConfidentiality.VALUES[data.confidentiality as keyof typeof DocumentConfidentiality.VALUES];
    data.fromSpecific = DocumentSpecificIdentity.VALUES[data.fromSpecific];
    data.toSpecific = data.toSpecific.map((toSpecific: any) => DocumentSpecificIdentity.VALUES[toSpecific]);
    data.type = DocumentType.VALUES[data.type as keyof typeof DocumentType.VALUES];
    data.ccSpecific = data.ccSpecific.map((ccSpecific: any) => DocumentSpecificIdentity.VALUES[ccSpecific]);
    data.viewers = data.viewers ? data.viewers.map((viewer: any) => DocumentSpecificIdentity.VALUES[viewer]) : [];
    data.secretarySpecific = data.secretarySpecific ? DocumentSpecificIdentity.VALUES[data.secretarySpecific] : null;
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
        history.content?.map(convertContentToFirebase).sort((a, b) => a.index - b.index);
        history.amendedAt = Timestamp.fromDate(history.amendedAt) as any;
        if (!history.totalAmendment) delete history.totalAmendment;
        return history;
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
      history.content = history.content?.map(convertContentFromFirebase);
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
