<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">
      臺北市立建國中學班聯會 {{ doc.fromSpecific.generic.translation }}
      開會通知單
    </div>
    <div class="text-right">{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
    <div class="text-h6">
      <div>發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
      <div>密等：{{ doc.confidentiality.translation }}</div>
      <DocumentSeparator/>
      <div>出席人：{{ readableTo }}</div>
      <div v-if="doc.ccSpecific.length > 0">列席人：{{ readableCC }}</div>
      <div>會議名稱：{{ doc.subject }}</div>
      <div v-if="doc.meetingTime">會議時間：{{ doc.meetingTime.toLocaleString() }}</div>
      <div v-if="doc.location">會議地點：{{ doc.location }}</div>
      <div v-if="doc.fromName">會議主席：{{ doc.fromSpecific.translation }} {{ doc.fromName }}</div>
    </div>
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
