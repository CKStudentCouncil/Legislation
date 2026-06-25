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
        :key="doc.createdAt.valueOf()"
        :caption="doc.subject"
        :icon="doc.type.icon"
        :name="index"
        :title="doc.getFullId()"
      >
        <DocumentRenderer :doc="doc" />
        <q-stepper-navigation align="right">
          <q-btn v-if="step !== sortedDocs.length - 1" color="primary" label="下一頁" @click="next" />
          <q-btn v-if="step !== 0" color="primary" flat label="上一頁" @click="previous" />
          <q-btn color="primary" flat icon="link" label="複製連結" @click="copyLink(step)" />
          <q-btn
            :to="`/document/${doc.getFullId()}`"
            color="primary"
            flat
            icon="open_in_new"
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
import { useRoute, useRouter } from 'vue-router';
import { onMounted, onServerPrefetch, ref, watch } from 'vue';
import type { Document } from 'src/ts/models.ts';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { copyLink } from 'src/ts/utils.ts';
import { useDocumentStore } from 'stores/document.ts';
import { event } from 'vue-gtag';

const route = useRoute();
const router = useRouter();
const store = useDocumentStore();
const id = route.params.id as string;
// Seed from serialized store state so the server-rendered thread hydrates without mismatch.
const sortedDocs = ref<Document[]>(store.getLawsuit(id) ?? []);
const step = ref(parseInt(route.query.c as string) || 0);
const stepper = ref();

onServerPrefetch(async () => {
  sortedDocs.value = await store.loadLawsuit(id);
});

watch(step, (v) => void router.push({ query: { c: v } }));

onMounted(() => {
  // Refresh client-side so authorized users see any docs the anonymous SSR pass couldn't read.
  store
    .loadLawsuit(id, true)
    .then((docs) => (sortedDocs.value = docs))
    .catch((e) => console.error(e));
  event('view_lawsuit' as any, { id });
});

function next() {
  stepper.value.next();
}

function previous() {
  stepper.value.previous();
}
</script>

<style scoped></style>
