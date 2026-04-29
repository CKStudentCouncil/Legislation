import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { createServerRootMixin } from 'src/ts/vis-mixin.ts';

export const searchClient = algoliasearch('0YZRXQ3XUQ', 'd70f2bd090855ba6fec146656a8db624');
export const aisMixin = createServerRootMixin({
  searchClient,
  indexName: 'legislation',
});
