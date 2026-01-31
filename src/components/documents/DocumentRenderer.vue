<template>
  <DocumentMeetingNotice v-if="doc.type.firebase == DocumentType.MeetingNotice.firebase" :doc="doc" />
  <DocumentAdvisory v-else-if="doc.type.firebase == DocumentType.Advisory.firebase" :doc="doc" />
  <DocumentAnnouncement v-else-if="doc.type.firebase == DocumentType.Announcement.firebase" :doc="doc" />
  <DocumentOrder v-else-if="doc.type.firebase == DocumentType.Order.firebase" :doc="doc" />
  <DocumentMessage v-else-if="doc.type.firebase == DocumentType.Message.firebase" :doc="doc" />
  <DocumentMeetingRecord v-else-if="doc.type.firebase == DocumentType.Record.firebase" :doc="doc" />
  <DocumentCourt v-else-if="doc.type.firebase.startsWith('Court')" :doc="doc" />
  <DocumentJudicialCommittee v-else-if="doc.type.firebase.startsWith('JudicialCommittee')" :doc="doc" />
  <div v-else>本公文之資料有缺失，請將本公文號回報於管理員：{{ doc.getFullId() }}</div>
</template>

<script setup lang="ts">
import { DocumentType } from 'src/ts/models.ts';
import DocumentMeetingNotice from 'components/documents/DocumentMeetingNotice.vue';
import type * as models from 'src/ts/models.ts';
import DocumentAdvisory from 'components/documents/DocumentAdvisory.vue';
import DocumentOrder from 'components/documents/DocumentOrder.vue';
import DocumentMessage from 'components/documents/DocumentMessage.vue';
import DocumentMeetingRecord from 'components/documents/DocumentMeetingRecord.vue';
import DocumentCourt from 'components/documents/DocumentCourt.vue';
import DocumentJudicialCommittee from 'components/documents/DocumentJudicialCommittee.vue';
import DocumentAnnouncement from 'components/documents/DocumentAnnouncement.vue';

defineProps<{
  doc: models.Document;
}>();
</script>

<style scoped></style>
