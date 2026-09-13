<template>
  <q-page padding>
    <ais-instant-search-ssr :insights="true" :search-client="searchClient" index-name="legislation">
      <ais-configure v-bind="searchParameters" />
      <q-no-ssr>
        <ais-search-box>
          <template v-slot="{ currentRefinement, isSearchStalled, refine }">
            <q-input
              :model-value="currentRefinement"
              placeholder="以關鍵字搜尋法律"
              type="search"
              @update:model-value="
                query = String($event ?? '');
                refine($event);
              "
            >
              <template v-slot:prepend>
                <q-icon :name="matSearch" />
              </template>
              <template v-slot:append>
                <q-icon
                  :name="matClose"
                  @click="
                    query = '';
                    refine('');
                  "
                />
              </template>
            </q-input>
            <span :hidden="!isSearchStalled">請稍後...</span>
          </template>
        </ais-search-box>
      </q-no-ssr>
      <div class="row">
        <q-no-ssr class="col-2" style="min-width: 250px">
          <ais-menu attribute="category">
            <template v-slot="{ refine }">
              <div class="q-pt-md">
                點擊以按類別篩選：(再次點擊可取消)
                <q-list bordered class="rounded-borders q-mr-md q-mt-md" padding>
                  <q-item
                    v-for="category of Object.values(LegislationCategory.VALUES)"
                    :key="category.idPrefix"
                    :active="selected == category.firebase"
                    clickable
                    @click="
                      selected = selected == category.firebase ? '' : category.firebase;
                      refine(selected);
                    "
                  >
                    <q-item-section avatar>
                      <q-icon :name="icon(category.icon)" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ category.translation }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
            </template>
          </ais-menu>
        </q-no-ssr>
        <div class="col" style="min-width: 350px">
          <ais-hits class="q-pa-none">
            <template v-slot:item="{ item, sendEvent }">
              <q-card class="q-mb-md">
                <q-card-section>
                  <ais-panel>
                    <template #default>
                      <ais-highlight :class-names="{ 'ais-Highlight': 'text-h6' }" :hit="item" attribute="name" highlightedTagName="mark" />
                    </template>
                  </ais-panel>
                </q-card-section>
                <q-separator />
                <q-card-section class="row">
                  <div v-for="i in Object.keys(item.content ?? {})" :key="i">
                    <!-- prettier-ignore -->
                    <div v-if="(item._highlightResult?.content?.[i]?.content?.matchedWords?.length ?? 0) > 0 ||
                        (item._highlightResult?.content?.[i]?.subtitle?.matchedWords?.length ?? 0) > 0">
                      <span>{{ `${item.content[i].title}` }}<span v-if="(item._highlightResult.content[i].subtitle?.value?.length ?? 0) > 0">
                        【<ais-highlight :attribute="`content.${i}.subtitle`" :hit="item" highlightedTagName="mark" />】</span>：</span>
                      <ais-highlight :attribute="`content.${i}.content`" :hit="item" highlightedTagName="mark" />
                    </div>
                  </div>
                  <q-btn v-if="$props.manage" :to="`/manage/legislation/${item.objectID}`" color="secondary" flat label="編輯" :icon="matEdit" />
                  <q-btn
                    :to="`/legislation/${item.objectID}`"
                    color="primary"
                    flat
                    :icon="matVisibility"
                    label="檢視全文"
                    role="link"
                    :title="item.name"
                    @click="sendEvent('view', item, 'Legislation viewed')"
                  />
                  <q-no-ssr>
                    <q-btn
                      color="primary"
                      flat
                      :icon="matLink"
                      label="複製連結"
                      @click="
                        sendEvent('click', item, 'Legislation link copied');
                        copyLawLink(item.objectID);
                      "
                    />
                    <q-btn
                      color="primary"
                      flat
                      :icon="matDraw"
                      label="起草修正"
                      :to="`/legislation/${item.objectID}/amendment`"
                      @click="sendEvent('click', item, 'Legislation amendment clicked')"
                    />
                  </q-no-ssr>
                </q-card-section>
              </q-card>
            </template>
          </ais-hits>
        </div>
      </div>
    </ais-instant-search-ssr>
  </q-page>
</template>

<script lang="ts" setup>
import { matClose, matDraw, matEdit, matLink, matSearch, matVisibility } from '@quasar/extras/material-icons';
import { icon } from 'src/ts/icons.ts';
import { LegislationCategory } from 'src/ts/models.ts';
import { AIS_SSR_INSTANCE_KEY, createAisRootMixin, searchClient } from 'boot/algolia.ts';
import { AisConfigure, AisHighlight, AisHits, AisInstantSearchSsr, AisMenu, AisPanel, AisSearchBox } from 'vue-instantsearch/vue3/es';
import { computed, getCurrentInstance, inject, onBeforeMount, onServerPrefetch, provide, ref, useSSRContext } from 'vue';
import { copyLawLink, getMeta } from 'src/ts/utils.ts';
import { renderToString } from 'vue/server-renderer';
import { useMeta } from 'quasar';
import { useRoute } from 'vue-router';
import { useAlgoliaStore } from 'stores/algolia.ts';

const selected = ref('');

// The current search box text. Always '' during SSR — the search box lives inside
// <q-no-ssr>, and this page reads nothing from the URL query — so the server render always
// takes the narrow branch of searchParameters below.
const query = ref('');

/**
 * What Algolia is allowed to put in each hit. Without this the index defaults apply, and
 * the empty-query render — which is every SSR render of `/` and `/legislation` — shipped
 * ~250 KB of JSON per response to display 15 law names:
 *
 *   _highlightResult 119 KB · content[] 87 KB · _snippetResult 36 KB · actually rendered 10 KB
 *
 * All of it rode into the browser inside window.__INITIAL_STATE__, on the site's two most
 * crawled URLs. The per-clause block in the template is gated on matchedWords, which is
 * empty for every clause when there is no query, so none of those three attributes can
 * render anything until the visitor actually types something. So don't fetch them until
 * they do — and never fetch _snippetResult, which nothing in this app has ever read.
 */
const searchParameters = computed(() =>
  query.value === ''
    ? { attributesToRetrieve: ['name', 'category'], attributesToHighlight: ['name'], attributesToSnippet: [] }
    : { attributesToSnippet: [] },
);

defineProps({
  manage: {
    type: Boolean,
    default: false,
  },
});

// findResultsState() collects the Algolia results by rendering a *clone* of this page, and
// that clone runs this same setup(). It must search on the very instance we then read the
// results off, so reuse the one the original provided rather than building a second one.
// Outside the clone nothing provides this key, so each real page instance — i.e. each SSR
// request — gets its own instance. See createAisRootMixin() for why that matters.
const inheritedInstantSearch = inject<any>(AIS_SSR_INSTANCE_KEY, null);
const isAisResultsClone = inheritedInstantSearch !== null;
const instantsearch = inheritedInstantSearch ?? (createAisRootMixin() as any).data().instantsearch;
provide(AIS_SSR_INSTANCE_KEY, instantsearch);

const components = {
  AisInstantSearchSsr,
  AisConfigure,
  AisSearchBox,
  AisMenu,
  AisHits,
  AisPanel,
  AisHighlight,
};

onBeforeMount(() => {
  if (Object.values(useAlgoliaStore().getState()).length > 0) {
    instantsearch.hydrate(useAlgoliaStore().getState());
    useAlgoliaStore().clearState();
  }
});

// Skipped in the clone: it renders this same setup(), so registering the hook there would
// call findResultsState() again, and again, forever.
if (!isAisResultsClone) {
  onServerPrefetch(async function () {
    try {
      const ctx = useSSRContext();
      // `.proxy`, not the internal instance: findResultsState() clones the component from
      // `component.$options`, which only exists on the public proxy. Passing the internal
      // instance made it clone an empty component that rendered nothing, registered no
      // widgets and always resolved with {}.
      // Awaited so the results are hydrated onto `instantsearch` before this page renders,
      // and so the real state (not a pending Promise) is what gets serialized for the client.
      const state = await instantsearch.findResultsState({
        component: getCurrentInstance()!.proxy,
        renderToString: (app: any) => renderToString(app, ctx),
      });
      useAlgoliaStore().setState(state);
    } catch (error) {
      console.error('Error during server-side rendering:', error);
    }
  });
}

if (useRoute().path !== '/') {
  useMeta({ title: '檢視法令', meta: getMeta('檢視法令') });
}
</script>

<style>
ol {
  list-style-type: none !important;
  padding-left: 0;
}
</style>
