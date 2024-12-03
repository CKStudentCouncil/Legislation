<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else style="max-width: 1170px">
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">臺北市立建國中學班聯會 {{ doc.fromSpecific.generic.translation }} 開會通知單</div>
    <div class="text-right">{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
    <div class="text-h6">發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
    <div class="text-h6">密等：{{ doc.confidentiality.translation }}</div>
    <q-separator class="q-mt-sm q-mb-sm" color="black" />
    <div class="text-h6">出席人：{{ readableTo }}</div>
    <div v-if="doc.ccSpecific.length > 0" class="text-h6">列席人：{{ readableCC }}</div>
    <div class="text-h6">會議名稱：{{ doc.subject }}</div>
    <div v-html="customSanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as models from 'src/ts/models.ts';
import { customSanitize, getReadableRecipient } from 'src/ts/utils.ts';

const props = defineProps<{
  doc: models.Document;
}>();
const readableTo = computed(() => {
  return getReadableRecipient(props.doc.toSpecific, props.doc.toOther);
});
const readableCC = computed(() => {
  return getReadableRecipient(props.doc.ccSpecific, props.doc.ccOther!);
});
</script>

<style scoped></style>
