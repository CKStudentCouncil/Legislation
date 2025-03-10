<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else style="max-width: 1170px">
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">臺北市立建國中學班聯會</div>
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">{{ doc.subject }} 會議記錄</div>
    <div class="text-right">{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
    <div class="text-h6">
      <div>會議主席：{{ doc.fromSpecific.translation }} {{doc.fromName}}</div>
      <div>會議記錄：{{ doc.secretarySpecific?.translation }} {{doc.secretaryName}}</div>
      <div v-if="doc.meetingTime">會議時間：{{ doc.meetingTime.toLocaleString() }}</div>
      <div>地點：{{doc.location}}</div>
    </div>
    <DocumentSeparator/>
    <div v-html="customSanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import * as models from 'src/ts/models.ts';
import { customSanitize } from 'src/ts/utils.ts';
import DocumentSeparator from 'components/DocumentSeparator.vue';

defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped></style>
