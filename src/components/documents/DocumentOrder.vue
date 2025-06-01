<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會</h1>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">{{ doc.fromSpecific.translation }} 令</h1>
    <div class="text-h6">發文日期：{{ doc.published ? doc.publishedAt!.toLocaleDateString() : '尚未發布' }}</div>
    <div class="text-h6">發文字號：{{ doc.getFullId() }}</div>
    <DocumentSeparator />
    <div v-html="customSanitize(doc.content)"></div>
    <DocumentSeparator />
    <div class="text-h2">
      <span class="text-h6 on-left">{{ doc.fromSpecific.signatureTitle ?? doc.fromSpecific.translation }}</span>
      {{ props.doc.fromName }}
    </div>
    <div v-if="doc.published" class="text-h4 text-center q-mt-lg">
      中華民國 {{ doc.publishedAt!.getFullYear() - 1911 }} 年 {{ doc.publishedAt!.getMonth() + 1 }} 月 {{ doc.publishedAt!.getDate() }} 日
    </div>
  </div>
</template>

<script lang="ts" setup>
import type * as models from 'src/ts/models.ts';
import { customSanitize } from 'src/ts/utils.ts';
import DocumentSeparator from 'components/DocumentSeparator.vue';

const props = defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped></style>
