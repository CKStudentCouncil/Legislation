<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">臺北市立建國中學班聯會</div>
    <div class="text-h4 flex-center q-pb-md text-center" style="font-size: 32px">{{ doc.fromSpecific.translation }}</div>
    <div class="text-right">{{ doc.getFullId() }}</div>
    <div v-html="customSanitize(doc.content)"></div>
  </div>
</template>

<script lang="ts" setup>
import type * as models from 'src/ts/models.ts';
import { customSanitize } from 'src/ts/utils.ts';

defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped></style>
