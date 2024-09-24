import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import { collection, Timestamp, doc, FirestoreDataConverter } from 'firebase/firestore';

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
    };
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot: any): Legislation {
    const data = firestoreDefaultConverter.fromFirestore(snapshot) as any;
    if (!data) return data;
    data.category = LegislationCategory.VALUES[data.category as keyof typeof LegislationCategory.VALUES] as any;
    data.content = data.content.map((content: any) => {
      content.type = ContentType.VALUES[content.type as keyof typeof ContentType.VALUES];
      return content;
    }).sort((a: any, b: any) => a.index - b.index);
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
