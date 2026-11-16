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
          <q-btn color="primary" flat :icon="matLink" label="複製連結" @click="copyLink(doc.documentId, 'd')" />
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
import { computed, onBeforeUnmount, onMounted, onServerPrefetch, ref, watch } from 'vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { copyLink } from 'src/ts/utils.ts';
import { currentReader } from 'src/ts/auth.ts';
import { useDocumentStore, type LawsuitDocument } from 'stores/document.ts';
import { event } from 'vue-gtag';

const route = useRoute();
const router = useRouter();
const store = useDocumentStore();
const id = route.params.id as string;
// Seed from serialized store state so the server-rendered thread hydrates without mismatch.
const sortedDocs = ref<LawsuitDocument[]>(store.getLawsuit(id) ?? []);

// Where in `docs` the document the URL names (`?d=<Firestore key>`) is, or -1. A key holds through the thread being reordered or growing.
function linkedDocument(docs: LawsuitDocument[]): number {
  const wanted = route.query.d;
  return typeof wanted === 'string' ? docs.findIndex((d) => d.documentId === wanted) : -1;
}

// The step `docs` would show for the current URL. Links from before `?d=` carry only a position, `?c=`.
function stepIn(docs: LawsuitDocument[]): number {
  const linked = linkedDocument(docs);
  if (linked >= 0) return linked;
  const position = parseInt(route.query.c as string);
  return position >= 0 && position < docs.length ? position : 0;
}

// The URL is the step's only home, so Back and Forward move the stepper too.
const step = computed({
  get: () => stepIn(sortedDocs.value),
  set: (index: number) => {
    const d = sortedDocs.value[index]?.documentId;
    if (d) void router.push({ query: { d } });
  },
});
const stepper = ref();
let mounted = false;

onServerPrefetch(async () => {
  sortedDocs.value = await store.loadLawsuit(id);
});

// Read the thread again as `reader`, keeping whoever is reading on the document they are on.
async function refresh(reader: string | null) {
  let docs: LawsuitDocument[];
  try {
    docs = await store.loadLawsuit(id, reader);
  } catch (e) {
    console.error(e);
    return;
  }
  // Left the page, or signed in or out, while this was out: there is nothing here to update, or a newer read will.
  if (!mounted || currentReader.value !== reader) return;
  // When the URL gives only a position, the new thread may hold another document there (it can grow ahead of the one being read, with
  // documents this reader may see and the server render could not). Name the document being read first, so the reader stays on it. A
  // link naming a document of the new thread is left alone: that document only now became readable, and is what the link asked for.
  const reading = sortedDocs.value[step.value]?.documentId;
  if (reading && linkedDocument(docs) < 0 && docs[stepIn(docs)]?.documentId !== reading && docs.some((d) => d.documentId === reading)) {
    await router.replace({ query: { d: reading } });
  }
  sortedDocs.value = docs;
}

onMounted(() => {
  mounted = true;
  event('view_lawsuit', { id });
  // The server render reads as nobody and may be a CDN copy up to a day old, so once the reader is known the thread is read again under
  // their rules, which may show them more, and again whenever they sign in or out. The store hands back a thread this browser already
  // read for the same reader (on the search page, say) without reading it again.
  watch(
    currentReader,
    (reader) => {
      if (reader !== undefined) void refresh(reader);
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  mounted = false;
});

function next() {
  stepper.value.next();
}

function previous() {
  stepper.value.previous();
}
</script>

<style scoped></style>
