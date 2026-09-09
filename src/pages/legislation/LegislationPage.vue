<template>
  <q-page padding>
    <ais-instant-search-ssr :insights="true" :search-client="searchClient" index-name="legislation">
      <q-no-ssr>
        <ais-search-box>
          <template v-slot="{ currentRefinement, isSearchStalled, refine }">
            <q-input :model-value="currentRefinement" placeholder="以關鍵字搜尋法律" type="search" @update:model-value="refine($event)">
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
              <template v-slot:append>
                <q-icon name="close" @click="refine('')" />
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
                      <q-icon :name="category.icon" />
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
                  <div v-for="i in Object.keys(item.content)" :key="i">
                    <!-- prettier-ignore -->
                    <div v-if="(item._highlightResult.content[i].content && item._highlightResult.content[i].content.matchedWords.length > 0) ||
                        (item._highlightResult.content[i].subtitle && item._highlightResult.content[i].subtitle.matchedWords.length > 0)">
                      <span>{{ `${item.content[i].title}` }}<span v-if="item._highlightResult.content[i].subtitle.value.length>0">
                        【<ais-highlight :attribute="`content.${i}.subtitle`" :hit="item" highlightedTagName="mark" />】</span>：</span>
                      <ais-highlight :attribute="`content.${i}.content`" :hit="item" highlightedTagName="mark" />
                    </div>
                  </div>
                  <q-btn v-if="$props.manage" :to="`/manage/legislation/${item.objectID}`" color="secondary" flat label="編輯" icon="edit" />
                  <q-btn
                    :to="`/legislation/${item.objectID}`"
                    color="primary"
                    flat
                    icon="visibility"
                    label="檢視全文"
                    role="link"
                    :title="item.name"
                    @click="sendEvent('view', item, 'Legislation viewed')"
                  />
                  <q-no-ssr>
                    <q-btn
                      color="primary"
                      flat
                      icon="link"
                      label="複製連結"
                      @click="
                        sendEvent('click', item, 'Legislation link copied');
                        copyLawLink(item.objectID);
                      "
                    />
                    <q-btn
                      color="primary"
                      flat
                      icon="draw"
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
import { LegislationCategory } from 'src/ts/models.ts';
import { AIS_SSR_INSTANCE_KEY, createAisRootMixin, searchClient } from 'boot/algolia.ts';
import { AisHighlight, AisHits, AisInstantSearchSsr, AisMenu, AisPanel, AisSearchBox } from 'vue-instantsearch/vue3/es';
import { getCurrentInstance, inject, onBeforeMount, onServerPrefetch, provide, ref, useSSRContext } from 'vue';
import { copyLawLink, getMeta } from 'src/ts/utils.ts';
import { renderToString } from 'vue/server-renderer';
import { useMeta } from 'quasar';
import { useRoute } from 'vue-router';
import { useAlgoliaStore } from 'stores/algolia.ts';

const selected = ref('');
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
