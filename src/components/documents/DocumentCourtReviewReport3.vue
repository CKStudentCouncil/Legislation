<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會</h1>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">裁判憲章審查審查報告</h1>
    <div class="text-h6">發文日期：{{ doc.published ? doc.publishedAt!.toLocaleDateString() : '尚未發布' }}</div>
    <div class="text-h6">發文字號：{{ doc.getFullId() }}</div>
    <DocumentSeparator />
    <SafeHtml :content="doc.content" />
    <DocumentSeparator />
  </div>
</template>

<script lang="ts" setup>
import type * as models from 'src/ts/models.ts';
import SafeHtml from 'components/SafeHtml.vue';
import DocumentSeparator from 'components/DocumentSeparator.vue';

const props = defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped></style>
