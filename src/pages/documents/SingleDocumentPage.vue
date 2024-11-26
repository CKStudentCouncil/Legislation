<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!doc">載入中...(或查無此公文)</div>
    <div v-else style="max-width: 1170px">
      <div v-if="doc.type.firebase == DocumentType.MeetingNotice.firebase">
        <DocumentMeetingNotice :doc="doc" />
      </div>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { DocumentType, useSpecificDocument } from 'src/ts/models.ts';
import DocumentMeetingNotice from 'components/documents/DocumentMeetingNotice.vue';

const route = useRoute();
const doc = useSpecificDocument(route.params.id as string);
</script>

<style scoped></style>
