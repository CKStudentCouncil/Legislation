<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會</h1>
    <h1 class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">{{ doc.fromSpecific.translation }}</h1>
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
