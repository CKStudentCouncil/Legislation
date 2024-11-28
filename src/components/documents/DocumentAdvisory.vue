<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else style="max-width: 1170px">
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">臺北市立建國中學班聯會</div>
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">{{ doc.fromSpecific.translation }} 函</div>
    <div class="text-right">{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
    <div class="text-h6">受文者：{{ readableTo }}</div>
    <div class="text-h6" v-if="doc.cc.length > 0">副本：{{ readableCC }}</div>
    <div class="text-h6">發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
    <div class="text-h6">密等：{{ doc.confidentiality.translation }}</div>
    <div class="text-h6">主旨：{{ doc.subject }}</div>
    <q-separator color="black" class="q-mt-sm q-mb-sm" />
    <div class="text-h6">說明：</div>
    <div v-html="sanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import sanitize from 'sanitize-html';
import { computed } from 'vue';
import * as models from 'src/ts/models.ts';
import { getReadableRecipient } from 'src/ts/utils.ts';

const props = defineProps<{
  doc: models.Document;
}>();
const readableTo = computed(() => {
  return getReadableRecipient(props.doc.to, props.doc.toSpecific, props.doc.toOther);
});
const readableCC = computed(() => {
  return getReadableRecipient(props.doc.cc, props.doc.ccSpecific, props.doc.ccOther!);
});
</script>

<style scoped></style>
