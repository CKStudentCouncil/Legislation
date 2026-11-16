<template>
  <q-tabs align="left">
    <q-route-tab label="文書查詢" to="/document/judicial" />
    <q-route-tab label="訴訟查詢" to="/document/judicial/lawsuit" />
    <q-route-tab label="決議文" to="/document/judicial/resolution" />
  </q-tabs>
  <q-page padding>
    <q-stepper ref="stepper" v-model="step" :class="sortedDocs.length === 0 ? 'text-center' : ''" animated header-nav vertical>
      <q-spinner v-if="sortedDocs.length === 0" color="primary" size="40px" />
      <q-step
        v-for="(doc, index) in sortedDocs"
        :key="doc.documentId"
        :caption="doc.subject"
        :icon="icon(doc.type.icon)"
        :name="index"
        :title="doc.getFullId()"
      >
        <DocumentRenderer :doc="doc" />
        <q-stepper-navigation align="right">
          <q-btn v-if="step !== sortedDocs.length - 1" color="primary" label="下一頁" @click="next" />
          <q-btn v-if="step !== 0" color="primary" flat label="上一頁" @click="previous" />
          <q-btn color="primary" flat :icon="matLink" label="複製連結" @click="copyStepLink(step)" />
          <q-btn
            :to="`/document/${encodeURIComponent(doc.documentId)}`"
            color="primary"
            flat
            :icon="matOpenInNew"
            label="檢視原文"
            rel="link"
            :alt="`${doc.getFullId()}：${doc.subject}`"
          />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script lang="ts" setup>
import { matLink, matOpenInNew } from '@quasar/extras/material-icons';
import { icon } from 'src/ts/icons.ts';
import { useRoute, useRouter } from 'vue-router';
import { nextTick, onMounted, onServerPrefetch, ref, watch } from 'vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { copyText } from 'src/ts/utils.ts';
import { useDocumentStore, type LawsuitDocument } from 'stores/document.ts';
import { event } from 'vue-gtag';

const route = useRoute();
const router = useRouter();
const store = useDocumentStore();
const id = route.params.id as string;
// Seed from serialized store state so the server-rendered thread hydrates without mismatch.
const sortedDocs = ref<LawsuitDocument[]>(store.getLawsuit(id) ?? []);
// A link names the Firestore key (`?d=<key>`), which survives reordering and distinguishes legacy documents with the same displayed ID.
// Older links name the displayed ID or carry only `?c=<position>`.
const wantedDoc = typeof route.query.d === 'string' ? route.query.d : null;

function linkedDocumentIndex(docs: LawsuitDocument[]): number {
  if (wantedDoc === null) return -1;
  const keyed = docs.findIndex((d) => d.documentId === wantedDoc);
  return keyed >= 0 ? keyed : docs.findIndex((d) => d.getFullId() === wantedDoc);
}

function stepFor(docs: LawsuitDocument[]): number {
  const named = linkedDocumentIndex(docs);
  return named >= 0 ? named : parseInt(route.query.c as string) || 0;
}

const step = ref(stepFor(sortedDocs.value));
const stepper = ref();
// True while the page moves the step itself (the thread was refreshed under the reader), so the URL is corrected instead of gaining an entry.
let restoring = false;

onServerPrefetch(async () => {
  sortedDocs.value = await store.loadLawsuit(id);
  step.value = stepFor(sortedDocs.value);
});

watch(step, (v) => {
  const d = sortedDocs.value[v]?.documentId;
  void router[restoring ? 'replace' : 'push']({ query: d ? { d } : { c: v } });
});

onMounted(() => {
  // Refresh client-side so authorized users see any docs the anonymous SSR pass couldn't read.
  let readerNavigated = false;
  const stopTrackingStep = watch(
    step,
    () => {
      readerNavigated = true;
    },
    { flush: 'sync' },
  );
  store
    .loadLawsuit(id, true)
    .then(async (docs) => {
      stopTrackingStep();
      // Read the selection before replacing its list, so navigation during the request is preserved. Until the reader navigates,
      // an explicit link still takes priority over the SSR fallback when its document only becomes available in the client refresh.
      const reading = sortedDocs.value[step.value]?.documentId;
      const wantedAt = !readerNavigated ? linkedDocumentIndex(docs) : -1;
      const at = wantedAt >= 0 ? wantedAt : docs.findIndex((d) => d.documentId === reading);
      sortedDocs.value = docs;
      // The refreshed thread may have grown ahead of the document being read: stay on that document, not on its old position.
      if (at >= 0 && at !== step.value) {
        restoring = true;
        step.value = at;
        await nextTick();
        restoring = false;
      }
    })
    .catch((e) => console.error(e))
    .finally(stopTrackingStep);
  event('view_lawsuit', { id });
});

function copyStepLink(index: number) {
  const d = sortedDocs.value[index]?.documentId;
  void copyText(`${location.protocol}//${location.host}${location.pathname}${d ? `?d=${encodeURIComponent(d)}` : ''}`);
}

function next() {
  stepper.value.next();
}

function previous() {
  stepper.value.previous();
}
</script>

<style scoped></style>
