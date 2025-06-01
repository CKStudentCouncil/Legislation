<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會 {{ title }} 開會通知單</h1>
    <div class="text-right">{{ doc.getFullId() }}</div>
    <div class="text-h6">
      <div>發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
      <div>密等：{{ doc.confidentiality.translation }}</div>
      <DocumentSeparator />
      <div>出席人：{{ readableTo }}</div>
      <div v-if="doc.ccSpecific.length > 0">列席人：{{ readableCC }}</div>
      <div>會議名稱：{{ doc.subject }}</div>
      <div v-if="doc.meetingTime">會議時間：{{ doc.meetingTime.toLocaleString() }}</div>
      <div v-if="doc.location">會議地點：{{ doc.location }}</div>
      <div v-if="doc.fromName">
        會議主席：{{ doc.fromSpecific.signatureTitle ?? doc.fromSpecific.translation }}
        {{ doc.fromName }}
      </div>
    </div>
    <div v-html="customSanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as models from 'src/ts/models.ts';
import { DocumentGeneralIdentity, DocumentSpecificIdentity } from 'src/ts/models.ts';
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
const title = computed(() => {
  if (
    props.doc.fromSpecific.firebase == DocumentSpecificIdentity.Chairman.firebase ||
    props.doc.fromSpecific.firebase == DocumentSpecificIdentity.ViceChairman.firebase
  ) {
    // 跨部門會議
    return props.doc.subject.replace(/第.*次/, '');
  }
  if (props.doc.fromSpecific.generic.firebase == DocumentGeneralIdentity.ExecutiveDepartment.firebase) {
    return props.doc.fromSpecific.translation;
  } else {
    return props.doc.fromSpecific.generic.translation;
  }
});
</script>

<style scoped></style>
