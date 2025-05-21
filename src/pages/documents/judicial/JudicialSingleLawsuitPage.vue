<template>
  <q-tabs align="left">
    <q-route-tab label="文書查詢" to="/document/judicial" />
    <q-route-tab label="訴訟查詢" to="/document/judicial/lawsuit" />
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
        :title="`${doc.idPrefix}第${doc.idNumber}號`"
      >
        <DocumentRenderer :doc="doc" />
        <q-stepper-navigation align="right">
          <q-btn v-if="step !== sortedDocs.length - 1" color="primary" label="下一頁" @click="next" />
          <q-btn v-if="step !== 0" color="primary" flat label="上一頁" @click="previous" />
          <q-btn color="primary" flat icon="link" label="複製連結" @click="copyLink(step)" />
          <q-btn :to="`/document/${doc.idPrefix}第${doc.idNumber}號`" color="primary" flat icon="open_in_new" label="檢視原文" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script lang="ts" setup>
import { DocumentConfidentiality, documentsCollection, useSpecificDocument } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import { query, where } from 'firebase/firestore';
import { useCollection } from 'vuefire';
import { computed, onMounted, ref, watch } from 'vue';
import orderBy from 'lodash/orderBy';
import concat from 'lodash/concat';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { copyLink } from 'src/ts/utils.ts';
import { event } from 'vue-gtag';

const route = useRoute();
const router = useRouter();
const prosecutionDoc = useSpecificDocument(route.params.id as string);
const step = ref(parseInt(route.query.c as string) || 0);
const stepper = ref();
const relevantDocs = useCollection(
  query(
    documentsCollection(),
    where('prosecutionId', '==', route.params.id as string),
    where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
    where('published', '==', true),
  ),
);
const sortedDocs = computed(() => orderBy(concat(relevantDocs.value, prosecutionDoc.value), ['publishedAt'], ['asc']).filter((o) => !!o));
watch(step, (v) => void router.push({ query: { c: v } }));
onMounted(() => {
  event('view_lawsuit' as any, {
    id: route.params.id! as string,
  });
});

function next() {
  stepper.value.next();
}

function previous() {
  stepper.value.previous();
}
</script>

<style scoped></style>
