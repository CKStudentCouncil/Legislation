export interface User {
  name: string;
  email: string;
  roles: string[];
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
