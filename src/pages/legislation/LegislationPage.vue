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
                <q-card-section>
                  <div v-for="i in Object.keys(item.content)" :key="i">
                    <!-- prettier-ignore -->
                    <div v-if="(item._highlightResult.content[i].content && item._highlightResult.content[i].content.matchedWords.length > 0) ||
                        (item._highlightResult.content[i].subtitle && item._highlightResult.content[i].subtitle.matchedWords.length > 0)">
                      <span>{{ `${item.content[i].title}` }}<span v-if="item._highlightResult.content[i].subtitle.value.length>0">
                        【<ais-highlight :attribute="`content.${i}.subtitle`" :hit="item" highlightedTagName="mark" />】</span>：</span>
                      <ais-highlight :attribute="`content.${i}.content`" :hit="item" highlightedTagName="mark" />
                    </div>
                  </div>
                  <q-btn v-if="$props.manage" :to="`/manage/legislation/${item.objectID}`" color="secondary" flat label="編輯" />
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
import { aisMixin, searchClient } from 'boot/algolia.ts';
import { getCurrentInstance, inject, onBeforeMount, onServerPrefetch, ref, useSSRContext } from 'vue';
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

const instantsearch = inject<any>('$_ais_ssrInstantSearchInstance');

onBeforeMount(() => {
  if (Object.values(useAlgoliaStore().getState()).length > 0) {
    aisMixin.data().instantsearch.hydrate(useAlgoliaStore().getState());
    useAlgoliaStore().clearState();
  }
});

onServerPrefetch(async function () {
  try {
    const ctx = useSSRContext();
    let state: any;
    if (!useAlgoliaStore().hasState()) {
      state = instantsearch.findResultsState({
        component: getCurrentInstance(),
        renderToString: (app: any) => renderToString(app, ctx),
      });
    } else {
      state = await instantsearch.findResultsState({
        component: getCurrentInstance(),
        renderToString: (app: any) => renderToString(app, ctx),
      });
    }
    useAlgoliaStore().setState(state);
  } catch (error) {
    console.error('Error during server-side rendering:', error);
  }
});

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
