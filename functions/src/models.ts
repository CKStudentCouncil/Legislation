export interface User {
  name: string;
  email: string;
  roles: string[];
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
  static ElectoralCommission = new DocumentSpecificIdentity(
    'ElectoralCommission',
    '選舉委員會',
    '選舉',
    '07',
    DocumentGeneralIdentity.ExecutiveDepartment,
    '選舉委員會主任委員',
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
    '01',
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
    '01',
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
    '審判長'
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
    StudentRightsDivision: DocumentSpecificIdentity.StudentRightsDivision,
    PublicRelationsDivision: DocumentSpecificIdentity.PublicRelationsDivision,
    ServiceDivision: DocumentSpecificIdentity.ServiceDivision,
    EventsDivision: DocumentSpecificIdentity.EventsDivision,
    DocumentationDivision: DocumentSpecificIdentity.DocumentationDivision,
    GeneralAffairsDivision: DocumentSpecificIdentity.GeneralAffairsDivision,
    ElectoralCommission: DocumentSpecificIdentity.ElectoralCommission,
    JudicialCommitteeChairman: DocumentSpecificIdentity.JudicialCommitteeChairman,
    JudicialCommitteeViceChairman: DocumentSpecificIdentity.JudicialCommitteeViceChairman,
    JudicialCommitteeMember: DocumentSpecificIdentity.JudicialCommitteeMember,
    JudicialCommittee: DocumentSpecificIdentity.JudicialCommittee,
    GeneralCourt: DocumentSpecificIdentity.GeneralCourt,
    ConstitutionalCourt: DocumentSpecificIdentity.ConstitutionalCourt,
    SupremeCourt: DocumentSpecificIdentity.SupremeCourt,
    ConstitutionalCensorCourt: DocumentSpecificIdentity.ConstitutionalCensorCourt,
    Other: DocumentSpecificIdentity.Other,
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
