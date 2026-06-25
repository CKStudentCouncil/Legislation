import { acceptHMRUpdate, defineStore } from 'pinia';
import type * as models from 'src/ts/models.ts';
import { DocumentConfidentiality } from 'src/ts/models.ts';
import { getCurrentReign } from 'src/ts/shared-utils.ts';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { and, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

/**
 * Re-attach the `getFullId` method and turn serialized date strings back into `Date`s.
 * Methods can't survive Firestore <-> Pinia (SSR) serialization, so every getter that
 * hands a Document to the UI must run this first (mirrors the model converter's intent).
 */
function rehydrate(d: models.Document): models.Document {
  d.createdAt = new Date(d.createdAt);
  d.publishedAt = d.publishedAt ? new Date(d.publishedAt) : null;
  d.meetingTime = d.meetingTime ? new Date(d.meetingTime) : null;
  d.getFullId = function () {
    return `${this.idPrefix}第${this.idNumber}號`;
  };
  return d;
}

export const useDocumentStore = defineStore('document', {
  state: () => ({
    document: {} as Record<string, models.Document>,
    // First page of public, published documents, SSR-rendered as the visible list on /document.
    publicList: [] as models.Document[],
    // Total count matching the default public query (the "共 N 件" figure).
    publicListTotal: 0,
    // Per-prosecution document threads for SSR-rendered judicial lawsuit pages.
    lawsuits: {} as Record<string, models.Document[]>,
  }),
  getters: {
    getDocument: (state) => {
      return (document: string): models.Document | null => {
        if (state.document[document]) {
          return rehydrate(state.document[document]);
        }
        return null;
      };
    },
    getPublicList: (state): models.Document[] => state.publicList.map(rehydrate),
    getLawsuit: (state) => {
      return (id: string): models.Document[] | null => {
        return state.lawsuits[id] ? state.lawsuits[id].map(rehydrate) : null;
      };
    },
  },
  actions: {
    async loadDocument(document: string): Promise<models.Document | null> {
      if (this.document[document]) return this.getDocument(document);
      const docu = await getDoc(doc(documentsCollection(), document));
      if (docu.exists()) {
        this.document[document] = docu.data() as models.Document;
        return this.document[document];
      } else {
        console.error('No such document!');
        return null;
      }
    },
    async loadPublicList(reign?: string): Promise<models.Document[]> {
      if (this.publicList.length) return this.getPublicList;
      // Exact filter/order shape of DocumentsPageV2's default public query, so the existing
      // composite index covers it — and so the first page can be SSR-rendered as the visible
      // list (not just a crawl hint). The count feeds the "共 N 件" total.
      const base = query(
        documentsCollection(),
        and(
          where('reign', '==', reign ?? getCurrentReign()),
          where('published', '==', true),
          where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
        ),
        orderBy('published', 'asc'),
        orderBy('createdAt', 'desc'),
      );
      const [snap, count] = await Promise.all([getDocs(query(base, limit(10))), getCountFromServer(base)]);
      this.publicList = snap.docs.map((d) => d.data() as models.Document);
      this.publicListTotal = count.data().count;
      return this.getPublicList;
    },
    async loadLawsuit(id: string, refresh = false): Promise<models.Document[]> {
      if (!refresh && this.lawsuits[id]) return this.getLawsuit(id)!;
      const related = await getDocs(
        query(
          documentsCollection(),
          where('prosecutionId', '==', id),
          where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
          where('published', '==', true),
        ),
      );
      const docs = related.docs.map((d) => d.data() as models.Document).filter((d): d is models.Document => !!d);
      // The prosecution document itself (rules-gated: anon SSR only gets it if public).
      try {
        const prosecution = await getDoc(doc(documentsCollection(), id));
        if (prosecution.exists() && prosecution.data()) docs.push(prosecution.data() as models.Document);
      } catch {
        // Access denied (confidential prosecution doc, anonymous request) — skip it.
      }
      docs.sort((a, b) => new Date(a.publishedAt ?? a.createdAt).valueOf() - new Date(b.publishedAt ?? b.createdAt).valueOf());
      this.lawsuits[id] = docs;
      return this.getLawsuit(id)!;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentStore, import.meta.hot));
}
