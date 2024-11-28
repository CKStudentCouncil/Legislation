import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import { collection, doc, FirestoreDataConverter, query, Timestamp, where } from 'firebase/firestore';

const date = new Date();
export const timezoneOffset = date.getTimezoneOffset() * 60 * 1000; // -480

export interface Legislation {
  preface?: string;
  category: LegislationCategory;
  content: LegislationContent[];
  createdAt: Date;
  name: string;
  type: LegislationType;
  history: History[];
  addendum?: Addendum[];
  attachments?: Attachment[];
}

export interface Document {
  idNumber: string; //e.g. 07620000001，1.公文之文號,由十二碼組成,前三碼為屆次,第四碼為期間次,第五碼為部門碼,第六、七碼為機關碼,第八碼為該公文類型,後四碼為流水號。
  idPrefix: string; //e.g. 建班主公字
  reign: string; //e.g. 79-1
  subject: string;
  from: DocumentGeneralIdentity;
  fromSpecific: DocumentSpecificIdentity;
  to: DocumentGeneralIdentity[];
  toSpecific: DocumentSpecificIdentity[];
  toOther: string[];
  type: DocumentType;
  content: string;
  createdAt: Date;
  attachments: Attachment[];
  cc: DocumentGeneralIdentity[];
  ccSpecific: DocumentSpecificIdentity[];
  ccOther: string[];
  confidentiality: DocumentConfidentiality;
  read: string[];
  published: boolean;
  publishedAt?: Date;
}

export class DocumentConfidentiality {
  static Public = new DocumentConfidentiality('Public', '公開');
  static Confidential = new DocumentConfidentiality('Confidential', '保密');
  static VALUES = {
    Public: DocumentConfidentiality.Public,
    Confidential: DocumentConfidentiality.Confidential,
  };

  constructor(
    public firebase: string,
    public translation: string,
  ) {}
}

export class DocumentGeneralIdentity {
  static Chairman = new DocumentGeneralIdentity('Chairman', '主席', '建班主', '0');
  static ViceChairman = new DocumentGeneralIdentity('ViceChairman', '副主席', '建班副主', '4');
  static ExecutiveDepartment = new DocumentGeneralIdentity('ExecutiveDepartment', '行政部門', '建班政', '1');
  static StudentCouncil = new DocumentGeneralIdentity('StudentCouncil', '班代大會', '建班立', '2');
  static JudicialCommittee = new DocumentGeneralIdentity('JudicialCommittee', '評議委員會', '建班評', '3');
  static VALUES = {
    Chairman: DocumentGeneralIdentity.Chairman,
    ViceChairman: DocumentGeneralIdentity.ViceChairman,
    ExecutiveDepartment: DocumentGeneralIdentity.ExecutiveDepartment,
    StudentCouncil: DocumentGeneralIdentity.StudentCouncil,
    JudicialCommittee: DocumentGeneralIdentity.JudicialCommittee,
  };

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public code: string,
  ) {}
}

export class DocumentSpecificIdentity {
  static Chairman = new DocumentSpecificIdentity('Chairman', '主席', '', '00', DocumentGeneralIdentity.Chairman);
  static ViceChairman = new DocumentSpecificIdentity('ViceChairman', '副主席', '', '00', DocumentGeneralIdentity.ViceChairman);
  // Student Council
  static Speaker = new DocumentSpecificIdentity('Speaker', '議長', '議', '00', DocumentGeneralIdentity.StudentCouncil);
  static DeputySpeaker = new DocumentSpecificIdentity('DeputySpeaker', '副議長', '副議', '07', DocumentGeneralIdentity.StudentCouncil);
  static DisciplinaryCommittee = new DocumentSpecificIdentity(
    'DisciplinaryCommittee',
    '紀律委員會',
    '紀',
    '04',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static FinancialCommittee = new DocumentSpecificIdentity('FinancialComittee', '財政委員會', '財', '01', DocumentGeneralIdentity.StudentCouncil);
  static LegislationCommittee = new DocumentSpecificIdentity(
    'LegislationCommittee',
    '法制委員會',
    '法',
    '02',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static ExecutiveCommittee = new DocumentSpecificIdentity('ExecutiveCommittee', '行政委員會', '行', '06', DocumentGeneralIdentity.StudentCouncil);
  static InvestigationCommittee = new DocumentSpecificIdentity(
    'InvestigationCommittee',
    '調查委員會',
    '調',
    '03',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static ElectionSupervisionCommittee = new DocumentSpecificIdentity(
    'ElectionSupervisionCommittee',
    '選舉監督委員會',
    '選',
    '05',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static StudentCouncilRepresentative = new DocumentSpecificIdentity(
    'StudentCouncilRepresentative',
    '班級代表',
    '班代',
    '08',
    DocumentGeneralIdentity.StudentCouncil,
  );
  // Executive Department
  static StudentRightsDivision = new DocumentSpecificIdentity(
    'StudentRightsDivision',
    '學生權益股',
    '權',
    '01',
    DocumentGeneralIdentity.ExecutiveDepartment,
  );
  static PublicRelationsDivision = new DocumentSpecificIdentity(
    'PublicRelationsDivision',
    '公關股',
    '關',
    '02',
    DocumentGeneralIdentity.ExecutiveDepartment,
  );
  static ServiceDivision = new DocumentSpecificIdentity('ServiceDivision', '服務股', '服', '03', DocumentGeneralIdentity.ExecutiveDepartment);
  static EventsDivision = new DocumentSpecificIdentity('EventsDivision', '活動股', '活', '04', DocumentGeneralIdentity.ExecutiveDepartment);
  static DocumentationDivision = new DocumentSpecificIdentity(
    'DocumentationDivision',
    '文宣股',
    '文',
    '05',
    DocumentGeneralIdentity.ExecutiveDepartment,
  );
  static GeneralAffairsDivision = new DocumentSpecificIdentity(
    'GeneralAffairsDivision',
    '總務股',
    '總',
    '06',
    DocumentGeneralIdentity.ExecutiveDepartment,
  );
  static ElectoralCommission = new DocumentSpecificIdentity(
    'ElectoralCommission',
    '選舉委員會',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
  );
  // Judicial Committee
  static JudicialCommitteeChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeChairman',
    '評議委員會主任委員',
    '主',
    '00',
    DocumentGeneralIdentity.JudicialCommittee,
  );
  static JudicialCommitteeViceChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeViceChairman',
    '評議委員會副主任委員',
    '副',
    '00',
    DocumentGeneralIdentity.JudicialCommittee,
  );
  static OccupationalCourt = new DocumentSpecificIdentity('OccupationalCourt', '職務法庭', '職', '01', DocumentGeneralIdentity.JudicialCommittee);
  static JudicialCommitteeMember = new DocumentSpecificIdentity(
    'JudicialCommitteeMember',
    '評議委員',
    '評委',
    '02',
    DocumentGeneralIdentity.JudicialCommittee,
  );
  static Other = new DocumentSpecificIdentity('Other', '其他', '', '99', DocumentGeneralIdentity.StudentCouncil);
  static VALUES = {
    Chairman: DocumentSpecificIdentity.Chairman,
    ViceChairman: DocumentSpecificIdentity.ViceChairman,
    Speaker: DocumentSpecificIdentity.Speaker,
    DeputySpeaker: DocumentSpecificIdentity.DeputySpeaker,
    DisciplinaryCommittee: DocumentSpecificIdentity.DisciplinaryCommittee,
    FinancialCommittee: DocumentSpecificIdentity.FinancialCommittee,
    LegislationCommittee: DocumentSpecificIdentity.LegislationCommittee,
    ExecutiveCommittee: DocumentSpecificIdentity.ExecutiveCommittee,
    InvestigationCommittee: DocumentSpecificIdentity.InvestigationCommittee,
    ElectionSupervisionCommittee: DocumentSpecificIdentity.ElectionSupervisionCommittee,
    StudentCouncilRepresentative: DocumentSpecificIdentity.StudentCouncilRepresentative,
    StudentRightsDivision: DocumentSpecificIdentity.StudentRightsDivision,
    PublicRelationsDivision: DocumentSpecificIdentity.PublicRelationsDivision,
    ServiceDivision: DocumentSpecificIdentity.ServiceDivision,
    EventsDivision: DocumentSpecificIdentity.EventsDivision,
    DocumentationDivision: DocumentSpecificIdentity.DocumentationDivision,
    GeneralAffairsDivision: DocumentSpecificIdentity.GeneralAffairsDivision,
    ElectoralCommission: DocumentSpecificIdentity.ElectoralCommission,
    JudicialCommitteeChairman: DocumentSpecificIdentity.JudicialCommitteeChairman,
    JudicialCommitteeViceChairman: DocumentSpecificIdentity.JudicialCommitteeViceChairman,
    OccupationalCourt: DocumentSpecificIdentity.OccupationalCourt,
    JudicialCommitteeMember: DocumentSpecificIdentity.JudicialCommitteeMember,
    Other: DocumentSpecificIdentity.Other,
  };

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public code: string,
    public generic: DocumentGeneralIdentity,
  ) {}
}

export class DocumentType {
  static Announcement = new DocumentType('Announcement', '公告', '公', '2');
  static Order = new DocumentType('Order', '命令', '令', '0');
  static Advisory = new DocumentType('Advisory', '函', '函', '1');
  static Record = new DocumentType('Record', '會議記錄', '錄', '3');
  static MeetingNotice = new DocumentType('MeetingNotice', '開會通知', '通', '4');
  static VALUES = {
    Announcement: DocumentType.Announcement,
    Order: DocumentType.Order,
    Advisory: DocumentType.Advisory,
    Record: DocumentType.Record,
    MeetingNotice: DocumentType.MeetingNotice,
  };

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public code: string,
  ) {}
}

export function convertDocumentToFirebase(data: Document) {
  data.confidentiality = data.confidentiality.firebase as any;
  data.from = data.from.firebase as any;
  data.fromSpecific = data.fromSpecific.firebase as any;
  data.to = data.to.map((to) => to.firebase as any);
  data.toSpecific = data.toSpecific.map((toSpecific) => toSpecific.firebase as any);
  data.type = data.type.firebase as any;
  data.cc = data.cc.map((cc) => cc.firebase as any);
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
    data.confidentiality = DocumentConfidentiality.VALUES[data.confidentiality as keyof typeof DocumentConfidentiality.VALUES];
    data.from = DocumentGeneralIdentity.VALUES[data.from as keyof typeof DocumentGeneralIdentity.VALUES];
    data.fromSpecific = DocumentSpecificIdentity.VALUES[data.fromSpecific as keyof typeof DocumentSpecificIdentity.VALUES];
    data.to = data.to.map((to: any) => DocumentGeneralIdentity.VALUES[to as keyof typeof DocumentGeneralIdentity.VALUES]);
    data.toSpecific = data.toSpecific.map(
      (toSpecific: any) => DocumentSpecificIdentity.VALUES[toSpecific as keyof typeof DocumentSpecificIdentity.VALUES],
    );
    data.type = DocumentType.VALUES[data.type as keyof typeof DocumentType.VALUES];
    data.cc = data.cc.map((cc: any) => DocumentGeneralIdentity.VALUES[cc as keyof typeof DocumentGeneralIdentity.VALUES]);
    data.ccSpecific = data.ccSpecific.map(
      (ccSpecific: any) => DocumentSpecificIdentity.VALUES[ccSpecific as keyof typeof DocumentSpecificIdentity.VALUES],
    );
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
  data.type = data.type.firebase as any;
  return data;
}

export const legislationConverter: FirestoreDataConverter<Legislation | null> = {
  toFirestore(legislation: Legislation) {
    const data: any = {
      category: legislation.category.firebase,
      content: legislation.content.map(convertContentToFirebase).sort((a, b) => a.index - b.index),
      createdAt: Timestamp.fromMillis(legislation.createdAt.valueOf() - timezoneOffset),
      name: legislation.name,
      type: legislation.type.firebase,
      history: legislation.history.map((history) => {
        history.content = history.content?.map((content: any) => {
          content.type = content.type.firebase;
          return content;
        });
        history.amendedAt = Timestamp.fromMillis(history.amendedAt.valueOf() - timezoneOffset) as any;
        return history;
      }),
      addendum: legislation.addendum?.map((addendum) => {
        addendum.createdAt = Timestamp.fromMillis(addendum.createdAt.valueOf() - timezoneOffset) as any;
        return addendum;
      }),
      attachments: legislation.attachments,
    };
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot: any): Legislation {
    const data = firestoreDefaultConverter.fromFirestore(snapshot) as any;
    if (!data) return data;
    data.category = LegislationCategory.VALUES[data.category as keyof typeof LegislationCategory.VALUES] as any;
    data.content = data.content
      .map((content: any) => {
        content.type = ContentType.VALUES[content.type as keyof typeof ContentType.VALUES];
        return content;
      })
      .sort((a: any, b: any) => a.index - b.index);
    data.createdAt = data.createdAt.toDate();
    data.type = LegislationType.VALUES[data.type as keyof typeof LegislationType.VALUES];
    data.history = data.history.map((history: any) => {
      history.content = history.content?.map((content: any) => {
        content.type = ContentType[content.type as keyof typeof ContentType];
        return content;
      });
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
  deleted: boolean;
  subtitle: string;
  title: string;
  type: ContentType;
  index: number;
}

export class LegislationCategory {
  static Constitution = new LegislationCategory('Constitution', 'CO', '憲章', 'book');
  static Chairman = new LegislationCategory('Chairman', 'CH', '主席與副主席', 'settings_accessibility');
  static ExecutiveDepartment = new LegislationCategory('ExecutiveDepartment', 'ED', '行政部門', 'construction');
  static StudentCouncil = new LegislationCategory('StudentCouncil', 'SC', '班代大會', 'groups');
  static JudicialCommittee = new LegislationCategory('JudicialCommittee', 'JC', '評議委員會', 'gavel');
  static ExecutiveOrder = new LegislationCategory('ExecutiveOrder', 'EO', '行政命令', 'hardware');
  static StudentCouncilOrder = new LegislationCategory('StudentCouncilOrder', 'SCO', '班代大會命令', 'connect_without_contact');
  static JudicialCommitteeOrder = new LegislationCategory('JudicialCommitteeOrder', 'JCO', '評議委員會命令', 'local_police');
  static VotingCommitteeOrder = new LegislationCategory('VotingCommitteeOrder', 'VCO', '選舉委員會命令', 'how_to_vote');
  static VALUES = {
    Constitution: LegislationCategory.Constitution,
    Chairman: LegislationCategory.Chairman,
    ExecutiveDepartment: LegislationCategory.ExecutiveDepartment,
    StudentCouncil: LegislationCategory.StudentCouncil,
    JudicialCommittee: LegislationCategory.JudicialCommittee,
    ExecutiveOrder: LegislationCategory.ExecutiveOrder,
    StudentCouncilOrder: LegislationCategory.StudentCouncilOrder,
    JudicialCommitteeOrder: LegislationCategory.JudicialCommitteeOrder,
    VotingCommitteeOrder: LegislationCategory.VotingCommitteeOrder,
  };

  constructor(
    public firebase: string,
    public idPrefix: string,
    public translation: string,
    public icon: string,
  ) {}
}

export class LegislationType {
  static Constitution = new LegislationType('Constitution', '憲章');
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

export class ContentType {
  static Chapter = new ContentType('Chapter', '章', false);
  static Section = new ContentType('Section', '節', false);
  static Subsection = new ContentType('Subsection', '款', false);
  static Clause = new ContentType('Clause', '條', true);
  static Item = new ContentType('Item', '項', true);
  static VALUES = {
    Chapter: ContentType.Chapter,
    Section: ContentType.Section,
    Subsection: ContentType.Subsection,
    Clause: ContentType.Clause,
    Item: ContentType.Item,
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
