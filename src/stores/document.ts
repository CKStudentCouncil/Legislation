import { acceptHMRUpdate, defineStore } from 'pinia';
import chunk from 'lodash/chunk';
import type * as models from 'src/ts/models.ts';
import { DocumentConfidentiality, DocumentType } from 'src/ts/models.ts';
import { getCurrentReign } from 'src/ts/shared-utils.ts';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { readWithRetry } from 'src/ts/firestore-retry.ts';
import { errorCode } from 'src/ts/firebase-errors.ts';
import { loggedInUser } from 'src/ts/auth.ts';
import { and, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

// Keep the Firestore key with each thread entry: legacy ID fields can disagree with it or match another document's fields.
export type LawsuitDocument = models.Document & { documentId: string };

/**
 * Re-attach the `getFullId` method and turn serialized date strings back into `Date`s.
 * Methods can't survive Firestore <-> Pinia (SSR) serialization, so every getter that
 * hands a Document to the UI must run this first (mirrors the model converter's intent).
 */
function rehydrate<T extends models.Document>(d: T): T {
  d.createdAt = new Date(d.createdAt);
  d.publishedAt = d.publishedAt ? new Date(d.publishedAt) : null;
  d.meetingTime = d.meetingTime ? new Date(d.meetingTime) : null;
  d.getFullId = function () {
    return `${this.idPrefix}第${this.idNumber}號`;
  };
  return d;
}

// Own entries only. Ids come from the `/document/judicial/lawsuit/:id` route, and a key such as `constructor` would otherwise resolve
// through the prototype chain to a built-in that is shared by every SSR request.
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// How many rounds loadLawsuit may spend following one case's `prosecutionId` pointers. Each hop of a climb costs a round (a 判決 pointing at
// a 上字 pointing at a 上字 pointing at a 啟字 pointing at the case number is already four), and the cap is what keeps a long chain from
// holding up the server render.
const MAX_LAWSUIT_ROUNDS = 6;
// Longest `prosecutionId` that is followed. Real keys are a 公文字號 or a case number, a dozen characters; the cap only turns away garbage
// before it becomes a document ID or a query value.
const MAX_KEY_LENGTH = 200;
// A thread this browser built for the same reader less than this long ago is not worth building again: the search page loads it, then
// the page it navigates to asks for a forced refresh on mount. Client-only — the server must never remember across requests.
const LAWSUIT_FRESH_MS = 30_000;
const lawsuitBuiltInBrowser = new Map<string, { builtAt: number; uid: string | null }>();

// `prosecutionId` is whatever its author wrote (see model-converters.ts), so what comes off a stored document is checked before it is used
// as a document ID or a query value.
function isLawsuitKey(k: unknown): k is string {
  return typeof k === 'string' && k.length > 0 && k.length <= MAX_KEY_LENGTH;
}

// The test the `in` query in loadLawsuit applies in the database, for the documents that are fetched by name instead.
function isPublicPublished(d: models.Document): boolean {
  return d.published === true && d.confidentiality?.firebase === DocumentConfidentiality.Public.firebase;
}

export const useDocumentStore = defineStore('document', {
  state: () => ({
    document: {} as Record<string, models.Document>,
    // First page of public, published documents, SSR-rendered as the visible list on /document.
    publicList: [] as models.Document[],
    // Total count matching the default public query (the "共 N 件" figure).
    publicListTotal: 0,
    // Per-prosecution document threads for SSR-rendered judicial lawsuit pages.
    lawsuits: {} as Record<string, LawsuitDocument[]>,
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
      return (id: string): LawsuitDocument[] | null => {
        // The entry is read first so the lookup stays reactive.
        return state.lawsuits[id] && hasOwn(state.lawsuits, id) ? state.lawsuits[id].map(rehydrate) : null;
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
        orderBy('publishedAt', 'desc'),
        orderBy('createdAt', 'desc'),
      );
      const [snap, count] = await readWithRetry(() => Promise.all([getDocs(query(base, limit(10))), getCountFromServer(base)]));
      this.publicList = snap.docs.map((d) => d.data() as models.Document);
      this.publicListTotal = count.data().count;
      return this.getPublicList;
    },
    async loadLawsuit(id: string, refresh = false): Promise<LawsuitDocument[]> {
      // Not a case that can exist, and assigned below it would replace the state's prototype instead of adding an entry.
      if (id === '__proto__') return [];
      // Capture the reader before any reads: a request begun anonymously must not become fresh for a user who signs in while it runs.
      const uid = import.meta.env.QUASAR_SERVER ? null : (loggedInUser.value?.uid ?? null);
      const built = lawsuitBuiltInBrowser.get(id);
      if (hasOwn(this.lawsuits, id) && (built === undefined || built.uid === uid)) {
        if (!refresh) return this.getLawsuit(id)!;
        if (built !== undefined && Date.now() - built.builtAt < LAWSUIT_FRESH_MS) return this.getLawsuit(id)!;
      }
      // `prosecutionId` is supposed to hold the first-instance case number (確字第…號), but older documents hold the 啟字 document's ID
      // and some hold a 上字 document's ID, so one case is threaded by up to three kinds of key. `id` may be any of them. Each round
      // fetches the documents the keys name (to climb through their own `prosecutionId`) and every document pointing at one of the
      // keys (to fan out through the 啟/上 documents among them), so each hop of the climb costs a round.
      //
      // The thread is what an anonymous reader would be handed — public, published documents — plus the document the URL itself names,
      // which is left to the rules as it always was. A document reached by climbing is held to the same test as one reached by the query,
      // so the thread does not grow drafts or confidential documents that the anonymous server render never showed.
      const col = documentsCollection();
      const found = new Map<string, LawsuitDocument>();
      const queried = new Set<string>();
      let pending = [id].filter(isLawsuitKey);
      for (let round = 0; round < MAX_LAWSUIT_ROUNDS && pending.length > 0; round++) {
        pending.forEach((k) => queried.add(k));
        // `in` takes at most 30 values, so a long round is several queries.
        const relatedQueries = chunk(pending, 30).map((batch) =>
          query(
            col,
            where('prosecutionId', 'in', batch),
            where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
            where('published', '==', true),
          ),
        );
        // The documents the keys themselves name (the 啟字 a 上字 points at, say), which no `prosecutionId` query returns. A key that
        // names nothing (a case number) reads as permission-denied, because the rules look at `resource.data`, and so does a document this
        // reader may not see: both just mean "no document here". A `/` can only come from a mistyped `prosecutionId`, and would make
        // doc() throw.
        const namedRefs = pending.filter((k) => !found.has(k) && !k.includes('/')).map((k) => doc(col, k));
        const [related, named] = await Promise.all([
          Promise.all(relatedQueries.map((q) => readWithRetry(() => getDocs(q)))),
          Promise.all(
            namedRefs.map((ref) =>
              readWithRetry(() => getDoc(ref)).catch((e: unknown) => {
                if (errorCode(e) === 'permission-denied' || errorCode(e) === 'not-found') return null;
                // Anything else, a dropped connection above all (readWithRetry has already tried again), must not read as "no document
                // here": the thread would be rendered short, answered 200 and cached at the CDN for up to a day.
                throw e;
              }),
            ),
          ),
        ]);
        const next = new Set<string>();
        for (const snap of named) {
          if (!snap?.exists()) continue;
          const d = snap.data() as models.Document;
          if (snap.id !== id && !isPublicPublished(d)) continue;
          found.set(snap.id, { ...d, documentId: snap.id });
          if (isLawsuitKey(d.prosecutionId)) next.add(d.prosecutionId);
        }
        for (const snap of related.flatMap((r) => r.docs)) {
          const d = snap.data() as models.Document;
          // Keyed by the document's key, not getFullId(): `prosecutionId` points at keys, and a document stranded by an ID edit has
          // idPrefix/idNumber that disagree with its key (see firestore.rules), so two of them could otherwise collapse into one.
          found.set(snap.id, { ...d, documentId: snap.id });
          const type = d.type?.firebase;
          if (type === DocumentType.CourtProsecutions.firebase || type === DocumentType.CourtAppeals.firebase) next.add(snap.id);
        }
        pending = [...next].filter((k) => !queried.has(k));
      }
      if (pending.length > 0) {
        console.warn(
          `loadLawsuit(${id}): stopped after ${MAX_LAWSUIT_ROUNDS} rounds with ${pending.length} key(s) unfollowed; the thread is incomplete.`,
        );
      }
      const docs = [...found.values()];
      docs.sort((a, b) => new Date(a.publishedAt ?? a.createdAt).valueOf() - new Date(b.publishedAt ?? b.createdAt).valueOf());
      this.lawsuits[id] = docs;
      // Client only: this module is shared by every request the server handles.
      if (!import.meta.env.QUASAR_SERVER) lawsuitBuiltInBrowser.set(id, { builtAt: Date.now(), uid });
      return this.getLawsuit(id)!;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentStore, import.meta.hot));
}
