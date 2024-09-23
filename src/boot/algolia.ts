import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { boot } from 'quasar/wrappers';
import InstantSearch from 'vue-instantsearch/vue3/es';

export const searchClient = algoliasearch(
  '0YZRXQ3XUQ',
  'd70f2bd090855ba6fec146656a8db624'
);

export default boot(async ({ app, router }) => {
  app.use(InstantSearch);
});
