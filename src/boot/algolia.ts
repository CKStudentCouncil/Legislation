import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { createServerRootMixin } from 'src/ts/vis-mixin.ts';

// The injection key vue-instantsearch's ais-* components read the shared InstantSearch
// instance from. The string is part of vue-instantsearch's contract — do not rename it.
export const AIS_SSR_INSTANCE_KEY = '$_ais_ssrInstantSearchInstance';

export const searchClient = algoliasearch('0YZRXQ3XUQ', 'd70f2bd090855ba6fec146656a8db624');

/**
 * Builds a fresh InstantSearch root mixin. Call this per component instance — i.e. per SSR
 * request — never once at module scope.
 *
 * A module-level singleton is shared by every request the server ever handles. Widgets are
 * registered when an ais-* component mounts and only removed when it unmounts, and nothing
 * unmounts during SSR, so the index accumulates a widget per render forever: an unbounded
 * leak that also makes each response slower than the last.
 */
export function createAisRootMixin() {
  return createServerRootMixin({
    searchClient,
    indexName: 'legislation',
  });
}
