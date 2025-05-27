<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!doc">載入中...(或查無此公文)</div>
    <div v-else ref="content" class="official-font-when-printing" style="max-width: min(1170px, 97vw)">
      <div>
        <q-no-ssr>
          <q-btn class="no-print" dense flat icon="print" size="20px" @click="handlePrint">
            <q-tooltip>列印</q-tooltip>
          </q-btn>
          <q-btn class="no-print" dense flat icon="share" size="20px" @click="share">
            <q-tooltip>分享</q-tooltip>
          </q-btn>
          <q-btn class="no-print" dense flat icon="zoom_in" size="20px" @click="size += 10">
            <q-tooltip>放大</q-tooltip>
          </q-btn>
          <q-btn class="no-print" dense flat icon="zoom_out" size="20px" @click="size -= 10">
            <q-tooltip>縮小</q-tooltip>
          </q-btn>
        </q-no-ssr>
        <DocumentRenderer :doc="doc" :style="`zoom: ${size}%`" />
        <DocumentSeparator v-if="doc.attachments.length > 0" />
        <AttachmentDisplay
          v-for="(attachment, index) of doc.attachments"
          :key="attachment.description + attachment.urls.toString()"
          :attachment="attachment"
          :no-embed="!embed"
          :order="index + 1"
        />
      </div>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { useVueToPrint } from 'vue-to-print';
import { onMounted, onServerPrefetch, ref } from 'vue';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import DocumentSeparator from 'components/DocumentSeparator.vue';
import { useDocumentStore } from 'stores/document.ts';
import { useMeta } from 'quasar';
import { DocumentType } from 'src/ts/models.ts';
import { convertToChineseDay } from 'app/functions/src/utils.ts';
import { event } from 'vue-gtag';

const route = useRoute();
const doc = ref();
const content = ref();
const size = ref(100); // %
const embed = ref(true);

const { handlePrint } = useVueToPrint({
  content: content,
  documentTitle: (route.params.id as string) ?? '',
  removeAfterPrint: true,
  pageStyle: '@page { margin: 0.5in 0.5in 0.5in 0.5in !important; }',
  onBeforeGetContent: () => {
    return new Promise((resolve) => {
      embed.value = false;
      setTimeout(() => {
        resolve();
      }, 300);
    });
  },
  onAfterPrint: () => {
    setTimeout(() => {
      embed.value = true;
    }, 300);
  },
});

onMounted(() => {
  // In window switches do not trigger SSR
  useDocumentStore()
    .loadDocument(route.params.id as string)
    .then((d) => (doc.value = d))
    .catch((e) => console.error(e));
  event('view_document' as any, {
    id: route.params.id! as string,
    subject: doc.value?.subject,
    type: doc.value?.type.translation,
  });
});

defineOptions({
  async preFetch({ store, currentRoute }) {
    try {
      await useDocumentStore(store).loadDocument(currentRoute.params.id as string);
    } catch {
      console.error(`Document loading failed (not found?): ${currentRoute.params.id as string}`)
    }
  },
});

onServerPrefetch(async () => {
  try {
    doc.value = await useDocumentStore().loadDocument(route.params.id as string);
  } catch {
    console.error(`Document loading failed (not found?): ${route.params.id as string}`)
  }
});

useMeta(() => {
  const store = useDocumentStore();
  const d = store.getDocument(route.params.id as string);
  let description = '';
  switch (d?.type.firebase) {
    case DocumentType.MeetingNotice.firebase: {
      let t = d.meetingTime;
      if (t) {
        t = new Date(t);
        t.setHours(t.getHours() + t.getTimezoneOffset() / 60); // Reset to UTC
        t.setHours(t.getHours() + 8); // Set to GMT+8
        description = `會議時間：${t.getFullYear()}/${(t.getMonth()) + 1}/${t.getDate()} (${convertToChineseDay(t.getDay())}) ${t.getHours()}:${t.getMinutes()}
會議地點：${d?.location}
公文字號：${d?.getFullId()}號
${d?.fromName ? `會議主席：${d.fromSpecific.translation} ${d.fromName}` : ''}`;
      }
      break;
    }
  }
  const lastUpdated = d?.publishedAt?.toISOString();
  return {
    title: d?.subject,
    meta: {
      description: {
        name: 'description',
        content: description,
      },
      'last-modified': {
        'http-equiv': 'last-modified',
        content: lastUpdated,
      },
      'og:updated-time': {
        name: 'og:updated-time',
        content: lastUpdated
      },
      'og:title': {
        name: 'og:title',
        content: d?.subject,
      },
      'og:description': {
        name: 'og:description',
        content: description,
      },
    },
  };
});

function share() {
  void navigator.share({
    title: (route.params.id as string) + '：' + (doc.value?.subject ?? ''),
    text: (route.params.id as string) + '：' + (doc.value?.subject ?? ''),
    url: window.location.href,
  });
}
</script>

<style scoped></style>
