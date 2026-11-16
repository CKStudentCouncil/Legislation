import { acceptHMRUpdate, defineStore } from 'pinia';
import type * as models from 'src/ts/models.ts';
import { DocumentConfidentiality } from 'src/ts/models.ts';
import { canNameDocument, getCurrentReign, hasOwn, isLawsuitKey } from 'src/ts/shared-utils.ts';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { readWithRetry } from 'src/ts/firestore-retry.ts';
import { errorCode } from 'src/ts/firebase-errors.ts';
import type { DocumentReference } from 'firebase/firestore';
import { and, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

// Keep the Firestore key with each thread entry: legacy ID fields can disagree with it or match another document's fields.
export type LawsuitDocument = models.Document & { documentId: string };

// One case's thread as it was built for one reader.
export interface LawsuitThread {
  docs: LawsuitDocument[];
  // Whom the reads went out as: a signed-in reader's uid, null for an anonymous one, undefined when the browser did not know yet.
  reader: string | null | undefined;
  // Built by the server render. That is anonymous too, but it can reach the browser as a CDN copy up to a day old.
  server: boolean;
}

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

// Threads are filed under '#' + the route's id, never the bare id. The id is whatever the visitor put in `/document/judicial/lawsuit/:id`,
// and every id is cached, found or not: a bare `__proto__` would replace the state's prototype, `constructor` would reach a built-in shared
// by every SSR request, and Vue's own flags (`__v_raw`, `__v_isReactive`, `__v_skip`) are answered by the reactive proxy itself, so no
// own-property test closes them all. No such key starts with '#'.
function lawsuitSlot(id: string): string {
  return '#' + id;
}

// The document `ref` names, or null when there is none or this reader may not see it. A key that names nothing reads as permission-denied
// too, because the rules look at `resource.data`.
function readNamed(ref: DocumentReference<models.Document | null>) {
  return readWithRetry(() => getDoc(ref)).catch((e: unknown) => {
    if (errorCode(e) === 'permission-denied' || errorCode(e) === 'not-found') return null;
    // Anything else, a dropped connection above all (readWithRetry has already tried again), must not read as "no document here": the
    // thread would be rendered short, answered 200 and cached at the CDN for up to a day.
    throw e;
  });
}

// Every public, published document filed under the same `lawsuitRoot` as `id`, plus the document `id` names when this reader may read it,
// which is left to the rules as it always was. `id` may be any key a case is filed under (its case number, a 啟字's or 上字's ID) or the ID of
// any document in it. `lawsuitRoot` is written by the threadLawsuit Cloud Function (functions/src/lawsuits.ts), so a thread is at most
// two queries and a lookup, however its documents point at one another.
async function readLawsuit(id: string, reader: string | null | undefined): Promise<LawsuitDocument[]> {
  const col = documentsCollection();
  const filedUnder = (root: string) =>
    readWithRetry(() =>
      getDocs(
        query(
          col,
          where('lawsuitRoot', '==', root),
          where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
          where('published', '==', true),
        ),
      ),
    );
  const named = () => (canNameDocument(id) ? readNamed(doc(col, id)) : Promise.resolve(null));
  // Only a signed-in reader can be let see more of the named document than the query returns (a confidential 啟字 they are a viewer of),
  // so only they read it alongside. For anyone else it would be a wasted read, and for a case number, which names no document, a refused one.
  const [filed, namedFirst] = await Promise.all([filedUnder(id), reader ? named() : undefined]);
  let docs = filed.docs;
  let namedDoc = namedFirst;
  if (docs.length === 0) {
    // Nothing is filed under `id` itself, so it names a document filed under another key (a 判決, a 上字, a 啟字 that points at its case
    // number), and that document's lawsuitRoot says which.
    if (namedDoc === undefined) namedDoc = await named();
    const root = namedDoc?.data()?.lawsuitRoot;
    if (isLawsuitKey(root) && root !== id) docs = (await filedUnder(root)).docs;
  }
  // Keyed by the document's key, not getFullId(): a document stranded by an ID edit has idPrefix/idNumber that disagree with its key (see
  // firestore.rules), so two of them could otherwise collapse into one.
  const found = new Map<string, LawsuitDocument>();
  for (const snap of docs) found.set(snap.id, { ...(snap.data() as models.Document), documentId: snap.id });
  if (namedDoc?.exists()) found.set(namedDoc.id, { ...(namedDoc.data() as models.Document), documentId: namedDoc.id });
  return [...found.values()].sort(
    (a, b) => new Date(a.publishedAt ?? a.createdAt).valueOf() - new Date(b.publishedAt ?? b.createdAt).valueOf(),
  );
}

// Typed as the state function's return type rather than with `{} as Record<…>` on each field: typescript-eslint's
// no-unnecessary-type-assertion calls those assertions unnecessary (Pinia's StateTree accepts anything), and its
// autofix would collapse each map to `{}`.
interface DocumentState {
  document: Record<string, models.Document>;
  // First page of public, published documents, SSR-rendered as the visible list on /document.
  publicList: models.Document[];
  // Total count matching the default public query (the "共 N 件" figure).
  publicListTotal: number;
  // Per-prosecution document threads for SSR-rendered judicial lawsuit pages, filed by lawsuitSlot().
  lawsuits: Record<string, LawsuitThread>;
}

export const useDocumentStore = defineStore('document', {
  state: (): DocumentState => ({
    document: {},
    publicList: [],
    publicListTotal: 0,
    lawsuits: {},
  }),
  getters: {
    getDocument: (state) => {
      return (document: string): models.Document | null => {
        // Own entries only: the id comes from the `/document/:id` route, and a key such as `__proto__` or
        // `constructor` would otherwise resolve through the prototype chain to a built-in shared by every SSR
        // request, which rehydrate() then writes to. The entry is read first so the lookup stays reactive.
        // (An entry is only ever stored for a document that exists, which no Vue flag key can name.)
        if (state.document[document] && hasOwn(state.document, document)) {
          return rehydrate(state.document[document]);
        }
        return null;
      };
    },
    getPublicList: (state): models.Document[] => state.publicList.map(rehydrate),
    getLawsuit: (state) => {
      return (id: string): LawsuitDocument[] | null => state.lawsuits[lawsuitSlot(id)]?.docs.map(rehydrate) ?? null;
    },
  },
  actions: {
    async loadDocument(document: string): Promise<models.Document | null> {
      if (this.document[document] && hasOwn(this.document, document)) return this.getDocument(document);
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
    /**
     * The thread `id` belongs to, read as `reader` (src/ts/auth.ts `currentReader`: a uid, null when signed out, undefined while the
     * browser does not know yet; the server always reads as nobody). A thread already built in this runtime for the same, known reader is
     * handed back as it is. In the browser the server's copy never counts as built: it may be a CDN copy hours old.
     */
    async loadLawsuit(id: string, reader?: string | null): Promise<LawsuitDocument[]> {
      const server = !!import.meta.env.QUASAR_SERVER;
      const readAs = server ? null : reader;
      const cached = this.lawsuits[lawsuitSlot(id)];
      if (cached && cached.server === server && readAs !== undefined && cached.reader === readAs) return this.getLawsuit(id)!;
      const docs = isLawsuitKey(id) ? await readLawsuit(id, readAs) : [];
      this.lawsuits[lawsuitSlot(id)] = { docs, reader: readAs, server };
      return this.getLawsuit(id)!;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentStore, import.meta.hot));
}
