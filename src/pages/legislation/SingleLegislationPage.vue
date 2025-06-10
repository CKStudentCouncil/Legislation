<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-if="legislation" ref="content" class="official-font-when-printing" style="max-width: min(1170px, 97vw)">
      <h1 class="text-h4 q-mt-none flex-center text-center">
        <span v-if="legislation.frozenBy">(失效) </span>
        {{ legislation.name }}
        <q-no-ssr style="display: inline">
          <q-btn aria-label="複製連結" class="no-print" dense flat icon="link" size="20px" @click="copyLink()" />
          <q-btn aria-label="列印" class="no-print" dense flat icon="print" size="20px" @click="handlePrint">
            <q-tooltip>列印</q-tooltip>
          </q-btn>
          <q-btn v-if="Object.entries(expanded).length > 0" class="no-print" dense flat icon="unfold_less" size="20px" @click="collapseAll">
            <q-tooltip>折疊所有條文</q-tooltip>
          </q-btn>
          <q-btn v-if="Object.entries(expanded).length > 0" class="no-print" dense flat icon="unfold_more" size="20px" @click="expandAll">
            <q-tooltip>展開所有條文</q-tooltip>
          </q-btn>
        </q-no-ssr>
      </h1>
      <div v-if="legislation.frozenBy" class="text-h6">
        <q-icon class="q-mr-xs" name="warning" size="32px" />
        本法令部分或全文已遭凍結或失效，詳見
        <q-btn :href="legislation.frozenBy" class="no-print" dense icon="link" label="相關連結" target="_blank" />
      </div>
      <div v-if="legislation.preface" class="text-h6 text-bold">{{ legislation.preface }}</div>
      <div v-if="legislation.history.length > 0">
        立法沿革
        <table>
          <tr v-for="history of legislation.history" :key="history.amendedAt.valueOf()">
            <th>{{ new Date(history.amendedAt).toLocaleDateString() }}</th>
            <th>{{ history.brief }}</th>
            <th class="no-print">
              <q-btn v-if="history.link" :href="history.link" dense flat icon="open_in_new" size="10px">
                <q-tooltip>檢視發布公文</q-tooltip>
              </q-btn>
            </th>
          </tr>
        </table>
      </div>
      <LegislationContent
        v-for="content of legislation.content"
        :id="content.index.toString()"
        :key="content.title"
        :class="content.index.toString() === hash ? (Dark.isActive ? 'bg-teal-10' : 'bg-yellow-3') : ''"
        :content="content"
        :expanded="expanded[content.index]"
        :printing="printing"
        @update:expanded="expanded[content.index] = $event"
      />
      <LegislationAddendum v-for="addendum of legislation.addendum" :key="addendum.createdAt.valueOf()" :addendum="addendum" />
      <AttachmentDisplay
        v-for="(attachment, index) of legislation.attachments"
        :key="attachment.description + attachment.urls.toString()"
        :attachment="attachment"
        :no-embed="printing"
        :order="index + 1"
      />
    </div>
  </q-page>
  <q-drawer :breakpoint="500" :width="250" bordered show-if-above side="right">
    <q-scroll-area class="fit">
      <q-list v-if="!!legislation">
        <q-item v-for="content of legislation.content" :key="content.title" class="q-py-none items-center" clickable dense @click="scrollTo(content.index.toString())">
          <div
            v-if="content.type.firebase !== ContentType.Clause.firebase && content.type.firebase !== ContentType.SpecialClause.firebase"
            class="text-h6"
          >
            {{ content.title }} {{ content.subtitle }}
          </div>
          <div v-else class="q-py-none">{{ content.title }} 【{{ content.subtitle }}】</div>
        </q-item>
      </q-list>
    </q-scroll-area>
  </q-drawer>
</template>
<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { ContentType } from 'src/ts/models.ts';
import { onMounted, onServerPrefetch, reactive, ref, watch } from 'vue';
import { event } from 'vue-gtag';
import LegislationContent from 'components/legislation/LegislationContent.vue';
import { copyLink, getMeta } from 'src/ts/utils.ts';
import LegislationAddendum from 'components/legislation/LegislationAddendum.vue';
import { useVueToPrint } from 'vue-to-print';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import { Dark, useMeta } from 'quasar';
import { useLegislationStore } from 'stores/legislation.ts';

const legislation = ref();
const content = ref();
const printing = ref(false);
const expanded = reactive({} as Record<number, boolean>);
const route = useRoute();
const hash = ref(route.hash?.substring(1)); // Old URLs uses hash
if (!hash.value || hash.value.length === 0) {
  hash.value = route.query.c as string;
}
onMounted(() => {
  // In window switches do not trigger SSR
  useLegislationStore()
    .loadLegislation(route.params.id as string)
    .then((l) => (legislation.value = l))
    .catch((e) => console.error(e));
  event('view_legislation' as any, {
    id: route.params.id! as string,
    name: legislation.value?.name,
    category: legislation.value?.category.translation,
    type: legislation.value?.category.type.translation,
  });
});
watch(
  legislation,
  () => {
    if (hash.value) {
      // wait for the content to load
      setTimeout(() => {
        scrollTo(hash.value)
      }, 250);
    }
    for (const content of legislation.value?.content ?? []) {
      if (content.type.firebase === ContentType.SpecialClause.firebase) {
        expanded[content.index] = true;
      }
    }
  },
  { once: true },
);

const { handlePrint } = useVueToPrint({
  content: content,
  documentTitle: legislation.value?.name ?? '',
  removeAfterPrint: true,
  pageStyle: '@page { margin: 0.5in 0.5in 0.5in 0.5in !important; }',
  onBeforeGetContent: () => {
    return new Promise((resolve) => {
      printing.value = true;
      setTimeout(() => {
        resolve();
      }, 300);
    });
  },
  onAfterPrint: () => {
    setTimeout(() => {
      printing.value = false;
    }, 300);
  },
});

function collapseAll() {
  for (const key in expanded) {
    expanded[key] = false;
  }
}

function expandAll() {
  for (const key in expanded) {
    expanded[key] = true;
  }
}

function scrollTo(index: string) {
  const el = document.getElementById(index);
  if (el) {
    hash.value = index
    window.scrollTo({
      top: el.offsetTop - 100,
      behavior: 'smooth',
    });
  }
}

defineOptions({
  async preFetch({ store, currentRoute }) {
    await useLegislationStore(store).loadLegislation(currentRoute.params.id as string);
  },
});

onServerPrefetch(async () => {
  legislation.value = await useLegislationStore().loadLegislation(route.params.id as string);
});

useMeta(() => {
  const store = useLegislationStore();
  const l = store.getLegislation(route.params.id as string);
  let description = undefined as string | undefined;
  const intHash = parseInt(hash.value ?? '0');
  const content = l?.content.find((c) => c.index === intHash);
  if (content) {
    description = content.title;
    switch (content.type.firebase) {
      case ContentType.Volume.firebase:
      case ContentType.Chapter.firebase:
      case ContentType.Section.firebase:
      case ContentType.Subsection.firebase:
        description += ' ' + content.subtitle + ' \n' + content.content;
        break;
      case ContentType.SpecialClause.firebase:
      case ContentType.Clause.firebase:
        description += (content.subtitle?.length > 0 ? ' 【' + content.subtitle + '】 \n' : ' \n') + content.content;
        break;
    }
  }
  const lastUpdated = l?.history[l?.history.length - 1]?.amendedAt?.toISOString();
  return {
    title: l?.name,
    meta: {
      ...getMeta(l?.name, description),
      'last-modified': {
        'http-equiv': 'last-modified',
        content: lastUpdated,
      },
      'og:updated-time': {
        name: 'og:updated-time',
        content: lastUpdated,
      },
    },
  };
});
</script>

<style scoped>
th {
  font-weight: normal;
  text-align: left;
  vertical-align: top;
}
</style>
