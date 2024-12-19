<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!doc">載入中...(或查無此公文)</div>
    <div v-else ref="content" class="official-font-when-printing" style="max-width: 1170px">
      <div>
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
        <DocumentRenderer :doc="doc" :style="`zoom: ${size}%`" />
        <q-separator v-if="doc.attachments.length > 0" class="q-mt-sm q-mb-sm" color="black" />
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
import { useSpecificDocument } from 'src/ts/models.ts';
import { useVueToPrint } from 'vue-to-print';
import { ref } from 'vue';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';

const route = useRoute();
const doc = useSpecificDocument(route.params.id as string);
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

function share() {
  navigator.share({
    title: (route.params.id as string) + '：' + doc.value?.subject ?? '',
    text: (route.params.id as string) + '：' + doc.value?.subject ?? '',
    url: window.location.href,
  });
}
</script>

<style scoped></style>
