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
  static ExecutiveCommitteeConsultant = new DocumentSpecificIdentity(
    'ExecutiveCommitteeConsultant',
    '行政委員會諮詢委員',
    '行',
    '06',
    DocumentGeneralIdentity.StudentCouncil,
    undefined,
    DocumentSpecificIdentity.ExecutiveCommittee,
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
  static JudicialAssistance = new DocumentSpecificIdentity(
    'JudicialAssistance',
    '司法助理',
    '司助',
    '04',
    DocumentGeneralIdentity.JudicialCommittee,
    '司法助理',
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
    ExecutiveCommitteeConsultant: DocumentSpecificIdentity.ExecutiveCommitteeConsultant,
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
    JudicialAssistance: DocumentSpecificIdentity.JudicialAssistance,
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
