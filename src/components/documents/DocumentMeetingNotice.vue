<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else style="max-width: 1170px">
    <div class="text-h4 flex-center q-pb-md text-center">臺北市立建國中學班聯會 {{ doc.from.translation }} 開會通知單</div>
    <div class="text-right">{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
    <div class="text-h6">受文者：{{ readableTo }}</div>
    <div class="text-h6">發文日期：{{ doc.createdAt.toLocaleDateString() }}</div>
    <div class="text-h6">密等：{{ doc.confidentiality.translation }}</div>
    <div class="text-h6">會議名稱：{{ doc.subject }}</div>
    <div v-html="sanitize(doc.content)"></div>
    <div v-if="doc.attachments.length != 0">
      <q-list>
        <q-item v-for="attachment of doc.attachments" :key="attachment" v-ripple :href="attachment" clickable target="_blank">
          <q-item-section>{{ attachment }}</q-item-section>
          <q-item-section side>
            <q-icon name="visibility" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>

<script lang="ts" setup>
import sanitize from 'sanitize-html';
import { computed } from 'vue';
import * as models from 'src/ts/models.ts';
import { getReadableTo } from 'src/ts/utils.ts';

const props = defineProps<{
  doc: models.Document;
}>();
const readableTo = computed(() => {
  return getReadableTo(props.doc);
});
</script>

<style scoped></style>
