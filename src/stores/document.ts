import { acceptHMRUpdate, defineStore } from 'pinia';
import chunk from 'lodash/chunk';
import type * as models from 'src/ts/models.ts';
import { DocumentConfidentiality, DocumentType } from 'src/ts/models.ts';
import { getCurrentReign } from 'src/ts/shared-utils.ts';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { readWithRetry } from 'src/ts/firestore-retry.ts';
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
        // Own entries only: the id comes from the `/document/:id` route, and a key such as `__proto__` or
        // `constructor` would otherwise resolve through the prototype chain to a built-in shared by every SSR
        // request, which rehydrate() then writes to. The entry is read first so the lookup stays reactive.
        if (state.document[document] && Object.prototype.hasOwnProperty.call(state.document, document)) {
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
      if (this.document[document] && Object.prototype.hasOwnProperty.call(this.document, document)) return this.getDocument(document);
      // Built before the first await, as in loadLegislation, and retried on the server for LEGISLATION-K.
      const ref = doc(documentsCollection(), document);
      const docu = await readWithRetry(() => getDoc(ref));
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
      const [snap, count] = await readWithRetry(() => Promise.all([getDocs(query(base, limit(10))), getCountFromServer(base)]));
      this.publicList = snap.docs.map((d) => d.data() as models.Document);
      this.publicListTotal = count.data().count;
      return this.getPublicList;
    },
    async loadLawsuit(id: string, refresh = false): Promise<models.Document[]> {
      if (!refresh && this.lawsuits[id]) return this.getLawsuit(id)!;
      // `prosecutionId` is supposed to hold the first-instance case number (確字第…號), but older documents hold the 啟字 document's ID
      // and some hold a 上字 document's ID, so one case is threaded by up to three kinds of key. `id` may be any of them: climb to the
      // root (the `prosecutionId` of the document `id` names, if it names one), then fan out through every 啟/上 document found on the
      // way. Three rounds reach the same thread from a case number, a 啟字 ID or a 上字 ID.
      const fullId = (d: models.Document) => `${d.idPrefix}第${d.idNumber}號`;
      const found = new Map<string, models.Document>();
      const queried = new Set<string>();
      // The document `id` names, if any (rules-gated: anon SSR only gets it if public). Refs and queries are built before the first
      // await, as in loadDocument.
      const ownRef = doc(documentsCollection(), id);
      const own = readWithRetry(() => getDoc(ownRef))
        .then((snap) => (snap.exists() ? ((snap.data() as models.Document | undefined) ?? null) : null))
        // Access denied (confidential document, anonymous request) — carry on without it.
        .catch(() => null);
      let pending = [id];
      for (let round = 0; round < 3 && pending.length > 0; round++) {
        const keys = pending.slice(0, 30); // Firestore's cap on `in`
        keys.forEach((k) => queried.add(k));
        const relatedQuery = query(
          documentsCollection(),
          where('prosecutionId', 'in', keys),
          where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
          where('published', '==', true),
        );
        const [related, ownDoc] = await Promise.all([readWithRetry(() => getDocs(relatedQuery)), round === 0 ? own : null]);
        const next = new Set<string>();
        if (ownDoc) {
          found.set(fullId(ownDoc), ownDoc);
          if (ownDoc.prosecutionId) next.add(ownDoc.prosecutionId);
        }
        for (const snap of related.docs) {
          const d = snap.data() as models.Document | undefined;
          if (!d) continue;
          found.set(fullId(d), d);
          const type = d.type?.firebase;
          if (type === DocumentType.CourtProsecutions.firebase || type === DocumentType.CourtAppeals.firebase) next.add(fullId(d));
        }
        pending = [...next].filter((k) => !queried.has(k));
      }
      const docs = [...found.values()];
      docs.sort((a, b) => new Date(a.publishedAt ?? a.createdAt).valueOf() - new Date(b.publishedAt ?? b.createdAt).valueOf());
      this.lawsuits[id] = docs;
      return this.getLawsuit(id)!;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentStore, import.meta.hot));
}
