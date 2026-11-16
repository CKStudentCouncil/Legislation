import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'util';
import * as logger from 'firebase-functions/logger';
import { checkRole } from './auth';
import { onCall, onDocumentWritten } from './sentry';
import { DocumentType } from '../../src/ts/models';
import { canNameDocument, isLawsuitKey } from '../../src/ts/shared-utils';

// A judicial document's `prosecutionId` holds one of three kinds of key: the first-instance case number (確字第…號), a 啟字's ID, or a 上字's
// ID, and a document it names may itself point further on. So one case is filed under several keys, and the lawsuit page used to walk that
// graph on every render. Instead every document of a thread carries `lawsuitRoot`, the key the walk would have ended at, and the page
// reads a thread with one equality query. This file keeps that field right.

const globalFunctionOptions = { region: 'asia-east1' };
const db = admin.firestore();
const documents = () => db.collection('documents');

// gRPC NOT_FOUND, which update() answers for a document deleted since it was read.
const NOT_FOUND = 5;
// Types that head a thread on their own, before anything points at them. The page's old walk fanned out through exactly these.
const HEAD_TYPES = new Set([DocumentType.CourtProsecutions.firebase, DocumentType.CourtAppeals.firebase]);
// Hops followed before a chain is given up on. Real ones are four or five (判決 → 上字 → 上字 → 啟字 → case number); the cap only bounds
// the reads a malformed chain can cost.
const MAX_CHAIN = 32;
// Documents re-filed after one write before the rest are left for the backfill. Real threads are a few dozen.
const MAX_FOLLOWERS = 500;

// What threading reads of a document. Stored values are whatever their author wrote, so nothing here is trusted to be a string.
interface Node {
  prosecutionId?: unknown;
  type?: unknown;
  lawsuitRoot?: unknown;
}

interface Graph {
  // The document `id` names, or null.
  node(id: string): Promise<Node | null>;
  // Whether some document's prosecutionId is `id`.
  followed(id: string): Promise<boolean>;
}

// Where following prosecutionId from `key` ends: the first key that names no document, or names one that points nowhere. A cycle ends at
// its least key, so every document on it, and every one leading into it, reaches the same root.
async function resolve(graph: Graph, key: string): Promise<string> {
  const path: string[] = [];
  let k = key;
  while (path.length < MAX_CHAIN) {
    const seen = path.indexOf(k);
    if (seen >= 0) return path.slice(seen).sort()[0];
    path.push(k);
    const node = canNameDocument(k) ? await graph.node(k) : null;
    if (!node || !isLawsuitKey(node.prosecutionId)) return k;
    k = node.prosecutionId;
  }
  return k;
}

// The lawsuitRoot the document `id` should carry, or null for one in no thread.
async function rootOf(graph: Graph, id: string): Promise<string | null> {
  const root = await resolve(graph, id);
  if (root !== id) return root;
  // It points nowhere (or is the least key of a cycle), so it heads a thread if there is one to head: a 啟字 or 上字 always does, any other
  // document only once something points at it.
  const node = await graph.node(id);
  if (!node) return null;
  return (typeof node.type === 'string' && HEAD_TYPES.has(node.type)) || (await graph.followed(id)) ? id : null;
}

// The live collection, reading each document and each "does anything point here" at most once per run.
class LiveGraph implements Graph {
  private readonly nodes = new Map<string, Promise<Node | null>>();
  private readonly follows = new Map<string, Promise<boolean>>();

  node(id: string): Promise<Node | null> {
    let node = this.nodes.get(id);
    if (!node) {
      node = documents()
        .doc(id)
        .get()
        .then((s) => (s.exists ? (s.data() as Node) : null));
      this.nodes.set(id, node);
    }
    return node;
  }

  followed(id: string): Promise<boolean> {
    let followed = this.follows.get(id);
    if (!followed) {
      followed = documents()
        .where('prosecutionId', '==', id)
        .limit(1)
        .select()
        .get()
        .then((s) => !s.empty);
      this.follows.set(id, followed);
    }
    return followed;
  }

  // Every document whose chain runs through `id`: the ones whose root moves when `id` appears, disappears or points elsewhere.
  async followers(id: string): Promise<string[]> {
    const found = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0 && found.size <= MAX_FOLLOWERS) {
      const next: string[] = [];
      // `in` takes at most 30 values.
      for (let i = 0; i < frontier.length; i += 30) {
        const snap = await documents()
          .where('prosecutionId', 'in', frontier.slice(i, i + 30))
          .select('prosecutionId', 'type', 'lawsuitRoot')
          .get();
        for (const d of snap.docs) {
          if (found.has(d.id)) continue;
          found.add(d.id);
          this.nodes.set(d.id, Promise.resolve(d.data() as Node));
          next.push(d.id);
        }
      }
      frontier = next;
    }
    if (frontier.length > 0) logger.warn('threadLawsuit: too many followers, left the rest for backfillLawsuitRoots', { docId: id });
    found.delete(id);
    return [...found];
  }
}

// Brings each document's lawsuitRoot in line with the graph and returns how many it wrote. A write that loses a race with a newer edit is
// put right by the run it fires itself: a change to lawsuitRoot is one threadLawsuit answers by computing that document's root again.
async function settle(graph: Graph, ids: Iterable<string>): Promise<number> {
  let written = 0;
  for (const id of ids) {
    const node = await graph.node(id);
    if (!node) continue;
    const root = await rootOf(graph, id);
    if ((node.lawsuitRoot ?? null) === root) continue;
    try {
      await documents()
        .doc(id)
        .update({ lawsuitRoot: root ?? FieldValue.delete() });
      written++;
    } catch (e) {
      // Deleted since it was read, so there is nothing left to file.
      if ((e as { code?: unknown }).code !== NOT_FOUND) throw e;
    }
  }
  return written;
}

// True when a write changed lawsuitRoot and nothing else: the threading bookkeeping, not an edit of the document. recordDocumentHistory
// ignores the field the same way (IGNORED_FIELDS); updateIdCache uses this so re-filing a thread does not bump its documents' sitemap
// lastmod or ping IndexNow for pages that did not change.
export function onlyLawsuitRootChanged(before: DocumentData | undefined, after: DocumentData | undefined): boolean {
  if (!before || !after || before.lawsuitRoot === after.lawsuitRoot) return false;
  const rest = (data: DocumentData) => {
    const copy = { ...data };
    delete copy.lawsuitRoot;
    return copy;
  };
  return isDeepStrictEqual(rest(before), rest(after));
}

// Keeps lawsuitRoot right as documents come, go and change what they point at. A write can move the root of:
// - the written document itself;
// - when it appeared, disappeared or now points elsewhere, every document whose chain runs through it;
// - the documents it pointed at before and after, which may have lost their last follower or gained their first, and that decides
//   whether one that is not a 啟字 or 上字 heads a thread.
// Any other edit returns at once, and so does the run fired by the write this makes: that one changes only lawsuitRoot, so it computes
// the same root and stops.
export const threadLawsuit = onDocumentWritten({ ...globalFunctionOptions, document: 'documents/{docId}' }, async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  const b = before?.exists ? (before.data() as Node) : null;
  const a = after?.exists ? (after.data() as Node) : null;
  // The snapshot's own ref, not event.params, which arrive percent-encoded (see recordDocumentHistory).
  const id = (after ?? before)?.ref.id;
  if (!id) return;
  const moved = !b !== !a || b?.prosecutionId !== a?.prosecutionId;
  if (!moved && b?.type === a?.type && b?.lawsuitRoot === a?.lawsuitRoot) return;

  const graph = new LiveGraph();
  const ids = new Set<string>([id]);
  if (moved) for (const follower of await graph.followers(id)) ids.add(follower);
  for (const p of [b?.prosecutionId, a?.prosecutionId]) {
    if (isLawsuitKey(p) && canNameDocument(p)) ids.add(p);
  }
  const written = await settle(graph, ids);
  if (written > 0) logger.info('threadLawsuit', { docId: id, checked: ids.size, written });
});

// Files every document the way threadLawsuit would, for the documents written before it existed.
//
// Order matters. Deploy the functions first, so recordDocumentHistory already ignores the field and updateIdCache already skips writes
// that only change it (otherwise every write here archives a spurious version and pings IndexNow). Then run this, then ship the app that
// reads lawsuitRoot: until this has run, that app finds no thread at all. It only writes documents whose field is wrong, so repeating it
// is safe.
//
// It only reads unless called with { dryRun: false }. The result counts the threads it found and lists what it would change.
export const backfillLawsuitRoots = onCall({ ...globalFunctionOptions, timeoutSeconds: 540 }, async (request) => {
  await checkRole(request, 'Chairman');
  const dryRun = request.data?.dryRun !== false;
  const snapshot = await documents().select('prosecutionId', 'type', 'lawsuitRoot').get();
  const nodes = new Map(snapshot.docs.map((d) => [d.id, d.data() as Node]));
  const followed = new Set(snapshot.docs.map((d) => d.data().prosecutionId).filter(isLawsuitKey));
  const graph: Graph = {
    node: async (id) => nodes.get(id) ?? null,
    followed: async (id) => followed.has(id),
  };
  const roots = new Set<string>();
  const changes: { ref: DocumentReference; root: string | null }[] = [];
  for (const d of snapshot.docs) {
    const root = await rootOf(graph, d.id);
    if (root !== null) roots.add(root);
    if ((d.data().lawsuitRoot ?? null) !== root) changes.push({ ref: d.ref, root });
  }
  if (!dryRun) {
    // Small batches, because every write fires the history, ID-cache and threading triggers. A document edited meanwhile is re-filed by
    // threadLawsuit itself, so no precondition is needed.
    for (let i = 0; i < changes.length; i += 20) {
      const batch = db.batch();
      for (const c of changes.slice(i, i + 20)) batch.update(c.ref, { lawsuitRoot: c.root ?? FieldValue.delete() });
      await batch.commit();
    }
  }
  logger.info('backfillLawsuitRoots', { dryRun, scanned: snapshot.size, threads: roots.size, changed: changes.length });
  return {
    dryRun,
    scanned: snapshot.size,
    threads: roots.size,
    changed: changes.length,
    updated: dryRun ? 0 : changes.length,
    // Enough to check by eye before writing.
    changes: changes.slice(0, 200).map((c) => ({ id: c.ref.id, lawsuitRoot: c.root })),
  };
});
