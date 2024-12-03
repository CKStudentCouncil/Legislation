<template>
  <DocumentMeetingNotice v-if="doc.type.firebase == DocumentType.MeetingNotice.firebase" :doc="doc" />
  <DocumentAdvisory v-if="doc.type.firebase == DocumentType.Advisory.firebase" :doc="doc" />
  <DocumentOrder v-if="doc.type.firebase == DocumentType.Order.firebase" :doc="doc" />
  <DocumentMeetingRecord v-if="doc.type.firebase == DocumentType.Record.firebase" :doc="doc" />
</template>

<script setup lang="ts">
import { DocumentType } from 'src/ts/models.ts';
import DocumentMeetingNotice from 'components/documents/DocumentMeetingNotice.vue';
import * as models from 'src/ts/models.ts';
import DocumentAdvisory from 'components/documents/DocumentAdvisory.vue';
import DocumentOrder from 'components/documents/DocumentOrder.vue';
import DocumentMeetingRecord from 'components/documents/DocumentMeetingRecord.vue';

defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped>

</style>
