import InstantSearch from 'vue-instantsearch/vue3/es';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { boot } from 'quasar/wrappers';
import { createServerRootMixin } from 'src/ts/vis-mixin.ts';

export const searchClient = algoliasearch('0WK6MQYNG7', '2358951292d547154e5e0f7e0960c08a');
export const aisMixin = createServerRootMixin({
  searchClient,
  indexName: 'legislation',
});

export default boot(({ app }) => {
  app.use(InstantSearch);
  app.mixin(aisMixin);
});
