import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { collection, doc, query, Timestamp, where } from 'firebase/firestore';

export interface Legislation {
  preface?: string;
  category: LegislationCategory;
  content: LegislationContent[];
  createdAt: Date;
  name: string;
  history: LegislationHistory[];
  addendum?: Addendum[];
  attachments?: Attachment[];
  frozenBy?: string;
}

export interface Document {
  idNumber: string; //e.g. 07620000001，1.公文之文號,由十二碼組成,前三碼為屆次,第四碼為期間次,第五碼為部門碼,第六、七碼為機關碼,第八碼為該公文類型,後四碼為流水號。
  idPrefix: string; //e.g. 建班主公字
  reign: string; //e.g. 79-1
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
  prosecutionId?: string;

  getFullId(): string;
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
  static Chairman = new DocumentGeneralIdentity('Chairman', '主席', '建班主', '0');
  static ViceChairman = new DocumentGeneralIdentity('ViceChairman', '副主席', '建班副主', '4');
  static ExecutiveDepartment = new DocumentGeneralIdentity('ExecutiveDepartment', '行政部門', '建班政', '1');
  static StudentCouncil = new DocumentGeneralIdentity('StudentCouncil', '班代大會', '建班立', '2');
  static JudicialCommittee = new DocumentGeneralIdentity('JudicialCommittee', '評議委員會', '建班評', '3');
  static SpecialCommittee = new DocumentGeneralIdentity('SpecialCommittee', '特殊時期會務委員會', '建班特委', '4');
  static VALUES = {
    Chairman: DocumentGeneralIdentity.Chairman,
    ViceChairman: DocumentGeneralIdentity.ViceChairman,
    ExecutiveDepartment: DocumentGeneralIdentity.ExecutiveDepartment,
    StudentCouncil: DocumentGeneralIdentity.StudentCouncil,
    JudicialCommittee: DocumentGeneralIdentity.JudicialCommittee,
    SpecialCommittee: DocumentGeneralIdentity.SpecialCommittee,
  } as Record<string, DocumentGeneralIdentity>;

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
  static StudentCouncil = new DocumentSpecificIdentity('StudentCouncil', '班代大會', '', '10', DocumentGeneralIdentity.StudentCouncil, '議長');
  static StudentCouncilSecretary = new DocumentSpecificIdentity(
    'StudentCouncilSecretary',
    '班代大會秘書',
    '秘',
    '09',
    DocumentGeneralIdentity.StudentCouncil,
  );
  static DisciplinaryCommittee = new DocumentSpecificIdentity(
    'DisciplinaryCommittee',
    '紀律委員會',
    '紀',
    '04',
    DocumentGeneralIdentity.StudentCouncil,
    '紀律委員會召集委員',
  );
  static FinancialCommittee = new DocumentSpecificIdentity(
    'FinancialCommittee',
    '財政委員會',
    '財',
    '01',
    DocumentGeneralIdentity.StudentCouncil,
    '財政委員會召集委員',
  );
  static LegislationCommittee = new DocumentSpecificIdentity(
    'LegislationCommittee',
    '法制委員會',
    '法',
    '02',
    DocumentGeneralIdentity.StudentCouncil,
    '法制委員會召集委員',
  );
  static ExecutiveCommittee = new DocumentSpecificIdentity(
    'ExecutiveCommittee',
    '行政委員會',
    '行',
    '06',
    DocumentGeneralIdentity.StudentCouncil,
    '行政委員會召集委員',
  );
  static InvestigationCommittee = new DocumentSpecificIdentity(
    'InvestigationCommittee',
    '調查委員會',
    '調',
    '03',
    DocumentGeneralIdentity.StudentCouncil,
    '調查委員會召集委員',
  );
  static ElectionSupervisionCommittee = new DocumentSpecificIdentity(
    'ElectionSupervisionCommittee',
    '選舉監督委員會',
    '選',
    '05',
    DocumentGeneralIdentity.StudentCouncil,
    '選舉監督委員會召集委員',
  );
  static StudentCouncilRepresentative = new DocumentSpecificIdentity(
    'StudentCouncilRepresentative',
    '班級代表',
    '班代',
    '08',
    DocumentGeneralIdentity.StudentCouncil,
  );
  // Executive Department
  static ExecutiveDepartment = new DocumentSpecificIdentity(
    'ExecutiveDepartment',
    '行政部門',
    '行',
    '00',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '主席',
  );
  static StudentRightsDivision = new DocumentSpecificIdentity(
    'StudentRightsDivision',
    '學生權益股',
    '權',
    '01',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '學生權益股股長',
  );
  static PublicRelationsDivision = new DocumentSpecificIdentity(
    'PublicRelationsDivision',
    '公共關係股',
    '關',
    '02',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '公共關係股股長',
  );
  static ServiceDivision = new DocumentSpecificIdentity(
    'ServiceDivision',
    '服務股',
    '服',
    '03',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '服務股股長',
  );
  static EventsDivision = new DocumentSpecificIdentity(
    'EventsDivision',
    '活動股',
    '活',
    '04',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '活動股股長',
  );
  static DocumentationDivision = new DocumentSpecificIdentity(
    'DocumentationDivision',
    '文宣股',
    '文',
    '05',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '文宣股股長',
  );
  static GeneralAffairsDivision = new DocumentSpecificIdentity(
    'GeneralAffairsDivision',
    '總務股',
    '總',
    '06',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '總務股股長',
  );
  static InfoTechDivision = new DocumentSpecificIdentity(
    'InfoTechDivision',
    '資訊股',
    '資',
    '08',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '資訊股股長',
  );
  static ExecutiveSecretary = new DocumentSpecificIdentity(
    'ExecutiveSecretary',
    '行政祕書',
    '行秘',
    '09',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '行政祕書',
  );
  static ElectoralCommission = new DocumentSpecificIdentity(
    'ElectoralCommission',
    '選舉委員會',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '選舉委員會主任委員',
  );
  static ElectoralCommitteeChairman = new DocumentSpecificIdentity(
    'ElectoralCommitteeChairman',
    '選舉委員會主任委員',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
    undefined,
    DocumentSpecificIdentity.ElectoralCommission,
  );
  static ElectoralCommitteeViceChairman = new DocumentSpecificIdentity(
    'ElectoralCommitteeViceChairman',
    '選舉委員會副主任委員',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
    undefined,
    DocumentSpecificIdentity.ElectoralCommission,
  );
  static ElectoralCommitteeMember = new DocumentSpecificIdentity(
    'ElectoralCommitteeMember',
    '選舉委員',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
    undefined,
    DocumentSpecificIdentity.ElectoralCommission,
  );
  // Judicial Committee
  static JudicialCommitteeChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeChairman',
    '評議委員會主任委員',
    '',
    '01',
    DocumentGeneralIdentity.JudicialCommittee,
  );
  static JudicialCommitteeViceChairman = new DocumentSpecificIdentity(
    'JudicialCommitteeViceChairman',
    '評議委員會副主任委員',
    '',
    '02',
    DocumentGeneralIdentity.JudicialCommittee,
    undefined,
    DocumentSpecificIdentity.JudicialCommitteeChairman,
  );
  static JudicialCommittee = new DocumentSpecificIdentity(
    'JudicialCommittee',
    '評議委員會',
    '',
    '00',
    DocumentGeneralIdentity.JudicialCommittee,
    '評議委員會主任委員',
  );
  static JudicialCommitteeMember = new DocumentSpecificIdentity(
    'JudicialCommitteeMember',
    '評議委員',
    '',
    '03',
    DocumentGeneralIdentity.JudicialCommittee,
    undefined,
    DocumentSpecificIdentity.JudicialCommitteeChairman,
  );
  static GeneralCourt = new DocumentSpecificIdentity('GeneralCourt', '一般法庭', '政', '02', DocumentGeneralIdentity.JudicialCommittee, '審判長');
  static ConstitutionalCourt = new DocumentSpecificIdentity(
    'ConstitutionalCourt',
    '憲章法庭',
    '憲',
    '03',
    DocumentGeneralIdentity.JudicialCommittee,
    '審判長',
  );
  static SupremeCourt = new DocumentSpecificIdentity('SupremeCourt', '大法庭', '大', '04', DocumentGeneralIdentity.JudicialCommittee, '審判長');
  static ConstitutionalCensorCourt = new DocumentSpecificIdentity(
    'ConstitutionalCensorCourt',
    '審查庭',
    '審',
    '05',
    DocumentGeneralIdentity.JudicialCommittee,
    '審查委員',
  );
  // specialCommittee
  static SpecialCommittee = new DocumentSpecificIdentity(
    'SpecialCommittee',
    '特殊時期會務委員會',
    '特委',
    '00',
    DocumentGeneralIdentity.SpecialCommittee,
    '特殊時期會務委員會主任委員',
  );
  static SpecialCommitteeChairman = new DocumentSpecificIdentity(
    'SpecialCommitteeChairman',
    '特殊時期會務委員會主任委員',
    '特委主',
    '01',
    DocumentGeneralIdentity.SpecialCommittee,
  );
  static SpecialCommitteeExecutiveViceChairman = new DocumentSpecificIdentity(
    'SpecialCommitteeExecutiveViceChairman',
    '特殊時期會務委員會行政副主任委員',
    '特委行副',
    '02',
    DocumentGeneralIdentity.SpecialCommittee,
  );
  static SpecialCommitteeLegislativeViceChairman = new DocumentSpecificIdentity(
    'SpecialCommitteeLegislativeViceChairman',
    '特殊時期會務委員會立法副主任委員',
    '特委立副',
    '03',
    DocumentGeneralIdentity.SpecialCommittee,
  );
  static SpecialCommitteeJudicialViceChairman = new DocumentSpecificIdentity(
    'SpecialCommitteeJudicialViceChairman',
    '特殊時期會務委員會司法副主任委員',
    '特委司副',
    '04',
    DocumentGeneralIdentity.SpecialCommittee,
  );

  static Other = new DocumentSpecificIdentity('Other', '其他', '', '99', DocumentGeneralIdentity.StudentCouncil);
  static VALUES = {
    Chairman: DocumentSpecificIdentity.Chairman,
    ViceChairman: DocumentSpecificIdentity.ViceChairman,
    Speaker: DocumentSpecificIdentity.Speaker,
    DeputySpeaker: DocumentSpecificIdentity.DeputySpeaker,
    StudentCouncil: DocumentSpecificIdentity.StudentCouncil,
    StudentCouncilSecretary: DocumentSpecificIdentity.StudentCouncilSecretary,
    DisciplinaryCommittee: DocumentSpecificIdentity.DisciplinaryCommittee,
    FinancialCommittee: DocumentSpecificIdentity.FinancialCommittee,
    LegislationCommittee: DocumentSpecificIdentity.LegislationCommittee,
    ExecutiveCommittee: DocumentSpecificIdentity.ExecutiveCommittee,
    InvestigationCommittee: DocumentSpecificIdentity.InvestigationCommittee,
    ElectionSupervisionCommittee: DocumentSpecificIdentity.ElectionSupervisionCommittee,
    StudentCouncilRepresentative: DocumentSpecificIdentity.StudentCouncilRepresentative,
    ExecutiveDepartment: DocumentSpecificIdentity.ExecutiveDepartment,
    StudentRightsDivision: DocumentSpecificIdentity.StudentRightsDivision,
    PublicRelationsDivision: DocumentSpecificIdentity.PublicRelationsDivision,
    ServiceDivision: DocumentSpecificIdentity.ServiceDivision,
    EventsDivision: DocumentSpecificIdentity.EventsDivision,
    DocumentationDivision: DocumentSpecificIdentity.DocumentationDivision,
    GeneralAffairsDivision: DocumentSpecificIdentity.GeneralAffairsDivision,
    InfoTechDivision: DocumentSpecificIdentity.InfoTechDivision,
    ExecutiveSecretary: DocumentSpecificIdentity.ExecutiveSecretary,
    ElectoralCommission: DocumentSpecificIdentity.ElectoralCommission,
    ElectoralCommitteeChairman: DocumentSpecificIdentity.ElectoralCommitteeChairman,
    ElectoralCommitteeViceChairman: DocumentSpecificIdentity.ElectoralCommitteeViceChairman,
    ElectoralCommitteeMember: DocumentSpecificIdentity.ElectoralCommitteeMember,
    JudicialCommitteeChairman: DocumentSpecificIdentity.JudicialCommitteeChairman,
    JudicialCommitteeViceChairman: DocumentSpecificIdentity.JudicialCommitteeViceChairman,
    JudicialCommitteeMember: DocumentSpecificIdentity.JudicialCommitteeMember,
    JudicialCommittee: DocumentSpecificIdentity.JudicialCommittee,
    GeneralCourt: DocumentSpecificIdentity.GeneralCourt,
    ConstitutionalCourt: DocumentSpecificIdentity.ConstitutionalCourt,
    SupremeCourt: DocumentSpecificIdentity.SupremeCourt,
    ConstitutionalCensorCourt: DocumentSpecificIdentity.ConstitutionalCensorCourt,
    Other: DocumentSpecificIdentity.Other,
    SpecialCommittee: DocumentSpecificIdentity.SpecialCommittee,
    SpecialCommitteeChairman: DocumentSpecificIdentity.SpecialCommitteeChairman,
    SpecialCommitteeExecutiveViceChairman: DocumentSpecificIdentity.SpecialCommitteeExecutiveViceChairman,
    SpecialCommitteeLegislativeViceChairman: DocumentSpecificIdentity.SpecialCommitteeLegislativeViceChairman,
    SpecialCommitteeJudicialViceChairman: DocumentSpecificIdentity.SpecialCommitteeJudicialViceChairman,
  } as Record<string, DocumentSpecificIdentity>;

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public code: string,
    public generic: DocumentGeneralIdentity,
    public signatureTitle?: string,
    public shareIdWith?: DocumentSpecificIdentity,
  ) {}
}

export class DocumentType {
  static Announcement = new DocumentType('Announcement', '公告', '公', '2');
  static Order = new DocumentType('Order', '命令', '令', '0');
  static Advisory = new DocumentType('Advisory', '函', '函', '1');
  static Message = new DocumentType('Message', '咨', '咨', '6');
  static Record = new DocumentType('Record', '會議記錄', '錄', '3');
  static MeetingNotice = new DocumentType('MeetingNotice', '開會通知', '通', '4');
  // Judicial Committee only
  // Prefix JudicialCommittee: customizable ID, rendered with DocumentJudicialCommittee.vue
  static JudicialCommitteeDecision = new DocumentType('JudicialCommitteeDecision', '評議委員會決議', '決', '', true, 'balance');
  static JudicialCommitteeExplanation = new DocumentType('JudicialCommitteeExplanation', '評議委員會釋字', '釋', '', true, 'assured_workload');
  // Prefix Court: rendered with DocumentCourt.vue
  static CourtIndictment = new DocumentType('CourtIndictment', '起訴書', '訴', '5', false, 'edit_note');
  static CourtVerdict = new DocumentType('CourtVerdict', '裁判書', '判', '5', true, 'gavel');
  static CourtNotification = new DocumentType('CourtNotification', '法庭文書-通', '通', '5', true, 'notifications');
  static CourtDocuments = new DocumentType('CourtDocuments', '法庭文書-文', '文', '5', true, 'description');
  static CourtScrolls = new DocumentType('CourtScrolls', '法庭文書-卷', '卷', '5', true, 'receipt_long');
  static CourtAppeals = new DocumentType('CourtAppeals', '法庭文書-上', '上', '5', true, 'campaign');
  static CourtProsecutions = new DocumentType('CourtProsecutions', '法庭文書-啟', '啟', '5', true, 'flag');
  static VALUES = {
    Announcement: DocumentType.Announcement,
    Order: DocumentType.Order,
    Advisory: DocumentType.Advisory,
    Message: DocumentType.Message,
    Record: DocumentType.Record,
    MeetingNotice: DocumentType.MeetingNotice,
    JudicialCommitteeDecision: DocumentType.JudicialCommitteeDecision,
    JudicialCommitteeExplanation: DocumentType.JudicialCommitteeExplanation,
    CourtIndictment: DocumentType.CourtIndictment,
    CourtVerdict: DocumentType.CourtVerdict,
    CourtNotification: DocumentType.CourtNotification,
    CourtDocuments: DocumentType.CourtDocuments,
    CourtScrolls: DocumentType.CourtScrolls,
    CourtAppeals: DocumentType.CourtAppeals,
    CourtProsecutions: DocumentType.CourtProsecutions,
  } as Record<string, DocumentType>;

  constructor(
    public firebase: string,
    public translation: string,
    public prefix: string,
    public code: string,
    public judicialCommitteeOnly: boolean = false,
    public icon?: string,
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
  toFirestore(doc: Document) {
    const data = firestoreDefaultConverter.toFirestore(convertDocumentToFirebase(doc) as any);
    delete data.getFullId;
    if (!data.location) delete data.location;
    if (!data.fromName) delete data.fromName;
    if (!data.secretarySpecific) delete data.secretarySpecific;
    if (!data.secretaryName) delete data.secretaryName;
    if (!data.published) delete data.publishedAt;
    if (!data.meetingTime) delete data.meetingTime;
    if (!data.prosecutionId) delete data.prosecutionId;
    return data;
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
        if (!history.totalAmendment) delete history.totalAmendment;
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

export interface LegislationHistory {
  content?: LegislationContent[];
  brief: string;
  amendedAt: Date;
  link?: string;
  totalAmendment?: boolean;
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

export class LegislationCategory {
  static Constitution = new LegislationCategory('Constitution', 'CO', '憲章', 'book', LegislationType.Constitution);
  static Chairman = new LegislationCategory('Chairman', 'CH', '主席與副主席', 'settings_accessibility');
  static ExecutiveDepartment = new LegislationCategory('ExecutiveDepartment', 'ED', '行政部門', 'construction');
  static StudentCouncil = new LegislationCategory('StudentCouncil', 'SC', '班代大會', 'groups');
  static JudicialCommittee = new LegislationCategory('JudicialCommittee', 'JC', '評議委員會', 'gavel');
  static ExecutiveOrder = new LegislationCategory('ExecutiveOrder', 'EO', '行政命令', 'hardware', LegislationType.Order);
  static StudentCouncilOrder = new LegislationCategory(
    'StudentCouncilOrder',
    'SCO',
    '班代大會命令',
    'connect_without_contact',
    LegislationType.Order,
  );
  static JudicialCommitteeOrder = new LegislationCategory('JudicialCommitteeOrder', 'JCO', '評議委員會命令', 'local_police', LegislationType.Order);
  static VotingCommitteeOrder = new LegislationCategory('VotingCommitteeOrder', 'VCO', '選舉委員會命令', 'how_to_vote', LegislationType.Order);
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
    public type: LegislationType = LegislationType.Law,
  ) {}
}

export class ContentType {
  static Volume = new ContentType('Volume', '編', false);
  static Chapter = new ContentType('Chapter', '章', false);
  static Section = new ContentType('Section', '節', false);
  static Subsection = new ContentType('Subsection', '款', false);
  static Clause = new ContentType('Clause', '條', true);
  static SpecialClause = new ContentType('SpecialClause', '條', true);
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
