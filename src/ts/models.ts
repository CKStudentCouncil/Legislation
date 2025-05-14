import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { collection, doc, query, Timestamp, where } from 'firebase/firestore';

export interface Legislation {
  preface?: string;
  category: LegislationCategory;
  content: LegislationContent[];
  createdAt: Date;
  name: string;
  history: History[];
  addendum?: Addendum[];
  attachments?: Attachment[];
  frozenBy?: string;
}

export interface Document {
  idNumber: string; //e.g. 1140429001，民國年三碼+日期四碼+流水號三碼
  idPrefix: string; //e.g. 生會字
  reign: string; //e.g. 15
  subject: string;
  location?: string;
  fromSpecific: DocumentSpecificIdentity;
  fromName?: string;
  secretarySpecific?: DocumentSpecificIdentity;
  secretaryName?: string;
  toSpecific: DocumentSpecificIdentity[];
  toOther: string[];
  type: DocumentType;
  content: string;
  createdAt: Date;
  attachments: Attachment[];
  ccSpecific: DocumentSpecificIdentity[];
  ccOther: string[];
  confidentiality: DocumentConfidentiality;
  read: string[];
  published: boolean;
  publishedAt?: Date | null;
  meetingTime?: Date | null;
}

export interface MailingList {
  email: string;
  identities: DocumentSpecificIdentity[];
}

export class DocumentConfidentiality {
  static Public = new DocumentConfidentiality('Public', '公開');
  static Confidential = new DocumentConfidentiality('Confidential', '保密');
  static VALUES = {
    Public: DocumentConfidentiality.Public,
    Confidential: DocumentConfidentiality.Confidential,
  } as Record<string, DocumentConfidentiality>;

  constructor(
    public firebase: string,
    public translation: string,
  ) {}
}

export class DocumentGeneralIdentity {
  static Chairman = new DocumentGeneralIdentity('Chairman', '會長', '生會');
  static ViceChairman = new DocumentGeneralIdentity('ViceChairman', '副會長', '生會');
  static StudentAssociation = new DocumentGeneralIdentity('StudentAssociation', '學生會', '生會');
  static StudentCouncil = new DocumentGeneralIdentity('StudentCouncil', '學生議會', '議');
  static JudicialCommittee = new DocumentGeneralIdentity('JudicialCommittee', '評議委員會', '評');
  static VALUES = {
    Chairman: DocumentGeneralIdentity.Chairman,
    ViceChairman: DocumentGeneralIdentity.ViceChairman,
    StudentAssociation: DocumentGeneralIdentity.StudentAssociation,
    StudentCouncil: DocumentGeneralIdentity.StudentCouncil,
    JudicialCommittee: DocumentGeneralIdentity.JudicialCommittee,
  } as Record<string, DocumentGeneralIdentity>;

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
  ) {}
}

export class DocumentSpecificIdentity {
  static Chairman = new DocumentSpecificIdentity('Chairman', '主席', '', DocumentGeneralIdentity.Chairman);
  static ViceChairman = new DocumentSpecificIdentity('ViceChairman', '副主席', '', DocumentGeneralIdentity.ViceChairman);
  // Student Council
  static Speaker = new DocumentSpecificIdentity('Speaker', '議長', '', DocumentGeneralIdentity.StudentCouncil);
  static DeputySpeaker = new DocumentSpecificIdentity('DeputySpeaker', '副議長', '', DocumentGeneralIdentity.StudentCouncil);
  static StudentCouncil = new DocumentSpecificIdentity(
    'StudentCouncil',
    '學生議會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '議長',
    DocumentSpecificIdentity.Speaker,
  );
  static StudentCouncilHeadSecretary = new DocumentSpecificIdentity(
    'StudentCouncilHeadSecretary',
    '祕書長',
    '祕',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static StudentCouncilSecretary = new DocumentSpecificIdentity('StudentCouncilSecretary', '祕書處', '祕', DocumentGeneralIdentity.StudentCouncil);
  static RightsCommittee = new DocumentSpecificIdentity(
    'RightsCommittee',
    '權益及司法委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '權益及司法委員會召集委員',
  );
  static DocumentCommittee = new DocumentSpecificIdentity(
    'DocumentCommittee',
    '文務委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '文務委員會召集委員',
  );
  static FinancialCommittee = new DocumentSpecificIdentity(
    'FinancialCommittee',
    '財務委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '財務委員會召集委員',
  );
  static ExecutiveCommittee = new DocumentSpecificIdentity(
    'ExecutiveCommittee',
    '政法委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '政法委員會召集委員',
  );
  static AmendmentCommittee = new DocumentSpecificIdentity(
    'AmendmentCommittee',
    '修憲委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '修憲委員會召集委員',
  );
  static SupervisionCommittee = new DocumentSpecificIdentity(
    'SupervisionCommittee',
    '守法監視委員會',
    '',
    DocumentGeneralIdentity.StudentCouncil,
    '守法監視委員會召集委員',
  );
  static StudentCouncilRepresentative = new DocumentSpecificIdentity(
    'StudentCouncilRepresentative',
    '學生議員',
    '員',
    DocumentGeneralIdentity.StudentCouncil,
  );
  // Student Association
  static FinancialDepartment = new DocumentSpecificIdentity(
    'FinancialDepartment',
    '財務處',
    '',
    DocumentGeneralIdentity.StudentAssociation,
    '財務處長',
  );
  static EventsDepartment = new DocumentSpecificIdentity('EventsDepartment', '活動處', '', DocumentGeneralIdentity.StudentAssociation, '活動處長');
  static PublicRelationsDepartment = new DocumentSpecificIdentity(
    'PublicRelationsDepartment',
    '公關處',
    '',
    DocumentGeneralIdentity.StudentAssociation,
    '公關處長',
  );
  static DocumentationDepartment = new DocumentSpecificIdentity(
    'DocumentationDepartment',
    '美宣處',
    '',
    DocumentGeneralIdentity.StudentAssociation,
    '美宣處長',
  );
  static StudentRightsDepartment = new DocumentSpecificIdentity(
    'StudentRightsDepartment',
    '學權處',
    '',
    DocumentGeneralIdentity.StudentAssociation,
    '學權處長',
  );
  static GeneralAffairsDepartment = new DocumentSpecificIdentity(
    'GeneralAffairsDepartment',
    '機動處',
    '',
    DocumentGeneralIdentity.StudentAssociation,
    '機動處長',
  );
  static ElectoralCommission = new DocumentSpecificIdentity(
    'ElectoralCommission',
    '選舉委員會',
    '選舉',
    DocumentGeneralIdentity.StudentAssociation,
    '選舉委員會主任委員',
  );
  // Judicial Committee
  static JudicialCommitteeChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeChairman',
    '評議委員會主任委員',
    '',
    DocumentGeneralIdentity.JudicialCommittee,
  );
  static JudicialCommitteeViceChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeViceChairman',
    '評議委員會副主任委員',
    '',
    DocumentGeneralIdentity.JudicialCommittee,
    undefined,
    DocumentSpecificIdentity.JudicialCommitteeChairman,
  );
  static JudicialCommittee = new DocumentSpecificIdentity(
    'JudicialCommittee',
    '評議委員會',
    '',
    DocumentGeneralIdentity.JudicialCommittee,
    '評議委員會主任委員',
  );
  static JudicialCommitteeMember = new DocumentSpecificIdentity(
    'JudicialCommitteeMember',
    '評議委員',
    '',
    DocumentGeneralIdentity.JudicialCommittee,
    undefined,
    DocumentSpecificIdentity.JudicialCommitteeChairman,
  );
  static Other = new DocumentSpecificIdentity('Other', '其他', '', DocumentGeneralIdentity.StudentCouncil);
  static VALUES = {
    Chairman: DocumentSpecificIdentity.Chairman,
    ViceChairman: DocumentSpecificIdentity.ViceChairman,
    Speaker: DocumentSpecificIdentity.Speaker,
    DeputySpeaker: DocumentSpecificIdentity.DeputySpeaker,
    StudentCouncil: DocumentSpecificIdentity.StudentCouncil,
    StudentCouncilHeadSecretary: DocumentSpecificIdentity.StudentCouncilHeadSecretary,
    StudentCouncilSecretary: DocumentSpecificIdentity.StudentCouncilSecretary,
    RightsCommittee: DocumentSpecificIdentity.RightsCommittee,
    DocumentCommittee: DocumentSpecificIdentity.DocumentCommittee,
    FinancialCommittee: DocumentSpecificIdentity.FinancialCommittee,
    ExecutiveCommittee: DocumentSpecificIdentity.ExecutiveCommittee,
    AmendmentCommittee: DocumentSpecificIdentity.AmendmentCommittee,
    SupervisionCommittee: DocumentSpecificIdentity.SupervisionCommittee,
    StudentCouncilRepresentative: DocumentSpecificIdentity.StudentCouncilRepresentative,
    FinancialDepartment: DocumentSpecificIdentity.FinancialDepartment,
    EventsDepartment: DocumentSpecificIdentity.EventsDepartment,
    PublicRelationsDepartment: DocumentSpecificIdentity.PublicRelationsDepartment,
    DocumentationDepartment: DocumentSpecificIdentity.DocumentationDepartment,
    StudentRightsDepartment: DocumentSpecificIdentity.StudentRightsDepartment,
    GeneralAffairsDepartment: DocumentSpecificIdentity.GeneralAffairsDepartment,
    ElectoralCommission: DocumentSpecificIdentity.ElectoralCommission,
    JudicialCommitteeChairman: DocumentSpecificIdentity.JudicialCommitteeChairman,
    JudicialCommitteeViceChairman: DocumentSpecificIdentity.JudicialCommitteeViceChairman,
    JudicialCommittee: DocumentSpecificIdentity.JudicialCommittee,
    JudicialCommitteeMember: DocumentSpecificIdentity.JudicialCommitteeMember,
    Other: DocumentSpecificIdentity.Other,
  } as Record<string, DocumentSpecificIdentity>;

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public generic: DocumentGeneralIdentity,
    public signatureTitle?: string,
    public shareIdWith?: DocumentSpecificIdentity,
  ) {}
}

export class DocumentType {
  static Announcement = new DocumentType('Announcement', '公告', '佈');
  static Order = new DocumentType('Order', '命令', '令');
  static Advisory = new DocumentType('Advisory', '函', '');
  static Record = new DocumentType('Record', '會議記錄', '');
  static MeetingNotice = new DocumentType('MeetingNotice', '開會通知', '');
  static VALUES = {
    Announcement: DocumentType.Announcement,
    Order: DocumentType.Order,
    Advisory: DocumentType.Advisory,
    Record: DocumentType.Record,
    MeetingNotice: DocumentType.MeetingNotice,
  } as Record<string, DocumentType>;

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
  ) {}
}

export function convertDocumentToFirebase(data: Document) {
  data.confidentiality = data.confidentiality.firebase as any;
  data.fromSpecific = data.fromSpecific.firebase as any;
  data.toSpecific = data.toSpecific.map((toSpecific) => toSpecific.firebase as any);
  if (data.secretarySpecific) data.secretarySpecific = data.secretarySpecific.firebase as any;
  data.type = data.type.firebase as any;
  data.ccSpecific = data.ccSpecific.map((ccSpecific) => ccSpecific.firebase as any);
  return data;
}

export const documentConverter: FirestoreDataConverter<Document | null> = {
  toFirestore(data: Document) {
    return firestoreDefaultConverter.toFirestore(convertDocumentToFirebase(data) as any);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    data.createdAt = new Date(data.createdAt.toMillis());
    data.publishedAt = data.publishedAt ? new Date(data.publishedAt.toMillis()) : null;
    data.meetingTime = data.meetingTime ? new Date(data.meetingTime.toMillis()) : null;
    data.confidentiality = DocumentConfidentiality.VALUES[data.confidentiality as keyof typeof DocumentConfidentiality.VALUES];
    data.fromSpecific = DocumentSpecificIdentity.VALUES[data.fromSpecific];
    data.toSpecific = data.toSpecific.map((toSpecific: any) => DocumentSpecificIdentity.VALUES[toSpecific]);
    data.type = DocumentType.VALUES[data.type as keyof typeof DocumentType.VALUES];
    data.ccSpecific = data.ccSpecific.map((ccSpecific: any) => DocumentSpecificIdentity.VALUES[ccSpecific]);
    data.secretarySpecific = data.secretarySpecific ? DocumentSpecificIdentity.VALUES[data.secretarySpecific] : null;
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

export function convertContentToFirebase(data: LegislationContent) {
  const content = {
    content: data.content,
    subtitle: data.subtitle,
    title: data.title,
    type: data.type.firebase,
    index: data.index,
  } as any;
  if (data.deleted) content.deleted = data.deleted; // this saves storage space, as most content is not deleted
  if (data.frozenBy) content.frozenBy = data.frozenBy;
  return content;
}

export function convertContentFromFirebase(data: any) {
  const content = { ...data } as LegislationContent;
  content.type = ContentType.VALUES[data.type as keyof typeof ContentType.VALUES];
  content.deleted = !!data.deleted;
  return content;
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
        return history;
      }),
      addendum: legislation.addendum?.map((addendum) => {
        addendum.createdAt = Timestamp.fromDate(addendum.createdAt) as any;
        return addendum;
      }),
      attachments: legislation.attachments,
    };
    if (legislation.frozenBy) data.frozenBy = legislation.frozenBy; // To save storage space
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

export interface History {
  content?: LegislationContent[];
  brief: string;
  amendedAt: Date;
  link?: string;
}

export interface LegislationContent {
  content?: string; // null if type is ContentType.Chapter
  deleted: boolean; // null in firebase if not deleted
  frozenBy?: string; // null if not frozen
  subtitle: string;
  title: string;
  type: ContentType;
  index: number;
}

export class LegislationType {
  static Constitution = new LegislationType('Constitution', '組織章程');
  static Law = new LegislationType('Law', '法律');
  static Order = new LegislationType('Order', '命令');
  static VALUES = {
    Constitution: LegislationType.Constitution,
    Law: LegislationType.Law,
    Order: LegislationType.Order,
  };

  constructor(
    public firebase: string,
    public translation: string,
  ) {}
}

export class LegislationCategory {
  static Constitution = new LegislationCategory('Constitution', 'CO', '組織章程', 'book', LegislationType.Constitution);
  static Chairman = new LegislationCategory('Chairman', 'CH', '中央法', 'settings_accessibility');
  static StudentAssociation = new LegislationCategory('StudentAssociation', 'ED', '行政', 'construction');
  static StudentCouncil = new LegislationCategory('StudentCouncil', 'SC', '立法', 'groups');
  static JudicialCommittee = new LegislationCategory('JudicialCommittee', 'JC', '司法', 'gavel');
  static ExecutiveOrder = new LegislationCategory('ExecutiveOrder', 'EO', '行政命令', 'hardware', LegislationType.Order);
  static StudentCouncilOrder = new LegislationCategory(
    'StudentCouncilOrder',
    'SCO',
    '學生議會命令',
    'connect_without_contact',
    LegislationType.Order,
  );
  static JudicialCommitteeOrder = new LegislationCategory('JudicialCommitteeOrder', 'JCO', '評議委員會命令', 'local_police', LegislationType.Order);
  static VALUES = {
    Constitution: LegislationCategory.Constitution,
    Chairman: LegislationCategory.Chairman,
    StudentAssociation: LegislationCategory.StudentAssociation,
    StudentCouncil: LegislationCategory.StudentCouncil,
    JudicialCommittee: LegislationCategory.JudicialCommittee,
    ExecutiveOrder: LegislationCategory.ExecutiveOrder,
    StudentCouncilOrder: LegislationCategory.StudentCouncilOrder,
    JudicialCommitteeOrder: LegislationCategory.JudicialCommitteeOrder,
  };

  constructor(
    public firebase: string,
    public idPrefix: string,
    public translation: string,
    public icon: string,
    public type: LegislationType = LegislationType.Law,
  ) {}
}

export class ContentType {
  static Volume = new ContentType('Volume', '編', false);
  static Chapter = new ContentType('Chapter', '章', false);
  static Section = new ContentType('Section', '節', false);
  static Subsection = new ContentType('Subsection', '款', false);
  static Clause = new ContentType('Clause', '條', false);
  static SpecialClause = new ContentType('SpecialClause', '條', false);
  static VALUES = {
    Volume: ContentType.Volume,
    Chapter: ContentType.Chapter,
    Section: ContentType.Section,
    Subsection: ContentType.Subsection,
    Clause: ContentType.Clause,
    SpecialClause: ContentType.SpecialClause,
  };

  constructor(
    public firebase: string,
    public translation: string,
    public arabicOrdinal: boolean,
  ) {}
}

export interface Addendum {
  content: string[];
  createdAt: Date;
}

export interface Attachment {
  urls: string[];
  description: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
}

export interface MailingList {
  main: MailingListEntry[];
}

export interface MailingListEntry {
  email: string;
  roles: DocumentSpecificIdentity[];
}

export function convertMailingListEntryToFirebase(data: MailingListEntry) {
  return {
    email: data.email,
    roles: data.roles.map((role) => role.firebase),
  };
}

export const mailingListConverter: FirestoreDataConverter<MailingList | null> = {
  toFirestore(mailingList: MailingList) {
    const data: any = {
      main: mailingList.main.map(convertMailingListEntryToFirebase),
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
