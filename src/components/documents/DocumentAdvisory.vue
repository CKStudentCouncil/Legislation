<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會</h1>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">{{ doc.fromSpecific.translation }} 函</h1>
    <div class="text-right">{{ doc.getFullId() }}</div>
    <div class="text-h6">受文者：{{ readableTo }}</div>
    <div v-if="doc.ccSpecific.length > 0" class="text-h6">副本：{{ readableCC }}</div>
    <div class="text-h6">發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
    <div class="text-h6">密等：{{ doc.confidentiality.translation }}</div>
    <div class="text-h6">主旨：{{ doc.subject }}</div>
    <DocumentSeparator />
    <div class="text-h6">說明：</div>
    <div v-html="customSanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as models from 'src/ts/models.ts';
import { customSanitize, getReadableRecipient } from 'src/ts/utils.ts';
import DocumentSeparator from 'components/DocumentSeparator.vue';

const props = defineProps<{
  doc: models.Document;
}>();
const readableTo = computed(() => {
  return getReadableRecipient(props.doc.toSpecific, props.doc.toOther);
});
const readableCC = computed(() => {
  return getReadableRecipient(props.doc.ccSpecific, props.doc.ccOther);
});
</script>

<style scoped></style>
