import InstantSearch from 'vue-instantsearch/vue3/es';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { boot } from 'quasar/wrappers';
import { createServerRootMixin } from 'src/ts/vis-mixin.ts';

export const searchClient = algoliasearch('0YZRXQ3XUQ', 'd70f2bd090855ba6fec146656a8db624');
export const aisMixin = createServerRootMixin({
  searchClient,
  indexName: 'legislation',
});

export default boot(({ app }) => {
  app.use(InstantSearch);
  app.mixin(aisMixin);
});
