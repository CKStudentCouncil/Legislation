<template>
  <q-page padding>
    <ais-instant-search :search-client="searchClient" index-name="legislation">
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
      <div class="row">
        <div class="col-2" style="min-width: 350px">
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
        </div>
        <div class="col" style="min-width: 350px">
          <ais-hits class="q-pa-none">
            <template v-slot:item="{ item }">
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
                  <q-btn :to="`/legislation/${item.objectID}`" color="primary" flat icon="visibility" label="檢視全文" />
                  <q-btn color="primary" flat icon="link" label="複製連結" @click="copyLawLink(item.objectID)" />
                </q-card-section>
              </q-card>
            </template>
          </ais-hits>
        </div>
      </div>
    </ais-instant-search>
  </q-page>
</template>

<script lang="ts" setup>
import { LegislationCategory } from 'src/ts/models.ts';
import { searchClient } from 'boot/algolia.ts';
import { ref } from 'vue';
import { copyLawLink } from 'src/ts/utils.ts';

const selected = ref('');
defineProps({
  manage: {
    type: Boolean,
    default: false,
  },
});
</script>

<style>
ol {
  list-style-type: none !important;
  padding-left: 0;
}
</style>
